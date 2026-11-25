// Nạp .env cho test chạy ngoài Next (Prisma client không tự nạp .env khi chạy bằng tsx)
try {
  (process as unknown as { loadEnvFile: (p?: string) => void }).loadEnvFile();
} catch {}
export {};
