import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { Top, Msg } from "../../ui";
import { saveGatewayAction } from "../../actions";
import { ToggleRow, GatewayActions, secretHint } from "../shared";

export const dynamic = "force-dynamic";

export default async function AdminSepay({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { msg, err } = await searchParams;
  const s = await getSettings();
  const base = (s.site_url || "").replace(/\/+$/, "");
  return (
    <div>
      <p style={{ margin: "0 0 10px" }}><Link href="/admin/payments">← Cấu hình nạp tiền</Link></p>
      <Top title="SePay — chuyển khoản ngân hàng" />
      <Msg msg={msg} err={err} />
      <form action={saveGatewayAction}>
        <input type="hidden" name="gateway" value="sepay" />
        <div className="admin-card">
          <p className="muted" style={{ marginBottom: 14 }}>
            Webhook SePay trỏ về <b>{base ? `${base}/api/webhooks/sepay` : "/api/webhooks/sepay"}</b> và đặt API Key trong SePay trùng với ô Khoá webhook bên dưới. Khách chuyển đúng số VNĐ và nội dung là mã lệnh thì hệ thống tự cộng ví.
          </p>
          <ToggleRow name="pay_sepay_enabled" label="Bật cổng SePay" desc="Tắt thì khách không thấy cổng này ở trang nạp ví." checked={s.pay_sepay_enabled === "1"} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12 }}>
            <div className="field"><label>Tên ngân hàng</label><input name="sepay_bank_name" defaultValue={s.sepay_bank_name} placeholder="MB Bank" /></div>
            <div className="field"><label>Mã ngân hàng (VietQR)</label><input name="sepay_bank_bin" defaultValue={s.sepay_bank_bin} placeholder="MB hoặc 970422" /></div>
            <div className="field"><label>Số tài khoản</label><input name="sepay_account_number" defaultValue={s.sepay_account_number} /></div>
            <div className="field"><label>Chủ tài khoản</label><input name="sepay_account_name" defaultValue={s.sepay_account_name} /></div>
            <div className="field"><label>Khoá webhook (API Key của SePay)</label><input name="sepay_secret" type="password" autoComplete="new-password" placeholder={secretHint(s.sepay_secret)} /></div>
          </div>
          <GatewayActions />
        </div>
      </form>
    </div>
  );
}
