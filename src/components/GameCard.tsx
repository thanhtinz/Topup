import Link from "next/link";
import type { Cur } from "@/lib/moneyfmt";
import type { Dict } from "@/lib/i18n";

export type GameCardData = {
  slug: string; name: string; cover: string; regions: string[];
  fromCents: number | null;
  ratingAvg: number; ratingCount: number; soldCount: number;
};

export default function GameCard({ game, lang, t }: { game: GameCardData; cur: Cur; lang: string; t: Dict }) {
  return (
    <Link className="card" href={`/game/${game.slug}`}>
      <div className="card-media">{game.cover ? <img src={game.cover} alt={game.name} referrerPolicy="no-referrer" /> : <span className="cover-fallback" aria-hidden>{game.name.trim().charAt(0).toUpperCase() || "?"}</span>}</div>
      <div className="card-body">
        <h3 className="card-name">{game.name}</h3>
        <p className="card-meta">
          <span className="star" aria-hidden>★</span>
          <b>{game.ratingAvg > 0 ? game.ratingAvg.toFixed(1) : "5.0"}</b>
          <span>({game.ratingCount.toLocaleString(lang === "en" ? "en-US" : "vi-VN")})</span>
          <span className="sep">|</span>
          <span>{t.sold} {game.soldCount.toLocaleString(lang === "en" ? "en-US" : "vi-VN")}</span>
        </p>
      </div>
    </Link>
  );
}
