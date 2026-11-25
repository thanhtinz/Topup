export function assertTestDb(): void {
  if (process.env.ALLOW_PROD_SCRIPTS === "1") return;
  const url = process.env.DATABASE_URL ?? "";
  let host = "";
  let dbName = "";
  try {
    const u = new URL(url);
    host = u.hostname;
    dbName = u.pathname.replace(/^\//, "");
  } catch {
    dbName = "";
  }
  const prodSignals: string[] = [];
  if (process.env.NODE_ENV === "production") prodSignals.push("NODE_ENV=production");
  if (dbName === "bnttopup") prodSignals.push('database "bnttopup"');
  if (host === "180.93.194.31") prodSignals.push("host VPS production");
  if (prodSignals.length) {
    throw new Error(
      `SCRIPT BỊ CHẶN: DATABASE_URL có dấu hiệu production (${prodSignals.join(", ")}). ` +
        "Script kiểm thử chỉ được chạy trên database test local. " +
        "Nếu thật sự cần chạy trên production, đặt ALLOW_PROD_SCRIPTS=1 một cách có ý thức.",
    );
  }
}
