import { prisma } from "./db";
import { getSettings, setSetting, audit } from "./settings";
import { syncProvider } from "./providers";

export type SyncState = {
  status: "idle" | "running" | "done" | "error";
  phase: string;
  done: number;
  total: number;
  games: number;
  packages: number;
  message: string;
  startedAt: number;
  finishedAt: number;
};

const IDLE: SyncState = {
  status: "idle", phase: "", done: 0, total: 0, games: 0, packages: 0,
  message: "", startedAt: 0, finishedAt: 0,
};

export async function readSyncState(code: string): Promise<SyncState> {
  const row = await prisma.setting.findUnique({ where: { key: `sync_state_${code}` } }).catch(() => null);
  if (!row?.value) return IDLE;
  try {
    return { ...IDLE, ...(JSON.parse(row.value) as Partial<SyncState>) };
  } catch {
    return IDLE;
  }
}

async function writeSyncState(code: string, st: SyncState) {
  await setSetting(`sync_state_${code}`, JSON.stringify(st)).catch(() => {});
}

function humanError(code: string, raw: string): string {
  if (raw === "PROVIDER_NOT_CONFIGURED") return "Chưa cấu hình khoá API hoặc nhà cung cấp đang tắt — đồng bộ dừng.";
  if (raw === "PROVIDER_UNREACHABLE") return "Không kết nối được tới nhà cung cấp — kiểm tra mạng và thử lại.";
  if (raw === "NO_FX_RATE") return "Chưa có tỉ giá trung tâm — đồng bộ Eris dừng (vào Tiền tệ để đặt tỉ giá VND).";
  const biz = raw.match(/^ERIS_CODE_(\d+)$/);
  if (biz) {
    if (biz[1] === "401" || biz[1] === "403") return "Khoá API Eris bị từ chối — kiểm tra lại khoá ở trang cấu hình nguồn.";
    if (biz[1] === "402") return "Số dư ví Eris không đủ để thực hiện thao tác này.";
    return `Nhà cung cấp Eris báo lỗi nghiệp vụ (mã ${biz[1]}).`;
  }
  const m = raw.match(/^(FZR|ERIS)_HTTP_(\d+)$/);
  if (m) {
    if (m[2] === "401" || m[2] === "403") return `Khoá API bị nhà cung cấp từ chối (HTTP ${m[2]}) — kiểm tra lại khoá.`;
    return `Nhà cung cấp trả lỗi HTTP ${m[2]} — thử lại sau.`;
  }
  return `Đồng bộ lỗi: ${raw}`;
}

export async function runCatalogSync(code: "FZR" | "ERIS"): Promise<SyncState> {
  const cur = await readSyncState(code);
  if (cur.status === "running" && Date.now() - cur.startedAt < 15 * 60 * 1000) return cur;

  const st: SyncState = {
    status: "running", phase: "Đang kết nối nhà cung cấp...", done: 0, total: 0,
    games: 0, packages: 0, message: "", startedAt: Date.now(), finishedAt: 0,
  };
  await writeSyncState(code, st);

  let lastWrite = 0;
  const onProgress = (p: { phase: string; done: number; total: number }) => {
    st.phase = p.phase;
    st.done = p.done;
    st.total = p.total;
    const now = Date.now();
    if (now - lastWrite > 500 || p.done >= p.total) {
      lastWrite = now;
      void writeSyncState(code, { ...st });
    }
  };

  try {
    const s = await getSettings();
    const vnd = await prisma.currency.findUnique({ where: { code: "VND" } }).catch(() => null);
    const rate = (vnd && vnd.ratePerUsd > 0 ? vnd.ratePerUsd : Number(s.fx_usd_vnd)) || 0;
    if (code === "ERIS" && !rate) throw new Error("NO_FX_RATE");
    const result = await syncProvider(code, rate, onProgress);
    if ("error" in result) throw new Error(result.error);
    if (code === "FZR") {
      try {
        const { telegramConfig, syncTelegramCatalog } = await import("./telegram");
        if ((await telegramConfig()).enabled) await syncTelegramCatalog();
      } catch { /* bỏ qua — xem ghi chú trên */ }
    }
    st.status = "done";
    st.phase = "Hoàn tất";
    st.games = result.games;
    st.packages = result.packages;
    st.message = `Đồng bộ xong: thêm ${result.games} game mới, ${result.packages} gói đã cập nhật vào kho.`;
    void import("./enrich").then((m) => m.runEnrichment()).catch(() => {});
  } catch (e) {
    st.status = "error";
    st.phase = "Đã dừng";
    st.message = humanError(code, e instanceof Error ? e.message : "UNKNOWN");
  }
  st.finishedAt = Date.now();
  await writeSyncState(code, st);
  return st;
}

export async function runSyncAll(adminId?: number): Promise<SyncState> {
  const code = "ALL";
  const cur = await readSyncState(code);
  if (cur.status === "running" && Date.now() - cur.startedAt < 15 * 60 * 1000) return cur;

  const st: SyncState = {
    status: "running", phase: "Đang bắt đầu...", done: 0, total: 0,
    games: 0, packages: 0, message: "", startedAt: Date.now(), finishedAt: 0,
  };
  await writeSyncState(code, st);

  const providers = await prisma.provider.findMany({ where: { enabled: true } });
  const codes = providers.map((p) => p.code).filter((c): c is "FZR" | "ERIS" => c === "FZR" || c === "ERIS");
  if (!codes.length) {
    st.status = "error";
    st.phase = "Đã dừng";
    st.message = "Chưa có nguồn nào đang bật — vào trang từng nguồn để bật và điền khoá API trước.";
    st.finishedAt = Date.now();
    await writeSyncState(code, st);
    return st;
  }

  const parts: string[] = [];
  let succeeded = 0;
  for (const c of codes) {
    st.phase = `Đang đồng bộ ${c}...`;
    st.done = 0;
    st.total = 0;
    await writeSyncState(code, { ...st });
    const before = await readSyncState(c);
    void runCatalogSync(c).catch(() => {});
    let sawRunning = before.status === "running";
    let sub = before;
    const deadline = Date.now() + 16 * 60 * 1000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 700));
      sub = await readSyncState(c).catch(() => sub);
      if (sub.status === "running") {
        sawRunning = true;
        st.phase = `${c}: ${sub.phase}`;
        st.done = sub.done;
        st.total = sub.total;
        await writeSyncState(code, { ...st });
      } else if (sawRunning || sub.startedAt !== before.startedAt) {
        break;
      }
    }
    if (sub.status === "done") {
      succeeded++;
      st.games += sub.games;
      st.packages += sub.packages;
      parts.push(`${c}: ${sub.packages.toLocaleString("vi-VN")} gói, ${sub.games} game mới`);
      if (adminId) await audit(adminId, "provider.sync", `${c} ${sub.packages} gói (đồng bộ tất cả)`).catch(() => {});
    } else {
      parts.push(`${c}: ${sub.message || "đồng bộ lỗi"}`);
    }
  }

  st.status = succeeded > 0 ? "done" : "error";
  st.phase = "Hoàn tất";
  st.done = st.total;
  st.message = (succeeded > 0 ? "Đồng bộ nguồn xong — " : "Đồng bộ nguồn thất bại — ") + parts.join(" · ");
  st.finishedAt = Date.now();
  await writeSyncState(code, st);
  return st;
}

function humanGiftError(raw: string): string {
  if (raw === "FZR_GIFT_LIST_429") return "FZR giới hạn lấy danh sách Steam Gift tối đa 1 lần mỗi 3 phút — hãy thử lại sau ít phút.";
  if (raw === "PROVIDER_NOT_CONFIGURED") return "Chưa cấu hình khoá API FZR hoặc nhà cung cấp đang tắt — đồng bộ dừng.";
  if (raw === "FZR_GIFT_LIST_EMPTY") return "FZR trả danh sách rỗng — thử lại sau ít phút.";
  const m = raw.match(/^FZR_HTTP_(\d+)$/);
  if (m) return `FZR trả lỗi HTTP ${m[1]} — thử lại sau.`;
  return `Đồng bộ lỗi: ${raw}`;
}

export async function runGiftSync(adminId?: number): Promise<SyncState> {
  const code = "STEAMGIFT";
  const cur = await readSyncState(code);
  if (cur.status === "running" && Date.now() - cur.startedAt < 15 * 60 * 1000) return cur;

  const st: SyncState = {
    status: "running", phase: "Đang kết nối FZR...", done: 0, total: 0,
    games: 0, packages: 0, message: "", startedAt: Date.now(), finishedAt: 0,
  };
  await writeSyncState(code, st);

  let lastWrite = 0;
  const onProgress = (p: { phase: string; done: number; total: number }) => {
    st.phase = p.phase;
    st.done = p.done;
    st.total = p.total;
    const now = Date.now();
    if (now - lastWrite > 500 || (p.total > 0 && p.done >= p.total)) {
      lastWrite = now;
      void writeSyncState(code, { ...st });
    }
  };

  try {
    const { syncGiftCatalog } = await import("./steamgift");
    const r = await syncGiftCatalog(onProgress);
    st.status = "done";
    st.phase = "Hoàn tất";
    st.done = r.count;
    st.total = r.count;
    st.games = r.count;
    st.message = `Đồng bộ xong: ${r.count.toLocaleString("vi-VN")} game Steam Gift đang bán trong kho.`;
    if (adminId) await audit(adminId, "steamgift.catalog.sync", `${r.count}/${r.total}`).catch(() => {});
  } catch (e) {
    st.status = "error";
    st.phase = "Đã dừng";
    st.message = humanGiftError(e instanceof Error ? e.message : "UNKNOWN");
  }
  st.finishedAt = Date.now();
  await writeSyncState(code, st);
  return st;
}
