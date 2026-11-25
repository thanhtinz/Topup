"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Banner = { gameSlug: string; gameName: string; image: string; icon?: string; priceLabel?: string };

export default function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % banners.length), 5000);
    return () => clearInterval(t);
  }, [banners.length]);
  if (!banners.length) return null;
  const b = banners[idx % banners.length];
  return (
    <section className="banner-sec" aria-label="Giới thiệu">
      <div className="container">
        <Link className="banner" href={`/game/${b.gameSlug}`} aria-label={b.gameName}>
          <img className="banner-bg" src={b.image} alt={b.gameName} referrerPolicy="no-referrer" />
          <div className="banner-info">
            <span className="banner-icon"><img src={b.icon ?? b.image} alt="" referrerPolicy="no-referrer" /></span>
            <span>
              <span className="banner-name">{b.gameName}</span>
              {b.priceLabel && <span className="banner-price">{b.priceLabel}</span>}
            </span>
          </div>
          {banners.length > 1 && (
            <div className="banner-dots" aria-hidden="true">
              {banners.map((_, i) => <i key={i} className={i === idx ? "on" : ""} />)}
            </div>
          )}
        </Link>
      </div>
    </section>
  );
}
