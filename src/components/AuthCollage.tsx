const SPOTS = [
  { left: -28, top: -34, width: 184, rot: -10 },
  { left: 88, top: -46, width: 154, rot: 7 },
  { left: 200, top: -30, width: 174, rot: -6 },
  { left: 330, top: -44, width: 164, rot: 9 },
  { left: -18, top: 118, width: 148, rot: 8 },
  { left: 96, top: 148, width: 132, rot: -8 },
  { left: 196, top: 128, width: 154, rot: 6 },
  { left: 316, top: 148, width: 144, rot: -9 },
  { left: 404, top: 108, width: 132, rot: 7 },
  { left: 148, top: 52, width: 120, rot: -13 },
];

export default function AuthCollage({ covers }: { covers: string[] }) {
  return (
    <div className={`auth-top${covers.length ? "" : " auth-top--empty"}`} aria-hidden="true">
      {covers.slice(0, 10).map((c, i) => {
        const p = SPOTS[i % SPOTS.length];
        return (
          <img
            key={i}
            src={c}
            alt=""
            referrerPolicy="no-referrer"
            style={{ left: p.left, top: p.top, width: p.width, height: p.width * 1.3, transform: `rotate(${p.rot}deg)` }}
          />
        );
      })}
    </div>
  );
}
