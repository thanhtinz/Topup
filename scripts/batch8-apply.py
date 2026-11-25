#!/usr/bin/env python3
"""Đợt 8: ảnh gói từ shop chính thức (trình duyệt tìm shop, URL trích từ
HTML/CDN của shop):
- Oxide Survival Island (shop.playoxide.com, Xsolla): coin packs theo mẫu
  "X + Y WEB BONUS", BP Coins theo mệnh giá, Battle Pass Elite <- ảnh Pass.
- Love Nikki (Smile.One): 14 cặp tên -> ảnh trích thẳng từ HTML trang;
  bản (S) lấy ảnh cùng loại bản (M).
Đọc /tmp/all-pkgs.json, ghi /tmp/batch8-pkg.sql (chỉ điền ô trống).
"""
import json
import re
import unicodedata

X = "https://cdn3.xsolla.com/image-proxy/rs:fit:3840:0/q:80/f:webp/static/img/misc/images/"
OXIDE = {
    "50 + 5 WEB BONUS": X + "c23f3da721f189d85a32daf923e806e5.png@webp",
    "50 Coins": X + "c23f3da721f189d85a32daf923e806e5.png@webp",
    "125 + 20 WEB BONUS": X + "d5f1b24a4eb4da5f74e09b7b1b8f609f.png@webp",
    "250 + 65 WEB BONUS": X + "c71082abb5cbf2683d79c5f312873ad1.png@webp",
    "500 + 175 WEB BONUS": X + "be674b70bc58e80ed6a8f31c89ce2e9b.png@webp",
    "1250 + 500 WEB BONUS": X + "5860975bfb09a58c3281089672a4b641.png@webp",
    "2500 + 1250 WEB BONUS": X + "066a361faa3199a1e46a6fbac180c15c.png@webp",
    "7500 + 3750 Web Bonus": X + "d7f41518f6ae59f406c869f76e3bf0c8.png@webp",
    "25 BP Coins": X + "82b4ae2b59c5abc0adce9d64b7a8d33b.png@webp",
    "75 BP Coins": X + "5926982f540b5edde615d59ebe1380fd.png@webp",
    "250 BP Coins": X + "431d535b8b47c38dc65029a66a117808.png@webp",
    "Battle Pass Elite": "https://cdn.xsolla.net/image-proxy/rs:fit:3840:0/q:80/f:webp/storage/merchant-bucket-prod/files/uploaded/751385/704d6c98b8958981d660ca277a5dfbf0.png@webp",
}

LN = dict(json.load(open("/tmp/ln-pairs.json")))
LN["Stamina Pack (S)"] = LN["Stamina Pack (M)"]
LN["Gold Pack (S)"] = LN["Gold Pack (M)"]
LN["Star Coin Pack (S)"] = LN["Star Coin Pack (M)"]

MAPS = {"Oxide Survival Island": OXIDE, "Love Nikki": LN}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return " ".join(re.sub(r"[^a-z0-9 ]", " ", s.lower().replace(",", "")).split())


def main() -> int:
    rows = json.load(open("/tmp/all-pkgs.json"))
    updates = []
    counts: dict[str, int] = {}
    for r in rows:
        if r["img"] or r["gname"] not in MAPS:
            continue
        m = {norm(k): v for k, v in MAPS[r["gname"]].items()}
        icon = m.get(norm(r["pname"]))
        if icon:
            updates.append((r["pid"], icon))
            counts[r["gname"]] = counts.get(r["gname"], 0) + 1
    sql = "\n".join(f"UPDATE \"Package\" SET \"imageUrl\" = '{u}' WHERE id = {pid} AND \"imageUrl\" IS NULL;"
                    for pid, u in updates)
    open("/tmp/batch8-pkg.sql", "w").write(sql + "\n")
    print("updates:", len(updates), counts)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
