import type { FloatingContact } from "@/lib/contact";

function glyph(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("zalo")) return <span style={{ fontWeight: 900, fontSize: 15, lineHeight: 1 }}>Z</span>;
  if (lower.includes("telegram")) return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>);
  if (lower.includes("facebook") || lower.includes("fanpage") || lower.includes("messenger")) return (<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.5 1.6-1.5h1.3V4.9c-.3 0-1.1-.1-2.1-.1-2.1 0-3.6 1.3-3.6 3.7V11H8.2v3h2.5v7h2.8Z" /></svg>);
  if (lower.includes("hotline") || lower.includes("điện thoại") || lower.includes("phone")) return (<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.13.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.45c.9.34 1.84.57 2.8.7A2 2 0 0 1 22 16.9Z" /></svg>);
  return <span style={{ fontWeight: 900, fontSize: 15, lineHeight: 1 }}>{name.trim().charAt(0).toUpperCase() || "?"}</span>;
}

export default function FloatingContacts({ items }: { items: FloatingContact[] }) {
  if (!items.length) return null;
  return (
    <div className="float-contacts">
      {items.map((it, i) => (
        <a key={i} href={it.href} target={it.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" title={it.name} className="fc-item">
          <span className="fc-label">{it.name}</span>
          {it.image ? (
            <img src={it.image} alt={it.name} className="fc-bubble" />
          ) : (
            <span className="fc-bubble" style={{ background: it.bg }}>{glyph(it.name)}</span>
          )}
        </a>
      ))}
    </div>
  );
}
