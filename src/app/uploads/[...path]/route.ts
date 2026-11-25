import { readFile } from "node:fs/promises";
import path from "node:path";

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
  gif: "image/gif",
  ico: "image/x-icon",
};

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path ?? [];
  if (parts.length !== 1 || parts[0].includes("..") || parts[0].includes("/") || parts[0].includes("\\")) {
    return new Response("Not found", { status: 404 });
  }
  const name = parts[0];
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const type = TYPES[ext];
  if (!type) return new Response("Not found", { status: 404 });
  try {
    const buf = await readFile(path.join(process.cwd(), "public", "uploads", name));
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
