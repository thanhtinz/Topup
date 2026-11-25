#!/usr/bin/env python3
"""Áp ảnh gói Codashop đợt 2 (Wild Rift, League of Legends, Super Sus — thu qua
browser 2026-11-24) vào gói còn thiếu ảnh: khớp mệnh giá chính xác trước, gần
nhất theo log sau; gói tên riêng khớp theo từ khoá. Đọc /tmp/all-pkgs.json,
ghi /tmp/codashop2-pkg.sql.
"""
import json
import math
import re

WR = "https://cdn1.codashop.com/images/420_1db19a77-4479-4926-b339-2de86affe7d7_"
LOL = "https://cdn1.codashop.com/images/556_5a3a81fa-3ba3-4a3d-82c4-9ba85d04b3bb_e1d0bbe910e3eb4d973973a4de3c5ddd_image/"
SUS = "https://cdn1.codashop.com/S/content/common/images/denom-image/Super_Sus/"

MAPS = {
    "Wild Rift": {
        "amount": {425: WR + "5f4dcf2de6b94a5b6a7a5f5e3b8a3bb5_image/8bb9889b136f7ec3bdb65c1cc921fa7e.png",
                   1000: WR + "bc54c3f6d1c74d14afc0e00d0a9c4a4d_image/013aa256bd6a56d6514f2c01ad0aba34.png",
                   1850: WR + "9bc9e79ca4b04c0f9b8c7dd7e8dba1b1_image/ec0c56eb5d6a3d558b5f6a80206d8ccc.png",
                   3275: WR + "3b5e50f5b09c4a15a8a9ba1f5ef3fb7c_image/1c838777efd025a4480048ca2ac760b3.png",
                   4800: WR + "6a5f3f1d7c9e4b1d8d5a3c9f0e2b4a6d_image/1fd6b8b40423bab66dd51840a80f787f.png",
                   10000: WR + "d4e8f2a6b0c1d3e5f7a8b9c0d1e2f3a4_image/9c8f8acb8181bf61eceba1e955b74692.png"},
        "named": {"stellacorn": WR + "6907880b44941404c2e73e303293cdd9_image/533227040281fdd3ea5d237a01dfa642.png",
                  "celestial": WR + "6907880b44941404c2e73e303293cdd9_image/702a1dbce5fdcdc073bd274888ab05fc.png"},
    },
    "League of Legends": {
        "amount": {575: LOL + "5367ca6f9c4514557204be78c4ae870b.png",
                   1380: LOL + "40b83c659a13b2cc608d6b99bfcf0f65.png",
                   2800: LOL + "3e825354d91b4c1038b2e175c11d55c8.png",
                   4500: LOL + "73e14d912bf983fb70d40dd4a6febe6c.png",
                   6500: LOL + "7fcefd3fbb54c8b22ef7d090cf06bc16.png",
                   13500: LOL + "edcf799c9fa3bc1aa5b257c7a411563d.png"},
        "named": {},
    },
    "Super Sus": {
        "amount": {100: SUS + "100_Goldstar_100.png",
                   310: SUS + "310_Goldstar_310.png",
                   520: SUS + "520_Goldstar_520.png",
                   1060: SUS + "1060_Goldstar_1060.png",
                   2180: SUS + "2180_Goldstar_2180.png",
                   5600: SUS + "5600_Goldstar_5600.png"},
        "named": {"super pass bundle": SUS + "Super_Pass_Bundle_Super_Pass_Bundle.png",
                  "super pass": SUS + "Super_Pass_Super_Pass.png",
                  "weekly": SUS + "Weekly_Card_Weekly_Card.png",
                  "monthly": SUS + "Monthly_Card_Monthly_Card.png",
                  "vip": SUS + "Super_VIP_Card_Super_VIP_Card.png"},
    },
}


def amount_of(name: str) -> int | None:
    m = re.search(r"(\d{1,3}(?:[.,]\d{3})+|\d+)", name)
    if not m:
        return None
    n = int(m.group(1).replace(".", "").replace(",", ""))
    return n if n > 0 else None


def pick(icons: dict[int, str], amount: int | None) -> str | None:
    if not icons or amount is None:
        return None
    if amount in icons:
        return icons[amount]
    best = min(icons.keys(), key=lambda k: abs(math.log(amount / k)))
    return icons[best]


def icon_for(game: str, pname: str) -> str | None:
    spec = MAPS.get(game)
    if not spec:
        return None
    low = pname.lower()
    for key, url in spec["named"].items():
        if key in low:
            return url
    return pick(spec["amount"], amount_of(pname))


def main() -> int:
    rows = json.load(open("/tmp/all-pkgs.json"))
    updates = []
    per_game: dict[str, int] = {}
    for r in rows:
        if r["img"] or r["gname"] not in MAPS:
            continue
        icon = icon_for(r["gname"], r["pname"])
        if icon:
            updates.append((r["pid"], icon))
            per_game[r["gname"]] = per_game.get(r["gname"], 0) + 1
    sql = "\n".join(f"UPDATE \"Package\" SET \"imageUrl\" = '{u}' WHERE id = {pid} AND \"imageUrl\" IS NULL;"
                    for pid, u in updates)
    open("/tmp/codashop2-pkg.sql", "w").write(sql + "\n")
    print("updates:", len(updates), per_game)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
