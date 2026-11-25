export const ORDER_GROUPS = [
  { key: "wait", label: "Chờ xử lý", statuses: ["PENDING"] },
  { key: "doing", label: "Đang giao", statuses: ["PROCESSING", "PARTIAL"] },
  { key: "done", label: "Hoàn thành", statuses: ["DELIVERED"] },
  { key: "cancel", label: "Đã hủy", statuses: ["CANCELLED", "FAILED"] },
  { key: "refund", label: "Hoàn tiền", statuses: ["REFUNDED"] },
] as const;

export function orderGroup(key: string | undefined) {
  return ORDER_GROUPS.find((g) => g.key === key);
}

export function groupOfStatus(status: string) {
  return ORDER_GROUPS.find((g) => (g.statuses as readonly string[]).includes(status));
}
