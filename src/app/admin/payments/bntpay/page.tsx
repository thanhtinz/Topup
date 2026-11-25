import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { BNTPAY_NETWORKS, BNTPAY_DEFAULT_API_URL } from "@/lib/gateways";
import { Top, Msg } from "../../ui";
import { saveGatewayAction } from "../../actions";
import { ToggleRow, GatewayActions, secretHint } from "../shared";

export const dynamic = "force-dynamic";

export default async function AdminBntPay({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { msg, err } = await searchParams;
  const s = await getSettings();
  const base = (s.site_url || "").replace(/\/+$/, "");
  return (
    <div>
      <p style={{ margin: "0 0 10px" }}><Link href="/admin/payments">← Cấu hình nạp tiền</Link></p>
      <Top title="BNT Pay — stablecoin" />
      <Msg msg={msg} err={err} />
      <form action={saveGatewayAction}>
        <input type="hidden" name="gateway" value="bntpay" />
        <div className="admin-card">
          <p className="muted" style={{ marginBottom: 14 }}>
            Webhook BNT Pay trỏ về <b>{base ? `${base}/api/webhooks/bntpay` : "/api/webhooks/bntpay"}</b>. Khoá merchant và webhook secret lấy trong dashboard BNT Pay của merchant này.
          </p>
          <ToggleRow name="pay_bntpay_enabled" label="Bật cổng BNT Pay" desc="Tắt thì khách không thấy cổng này ở trang nạp ví." checked={s.pay_bntpay_enabled === "1"} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12 }}>
            <div className="field"><label>API URL (để trống = {BNTPAY_DEFAULT_API_URL})</label><input name="bntpay_api_url" defaultValue={s.bntpay_api_url} placeholder={BNTPAY_DEFAULT_API_URL} /></div>
            <div className="field"><label>Mạng mặc định</label>
              <select name="bntpay_network" defaultValue={s.bntpay_network || "TRON"}>
                {BNTPAY_NETWORKS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="field"><label>Thời hạn thanh toán (phút, 15–60)</label><input name="bntpay_expires_minutes" type="number" min={15} max={60} defaultValue={s.bntpay_expires_minutes || "30"} /></div>
            <div className="field"><label>Merchant API Key</label><input name="bntpay_api_key" type="password" autoComplete="new-password" placeholder={secretHint(s.bntpay_api_key)} /></div>
            <div className="field"><label>Webhook Secret</label><input name="bntpay_webhook_secret" type="password" autoComplete="new-password" placeholder={secretHint(s.bntpay_webhook_secret)} /></div>
          </div>
          <GatewayActions />
        </div>
      </form>
    </div>
  );
}
