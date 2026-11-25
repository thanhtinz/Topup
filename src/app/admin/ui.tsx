import Toast from "./Toast";
export function Msg({ msg, err }: { msg?: string; err?: string }) {
  return <Toast msg={msg} err={err} />;
}
export function Top({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="admin-top-row">
      <h1>{title}</h1>
      <div className="spacer" />
      <div style={{ display: "flex", gap: 8 }}>{children}</div>
    </div>
  );
}
