import type { Prisma } from "@prisma/client";

export async function applyBalance(
  tx: Prisma.TransactionClient,
  userId: number,
  deltaCents: number,
  kind: string,
  ref?: string,
  note?: string,
  allowNegative = false,
): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ balanceCents: number }>>`
    SELECT "balanceCents" FROM "User" WHERE id = ${userId} FOR UPDATE`;
  if (!rows.length) throw new Error("USER_NOT_FOUND");
  const next = rows[0].balanceCents + deltaCents;
  if (next < 0 && !allowNegative) throw new Error("INSUFFICIENT_BALANCE");
  await tx.user.update({ where: { id: userId }, data: { balanceCents: next } });
  await tx.walletTxn.create({
    data: { userId, deltaCents, balanceAfter: next, kind, ref, note },
  });
  return next;
}
