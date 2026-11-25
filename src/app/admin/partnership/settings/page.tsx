import { Top, Msg } from "../../ui";
import { partnershipPaymentMethods } from "@/lib/partnership";
import { savePartnerSettingsAction } from "../actions";

export const dynamic = "force-dynamic";

const METHODS: Array<[string, string]> = [
  ["USDT", "USDT (crypto)"],
  ["BANK", "Chuyển khoản ngân hàng VN"],
  ["PAYPAL", "PayPal (chỉ bật khi cần — mặc định tắt)"],
];

export default async function AdminPartnershipSettings({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { msg, err } = await searchParams;
  const methods = await partnershipPaymentMethods();

  return (
    <div>
      <Top title="Partnership — Cài đặt" />
      <Msg msg={msg} err={err} />
      <div className="admin-card" style={{ maxWidth: 640 }}>
        <h2 style={{ marginBottom: 10 }}>Phương thức chi trả cho Partner</h2>
        <p className="muted" style={{ marginBottom: 12 }}>Chỉ phương thức đang bật mới chọn được khi tạo khoản chi. Mặc định: USDT + chuyển khoản ngân hàng.</p>
        <form action={savePartnerSettingsAction} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {METHODS.map(([code, label]) => (
            <label key={code} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14.5 }}>
              <input type="checkbox" name={`m_${code}`} value="1" defaultChecked={methods.includes(code)} /> {label}
            </label>
          ))}
          <button className="btn btn-dark" type="submit" style={{ alignSelf: "flex-start" }}>Lưu cài đặt</button>
        </form>
      </div>
    </div>
  );
}
