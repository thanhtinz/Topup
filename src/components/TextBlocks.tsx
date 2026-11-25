export default function TextBlocks({ content, siteName, supportEmail }: { content: string; siteName: string; supportEmail: string }) {
  const fill = (x: string) => x.replaceAll("{site_name}", siteName).replaceAll("{support_email}", supportEmail);
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    <>
      {lines.map((l, i) =>
        l.startsWith("# ") ? <h2 key={i}>{fill(l.slice(2))}</h2> : <p key={i}>{fill(l)}</p>,
      )}
    </>
  );
}
