import { prisma } from "./db";
import { getSettings } from "./settings";
import { getSepayConfig, getBntpayConfig } from "./gateways";

export type CompState = "operational" | "degraded" | "down" | "off";
export type Component = { key: string; name: string; state: CompState; detail: string };

export const STATE_LABEL: Record<CompState, string> = {
  operational: "Hoạt động bình thường",
  degraded: "Chậm / không ổn định",
  down: "Đang gián đoạn",
  off: "Chưa bật",
};

export async function getSystemStatus(): Promise<{ components: Component[]; incident: { title: string; body: string } | null; overall: CompState }> {
  const s = await getSettings();
  const override = (key: string): CompState | null => {
    const v = s[`status_override_${key}`];
    return v === "operational" || v === "degraded" || v === "down" ? v : null;
  };
  const components: Component[] = [];

  components.push({
    key: "website",
    name: "Website & đặt hàng",
    state: override("website") ?? "operational",
    detail: "Trang web và luồng đặt hàng",
  });

  const providers = await prisma.provider.findMany({ select: { enabled: true, lastSyncAt: true } });
  const enabledProviders = providers.filter((p) => p.enabled);
  let apiState: CompState = "off";
  let apiDetail = "API đấu nối chưa mở";
  if (enabledProviders.length) {
    const latest = enabledProviders.reduce<Date | null>((acc, p) => (p.lastSyncAt && (!acc || p.lastSyncAt > acc) ? p.lastSyncAt : acc), null);
    if (!latest) { apiState = "degraded"; apiDetail = "API đang cập nhật dữ liệu"; }
    else {
      const ageH = (Date.now() - latest.getTime()) / 3600000;
      apiState = ageH <= 3 ? "operational" : ageH <= 24 ? "degraded" : "down";
      apiDetail = apiState === "operational"
        ? `API phản hồi bình thường · Cập nhật gần nhất: ${latest.toLocaleString("vi-VN")}`
        : apiState === "degraded"
          ? "API phản hồi chậm hơn bình thường"
          : "API đang gián đoạn, đội ngũ đang xử lý";
    }
  }
  components.push({ key: "api", name: "API đấu nối cho khách hàng", state: override("api") ?? apiState, detail: apiDetail });

  const [sepay, bntpay] = await Promise.all([getSepayConfig(), getBntpayConfig()]);
  const gateways = [sepay.enabled ? "QR ngân hàng" : null, bntpay.enabled ? "USDT" : null].filter(Boolean) as string[];
  components.push({
    key: "payments",
    name: "Nạp ví & thanh toán",
    state: override("payments") ?? (gateways.length ? "operational" : "degraded"),
    detail: gateways.length ? `Đang mở: ${gateways.join(", ")}` : "Cổng nạp đang bảo trì",
  });

  const incident = s.status_incident_on === "1" && s.status_incident_title
    ? { title: s.status_incident_title, body: s.status_incident_body ?? "" }
    : null;

  const states = components.map((c) => c.state).filter((x) => x !== "off");
  const overall: CompState = states.includes("down") ? "down" : states.includes("degraded") ? "degraded" : "operational";
  return { components, incident, overall };
}
