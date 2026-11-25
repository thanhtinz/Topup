import { prisma } from "./db";

export async function hasAdmin(): Promise<boolean> {
  const n = await prisma.user.count({ where: { role: "ADMIN" } }).catch(() => 1);
  return n > 0;
}
