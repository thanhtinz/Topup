const RULES: { re: RegExp; bg: string; fg: string; d: React.ReactNode }[] = [
  {
    re: /gacha|sparkle/i, bg: "#F0EAFE", fg: "#7C3AED",
    d: (<><path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4L12 3z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" /></>),
  },
  {
    re: /nhập vai|rpg|role/i, bg: "#FEF3E2", fg: "#D97706",
    d: (<><path d="M5.5 15.5a6.5 6.5 0 0 1 13 0" /><path d="M4 15.5h16" /><path d="M12 9v6.5" /><path d="M5.8 12.5C4 11.5 3 9.5 3.2 7c1.2 1.8 2.6 2.8 4.3 3.2" /><path d="M18.2 12.5c1.8-1 2.8-3 2.6-5.5-1.2 1.8-2.6 2.8-4.3 3.2" /></>),
  },
  {
    re: /hành động|action/i, bg: "#FDECEC", fg: "#DC2626",
    d: <polygon points="22.6,12.0 18.0,13.6 21.2,17.3 16.4,16.4 17.3,21.2 13.6,18.0 12.0,22.6 10.4,18.0 6.7,21.2 7.6,16.4 2.8,17.3 6.0,13.6 1.4,12.0 6.0,10.4 2.8,6.7 7.6,7.6 6.7,2.8 10.4,6.0 12.0,1.4 13.6,6.0 17.3,2.8 16.4,7.6 21.2,6.7 18.0,10.4" />,
  },
  {
    re: /chiến thuật|strategy/i, bg: "#E7F8EE", fg: "#16A34A",
    d: (<><path d="M6.5 4h2.6v3h2.3V4h2.2v3h2.3V4H18.5v5h-12z" /><path d="M8.5 9h7l.9 8h-8.8z" /><path d="M5.5 20.5h13" /><path d="M7 17h10v3.5H7z" /></>),
  },
  {
    re: /thể thao|sports/i, bg: "#E6F7FD", fg: "#0284C7",
    d: (<><rect x="3" y="4.5" width="18" height="12" rx="2" /><path d="M8 8.5v4" /><path d="M12 8.5v4" /><path d="M16 8.5v4" /><path d="M12 16.5V20" /><path d="M8.5 20.5h7" /></>),
  },
  {
    re: /đua xe|racing/i, bg: "#FDEAF3", fg: "#DB2777",
    d: (<><path d="M5.5 21.5v-18" /><path d="M5.5 4.5c2.5-1.2 4.5 1 7 .5 2-.4 3.5-1 5.5-.5v8c-2-.5-3.5.1-5.5.5-2.5.5-4.5-1.7-7-.5" /><path d="M9.5 4.6v3.2" /><path d="M13.5 4.9v3.4" /><path d="M9.5 8.6v3" /><path d="M13.5 9.1v3" /></>),
  },
  {
    re: /phiêu lưu|adventure/i, bg: "#EAF3FE", fg: "#0B63E5",
    d: (<><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" /></>),
  },
  {
    re: /mô phỏng|simulation/i, bg: "#E7F8EE", fg: "#15803D",
    d: (<><path d="M3 11l9-8 9 8" /><path d="M5 9.5V21h14V9.5" /><path d="M9.5 21v-6h5v6" /></>),
  },
  {
    re: /giải đố|puzzle/i, bg: "#EAF3FE", fg: "#2563EB",
    d: <path d="M9.5 5.2V4a2 2 0 0 1 4 0v1.2c0 .8.5 1.3 1.2 1.5l.6.2H19a2 2 0 0 1 2 2v3.7l-1.2-.3a2 2 0 0 0-2.4 2c0 .8.4 1.5 1.1 1.8l1.5.7V19a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-3.7l1.2.3a2 2 0 0 0 2.4-2c0-.8-.4-1.5-1.1-1.8L8 11V8.9a2 2 0 0 1 1.5-2l.6-.2c.7-.2 1.2-.7 1.2-1.5z" transform="scale(0.92) translate(1 1)" />,
  },
  {
    re: /âm nhạc|music|rhythm/i, bg: "#FDEAF3", fg: "#BE185D",
    d: (<><path d="M9 18V5l11-2v13" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="16" r="2.5" /></>),
  },
  {
    re: /thẻ bài|card/i, bg: "#E7F8EE", fg: "#15803D",
    d: (<><rect x="3" y="6" width="13" height="15" rx="2" transform="rotate(-8 3 6)" /><rect x="8" y="3" width="13" height="15" rx="2" /></>),
  },
  {
    re: /cờ bàn|board/i, bg: "#F0EAFE", fg: "#6D28D9",
    d: (<><path d="M7 20.5v-2.8c0-.9.4-1.7 1.1-2.2C6.9 14.3 6.2 12.6 6.2 10.8c0-1 .3-2 .8-2.9L5.2 5.6l2.7.6C8.7 4.9 10.2 4 12 4c3 0 5.4 2.4 5.4 5.4 0 .7-.1 1.3-.4 1.9l1.6 2.2-6.3.6c-.6 1.1-1.6 1.9-2.9 2.2v4.2" /><path d="M5.5 20.5h12" /><circle cx="10" cy="9.5" r=".4" fill="currentColor" /></>),
  },
  {
    re: /fps|bắn súng|shooter/i, bg: "#FDECEC", fg: "#B91C1C",
    d: (<><circle cx="12" cy="12" r="7.5" /><circle cx="12" cy="12" r="1" fill="currentColor" /><path d="M12 2.5v4" /><path d="M12 17.5v4" /><path d="M2.5 12h4" /><path d="M17.5 12h4" /></>),
  },
  {
    re: /thư giãn|casual|arcade/i, bg: "#E6F7FD", fg: "#0369A1",
    d: (<><path d="M6 9h12a4 4 0 0 1 4 4.6C22 16 20.4 17 19 17c-1 0-1.7-.5-2.4-1.2L15.4 14H8.6L7.4 15.8C6.7 16.5 6 17 5 17c-1.4 0-3-1-3-3.4C2 11 3.8 9 6 9z" /><path d="M7.5 11.5v3" /><path d="M6 13h3" /><circle cx="16.5" cy="12" r=".6" fill="currentColor" /><circle cx="18.5" cy="14" r=".6" fill="currentColor" /></>),
  },
];

const FALLBACK = { bg: "#EAF3FE", fg: "#0B63E5", d: (<><path d="M6 9h12a4 4 0 0 1 4 4.6C22 16 20.4 17 19 17c-1 0-1.7-.5-2.4-1.2L15.4 14H8.6L7.4 15.8C6.7 16.5 6 17 5 17c-1.4 0-3-1-3-3.4C2 11 3.8 9 6 9z" /><path d="M7.5 11.5v3" /><path d="M6 13h3" /><circle cx="16.5" cy="12" r=".6" fill="currentColor" /><circle cx="18.5" cy="14" r=".6" fill="currentColor" /></>) };

export default function GenreIcon({ genre }: { genre: string }) {
  const rule = RULES.find((r) => r.re.test(genre)) ?? FALLBACK;
  return (
    <span className="gicon" style={{ background: rule.bg, color: rule.fg }} aria-hidden>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{rule.d}</svg>
    </span>
  );
}
