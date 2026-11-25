#!/usr/bin/env python3
"""Điền thể loại/banner/mô tả vòng 2 cho game còn thiếu:
1) Kế thừa từ game "anh em" trong cùng catalog (cùng game, khác bản khu vực —
   bỏ hậu tố (United States)/SEA/Global/PC/- Activision... khi so tên).
2) iTunes nhiều storefront (US, VN, SG, TH, PH, ID, MY, KR, JP, TW, HK) với
   khớp tên nghiêm ngặt và chỉ nhận thể loại game có trong bảng dịch.
Đọc /tmp/active-games.json, ghi /tmp/round2-fill.json.
"""
import json
import re
import time
import urllib.parse
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"}
GENRE_VI = {
    "action": "Hành động", "adventure": "Phiêu lưu", "roleplaying": "Nhập vai",
    "strategy": "Chiến thuật", "racing": "Đua xe", "simulation": "Mô phỏng",
    "puzzle": "Giải đố", "sports": "Thể thao", "casual": "Giải trí nhẹ",
    "board": "Cờ bàn", "card": "Thẻ bài", "music": "Âm nhạc", "trivia": "Đố vui",
    "word": "Ô chữ", "casino": "Casino", "family": "Gia đình",
    "education": "Giáo dục", "arcade": "Arcade", "entertainment": "Giải trí",
}
COUNTRIES = ["US", "VN", "SG", "TH", "PH", "ID", "MY", "KR", "JP", "TW", "HK"]


def norm(s: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9 ]", " ", s.lower()).split())


def base_name(name: str) -> str:
    b = re.sub(r"\([^)]*\)", " ", name)
    b = re.sub(r"\s+-\s+.*$", "", b)
    for suf in (" SEA", " Global", " PC", " Mobile", " NAEU"):
        if b.lower().endswith(suf.lower()):
            b = b[: -len(suf)]
    return " ".join(b.split()).strip()


def variants(name: str) -> list[str]:
    out: list[str] = []
    for v in (name, base_name(name)):
        if v and v not in out:
            out.append(v)
    return out


def fetch_json(url: str):
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read().decode("utf-8", "replace"))
    except Exception:
        return None


def genre_from(genres: list[str]) -> str | None:
    for g in genres:
        key = g.lower().replace(" ", "").replace("-", "")
        if key == "games":
            continue
        if key in GENRE_VI:
            return GENRE_VI[key]
    return None


def itunes_genre(name: str) -> str | None:
    for var in variants(name):
        nv = norm(var)
        for cc in COUNTRIES:
            data = fetch_json("https://itunes.apple.com/search?" + urllib.parse.urlencode(
                {"term": var, "entity": "software", "limit": 8, "country": cc}))
            time.sleep(0.15)
            if not data:
                continue
            for res in data.get("results", []):
                ns = norm(res.get("trackName", ""))
                if ns == nv or (len(nv) >= 5 and ns.startswith(nv)):
                    g = genre_from(res.get("genres") or [])
                    if g:
                        return g
    return None


def main() -> int:
    rows = json.load(open("/tmp/active-games.json"))
    fills: dict[int, dict] = {}

    # 1) Kế thừa từ anh em cùng catalog.
    groups: dict[str, list[dict]] = {}
    for g in rows:
        groups.setdefault(norm(base_name(g["name"])), []).append(g)
    for g in rows:
        sibs = [s for s in groups.get(norm(base_name(g["name"])), []) if s["id"] != g["id"]]
        if not sibs:
            continue
        e = fills.setdefault(g["id"], {})
        for field in ("genre", "banner", "desc"):
            if not g[field]:
                donor = next((s for s in sibs if s[field]), None)
                if donor:
                    e[field] = donor[field]
    print("sibling fills:", {k: v for k, v in fills.items() if v}, flush=True)

    # 2) iTunes đa storefront cho game còn thiếu thể loại.
    still = [g for g in rows if not g["genre"] and not fills.get(g["id"], {}).get("genre")]
    print(f"itunes round for {len(still)} games", flush=True)
    for g in still:
        genre = itunes_genre(g["name"])
        if genre:
            fills.setdefault(g["id"], {})["genre"] = genre
            print("  +", g["name"], "->", genre, flush=True)

    out = [{"id": gid, **{k: v for k, v in e.items() if v}} for gid, e in fills.items() if e]
    out = [o for o in out if len(o) > 1]
    json.dump(out, open("/tmp/round2-fill.json", "w"))
    counts = {}
    for o in out:
        for k in o:
            if k != "id":
                counts[k] = counts.get(k, 0) + 1
    print("DONE rows:", len(out), counts)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
