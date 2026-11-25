"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type NavItem = { href: string; label: string; icon: string; count?: number; countKey?: string; children?: NavItem[] };
export type NavGroup = { title: string; items: NavItem[] };

const P: Record<string, React.ReactNode> = {
  grid: (<><rect x="3.5" y="3.5" width="7" height="7" rx="1.8" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.8" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.8" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.8" /></>),
  box: (<><path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" /><path d="M4 7l8 4 8-4M12 11v10" /></>),
  layers: (<><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></>),
  receipt: (<><path d="M6 3.5h12V20l-2-1.4L14 20l-2-1.4L10 20l-2-1.4L6 20V3.5Z" /><path d="M9 8h6M9 12h6" /></>),
  tag: (<><path d="M3.5 12.5v-9h9L21 12l-8.5 8.5-9-8Z" /><circle cx="8" cy="8" r="1.6" /></>),
  image: (<><rect x="3.5" y="5" width="17" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m5 18 5-5 3 3 3.5-3.5L20 16" /></>),
  users: (<><circle cx="9" cy="8.5" r="3.5" /><path d="M3.5 20c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" /><path d="M16 5.4a3.5 3.5 0 0 1 0 6.2M17.8 15.4c1.5.7 2.4 2.2 2.7 4.6" /></>),
  wallet: (<><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18" /><circle cx="16.8" cy="14.8" r="1.2" /></>),
  server: (<><rect x="3.5" y="4" width="17" height="7" rx="2" /><rect x="3.5" y="13" width="17" height="7" rx="2" /><circle cx="7.5" cy="7.5" r="1" fill="currentColor" /><circle cx="7.5" cy="16.5" r="1" fill="currentColor" /></>),
  card: (<><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="M3 10h18M7 15h4" /></>),
  puzzle: (<><rect x="3.5" y="3.5" width="7" height="7" rx="1.8" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.8" /><path d="M13.5 6.8h3.2a3.3 3.3 0 1 0 3.3-3.3M6.8 13.5v3.2a3.3 3.3 0 1 0 3.3 3.3" /></>),
  coins: (<><circle cx="9" cy="9" r="5.5" /><path d="M14.5 5.6a5.5 5.5 0 1 1-4 8.9" /></>),
  search: (<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-3.8-3.8" /></>),
  gear: (<><circle cx="12" cy="12" r="3.2" /><path d="M12 3.5v2.4M12 18.1v2.4M3.5 12h2.4M18.1 12h2.4M6 6l1.7 1.7M16.3 16.3 18 18M18 6l-1.7 1.7M7.7 16.3 6 18" /></>),
  list: (<><path d="M9 6h11M9 12h11M9 18h11" /><path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2" /></>),
  globe: (<><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.4 3.8 5.2 3.8 8.5s-1.3 6.1-3.8 8.5c-2.5-2.4-3.8-5.2-3.8-8.5s1.3-6.1 3.8-8.5Z" /></>),
  chat: (<><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" /></>),
  mail: (<><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="m3.5 7 8.5 6 8.5-6" /></>),
  chart: (<><path d="M4 20V10M10 20V4M16 20v-7M21 20H3" /></>),
  flag: (<><path d="M5 21V4" /><path d="M5 4h12l-2.5 4L17 12H5" /></>),
  chev: (<><path d="m6 9 6 6 6-6" /></>),
};

export function Icon({ name, size = 19 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {P[name] ?? P.grid}
    </svg>
  );
}

function Badge({ item }: { item: NavItem }) {
  if (!item.countKey && !item.count) return null;
  return (
    <span className="nav-count" data-count-key={item.countKey} style={item.count ? undefined : { display: "none" }}>
      {item.count ?? 0}
    </span>
  );
}

function ItemRow({ item, path, depth = 0 }: { item: NavItem; path: string; depth?: number }) {
  const hasKids = !!item.children?.length;
  const inSection = path === item.href || path.startsWith(item.href + "/");
  const [open, setOpen] = useState(inSection);
  const active = item.href === "/admin" || item.href === "/admin/providers"
    ? path === item.href
    : depth > 0
      ? path === item.href
      : path === item.href || path.startsWith(item.href + "/");
  return (
    <div className={hasKids ? "nav-parent" : undefined}>
      <div className={`nav-row${depth ? " sub" : ""}`}>
        <Link href={item.href} className={`nav-item grow${active && !hasKids ? " active" : ""}${hasKids && inSection ? " active-soft" : ""}`}>
          <Icon name={item.icon} size={depth ? 17 : 19} />
          <span>{item.label}</span>
          <Badge item={item} />
        </Link>
        {hasKids && (
          <button type="button" className={`nav-toggle${open ? " open" : ""}`} aria-label={open ? "Thu gọn" : "Mở rộng"} onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}>
            <Icon name="chev" size={16} />
          </button>
        )}
      </div>
      {hasKids && open && (
        <div className="nav-sub">
          {item.children!.map((c) => (
            <ItemRow key={c.href + c.label} item={c} path={path} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminNav({ groups }: { groups: NavGroup[] }) {
  const path = usePathname();
  const closeDrawer = () => document.querySelector(".admin-shell")?.classList.remove("nav-open");
  return (
    <nav className="admin-nav" aria-label="Admin" onClick={closeDrawer}>
      {groups.map((g) => (
        <div key={g.title}>
          <p className="nav-group">{g.title}</p>
          {g.items.map((it) => (
            <ItemRow key={it.href + it.label} item={it} path={path} />
          ))}
        </div>
      ))}
    </nav>
  );
}
