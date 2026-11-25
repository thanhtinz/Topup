import { prisma } from "./db";
import type { Prisma } from "@prisma/client";


type Tx = Prisma.TransactionClient;

export async function notifyUser(userId: number, kind: string, title: string, body: string, link?: string, tx?: Tx) {
  try {
    const db = tx ?? prisma;
    await db.notification.create({ data: { userId, kind, title, body, link } });
  } catch {
  }
}

export async function getNotifications(userId: number, take = 10) {
  return prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take });
}

export async function countUnread(userId: number) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markAllRead(userId: number) {
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}
