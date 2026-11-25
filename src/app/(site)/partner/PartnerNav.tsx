"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS: Array<{ href: string; label: string }> = [
  { href: "/partner", label: "Tổng quan" },
  { href: "/partner/profile", label: "Hồ sơ" },
  { href: "/partner/campaigns", label: "Chiến dịch" },
  { href: "/partner/deliverables", label: "Đầu việc" },
  { href: "/partner/documents", label: "Tài liệu" },
  { href: "/partner/financials", label: "Thanh toán" },
];

export function PartnerNav() {
  const path = usePathname();
  return (
    <nav style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "18px 0 22px" }}>
      {ITEMS.map((it) => {
        const active = it.href === "/partner" ? path === "/partner" : path.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              fontWeight: 600,
              fontSize: 14,
              textDecoration: "none",
              background: active ? "#0B63E5" : "#EEF2F7",
              color: active ? "#fff" : "#1F2A37",
            }}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
