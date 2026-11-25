import { prisma } from "./db";

export const TICKET_STATUS_LABEL: Record<string, string> = {
  OPEN: "Chờ hỗ trợ",
  ANSWERED: "Đã trả lời",
  CLOSED: "Đã đóng",
};

export async function createTicket(userId: number, subject: string, body: string, orderCode?: string | null) {
  const t = await prisma.ticket.create({
    data: { code: "TMP", userId, subject, orderCode: orderCode || null, status: "OPEN" },
  });
  const code = "TK" + String(t.id).padStart(6, "0");
  await prisma.ticket.update({ where: { id: t.id }, data: { code } });
  await prisma.ticketMessage.create({ data: { ticketId: t.id, authorId: userId, fromStaff: false, body } });
  return { ...t, code };
}
