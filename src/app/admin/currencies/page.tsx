import { prisma } from "@/lib/db";
import { Top, Msg } from "../ui";
import { saveCurrencyAction, setDefaultCurrencyAction, deleteCurrencyAction } from "../actions";

export const dynamic = "force-dynamic";

const inputStyle: React.CSSProperties = { height: 36, borderRadius: 9, border: "1px solid #D8DFEA", padding: "0 10px", fontFamily: "inherit", fontSize: 14 };

export default async function AdminCurrencies({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { msg, err } = await searchParams;
  const currencies = await prisma.currency.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <div>
      <Top title="Tiền tệ" />
      <Msg msg={msg} err={err} />
      <div className="admin-card">
        <h2>Danh sách tiền tệ</h2>
        <p className="muted" style={{ marginBottom: 14 }}>Tỉ giá do bạn tự đặt tại đây; giá khách thấy = giá gốc USD × tỉ giá của tiền tệ họ chọn.</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Mã</th><th>Tên</th><th>Ký hiệu</th><th>Tỉ giá / 1 USD</th><th>Số lẻ</th><th>Bật</th><th>Mặc định</th><th></th></tr></thead>
            <tbody>
              {currencies.map((c) => (
                <tr key={c.code}>
                  <td><b>{c.code}</b></td>
                  <td>
                    <form action={saveCurrencyAction} className="inline-form" id={`cur-${c.code}`}>
                      <input type="hidden" name="code" value={c.code} />
                    </form>
                    <input name="name" form={`cur-${c.code}`} defaultValue={c.name} style={{ ...inputStyle, width: 150 }} />
                  </td>
                  <td><input name="symbol" form={`cur-${c.code}`} defaultValue={c.symbol} style={{ ...inputStyle, width: 56 }} /></td>
                  <td><input name="rate" form={`cur-${c.code}`} type="number" step="any" min="0" defaultValue={c.ratePerUsd} style={{ ...inputStyle, width: 110 }} /></td>
                  <td><input name="decimals" form={`cur-${c.code}`} type="number" min={0} max={4} defaultValue={c.decimals} style={{ ...inputStyle, width: 60 }} /></td>
                  <td>
                    <select name="enabled" form={`cur-${c.code}`} defaultValue={c.enabled ? "1" : "0"} style={inputStyle}>
                      <option value="1">Bật</option><option value="0">Tắt</option>
                    </select>
                  </td>
                  <td>{c.isDefault ? <span className="badge blue">Mặc định</span> : (
                    <form action={setDefaultCurrencyAction} className="inline-form">
                      <input type="hidden" name="code" value={c.code} />
                      <button className="btn btn-ghost btn-sm" type="submit">Đặt mặc định</button>
                    </form>
                  )}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn btn-accent btn-sm" form={`cur-${c.code}`} type="submit">Lưu</button>{" "}
                    {c.code !== "USD" && (
                      <form action={deleteCurrencyAction} className="inline-form">
                        <input type="hidden" name="code" value={c.code} />
                        <button className="btn btn-danger btn-sm" type="submit">Xoá</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="admin-card">
        <h2>Thêm tiền tệ</h2>
        <form action={saveCurrencyAction} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
          <div className="field"><label>Mã (3 chữ cái)</label><input name="code" required placeholder="JPY" /></div>
          <div className="field"><label>Tên</label><input name="name" required placeholder="Yên Nhật" /></div>
          <div className="field"><label>Ký hiệu</label><input name="symbol" placeholder="¥" /></div>
          <div className="field"><label>Tỉ giá / 1 USD</label><input name="rate" type="number" step="any" min="0" required /></div>
          <div className="field"><label>Số chữ số lẻ</label><input name="decimals" type="number" min={0} max={4} defaultValue={2} /></div>
          <input type="hidden" name="enabled" value="1" />
          <div className="field" style={{ display: "flex", alignItems: "flex-end" }}><button className="btn btn-primary" type="submit">Thêm tiền tệ</button></div>
        </form>
      </div>
    </div>
  );
}
