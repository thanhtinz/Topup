import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { openSecret } from "@/lib/gateways";
import { Top, Msg } from "../ui";
import { saveSettingsAction } from "../actions";

export const dynamic = "force-dynamic";

function Actions() {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
      <button className="btn btn-primary" type="submit">Lưu cấu hình</button>
    </div>
  );
}

export default async function AdminPayments({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { msg, err } = await searchParams;
  const s = await getSettings();
  const gateways = [
    {
      href: "/admin/payments/sepay",
      name: "SePay — chuyển khoản ngân hàng",
      desc: "Khách chuyển khoản VNĐ kèm mã lệnh, webhook tự cộng ví.",
      enabled: s.pay_sepay_enabled === "1",
      configured: Boolean(s.sepay_account_number?.trim()) && Boolean(openSecret(s.sepay_secret)),
    },
    {
      href: "/admin/payments/bntpay",
      name: "BNT Pay — stablecoin",
      desc: "Khách trả USDT qua BNT Pay, webhook tự cộng ví theo tỉ giá.",
      enabled: s.pay_bntpay_enabled === "1",
      configured: Boolean(openSecret(s.bntpay_api_key)),
    },
  ];
  return (
    <div>
      <Top title="Cấu hình nạp tiền" />
      <Msg msg={msg} err={err} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14, marginBottom: 16 }}>
        {gateways.map((g) => (
          <div key={g.href} className="admin-card" style={{ margin: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <b style={{ fontSize: 16 }}>{g.name}</b>
              <span className={`badge ${g.enabled ? "green" : "gray"}`}>{g.enabled ? "Đang bật" : "Đang tắt"}</span>
              <span className={`badge ${g.configured ? "blue" : "amber"}`}>{g.configured ? "Đã cấu hình" : "Chưa cấu hình"}</span>
            </div>
            <p className="muted" style={{ marginBottom: 12 }}>{g.desc}</p>
            <Link className="btn btn-outline btn-sm" href={g.href}>Mở trang cấu hình</Link>
          </div>
        ))}
      </div>

      <form action={saveSettingsAction}>
        <input type="hidden" name="_path" value="/admin/payments" />
        <div className="admin-card">
          <h2>Giới hạn nạp VNĐ</h2>
          <p className="muted" style={{ marginBottom: 12 }}>Áp cho mọi lệnh nạp tính bằng VNĐ. Chip chọn nhanh ở trang ví tự suy ra từ mức tối thiểu (×1, ×2, ×5, ×10, ×20).</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12 }}>
            <div className="field"><label>Nạp tối thiểu (VNĐ)</label><input name="deposit_min_vnd" type="number" min={1000} step={1000} defaultValue={s.deposit_min_vnd} /></div>
            <div className="field"><label>Nạp tối đa (VNĐ)</label><input name="deposit_max_vnd" type="number" min={1000} step={1000} defaultValue={s.deposit_max_vnd} /></div>
          </div>
          <Actions />
        </div>
      </form>
    </div>
  );
}
