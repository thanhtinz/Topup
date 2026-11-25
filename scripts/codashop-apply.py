#!/usr/bin/env python3
"""Áp ảnh gói Codashop (đợt browser thu 2026-11-24) vào các gói còn thiếu ảnh:
khớp theo ĐƠN VỊ + mệnh giá (chính xác trước, gần nhất theo log sau), gói đặc
biệt khớp theo tên. Đọc /tmp/all-pkgs.json, ghi /tmp/codashop-pkg.sql.
"""
import json
import math
import re

MCGG = "https://cdn1.codashop.com/images/2819_7773f6d6-034c-4f41-8314-19f0acc4063d_40ae905f33127e4e116de79607e55309_image/"
EAFC = "https://cdn1.codashop.com/images/826_219b1202-df20-4fe8-bfcb-d2689d381d31_823ff62524a33a1ea5aee54da1ea2dbe_image/"
LAD = "https://cdn1.codashop.com/images/916_44cc26e7-e747-4985-8345-ff81c0e03d17_LOVE%20AND%20DEEPSPACE_image/"
HONKAI_BCHIP = "https://cdn1.codashop.com/S/content/common/images/denom-image/HONKAI/honkai-impact_bchips.png"
HONKAI_CRYSTAL = "https://cdn1.codashop.com/S/content/common/images/denom-image/HONKAI/honkai-impact_crystal.png"
HONKAI_MONTHLY = "https://cdn1.codashop.com/S/content/common/images/denom-image/HONKAI/honkai-impact_monthlycard.png"

MAPS = {
    "Magic Chess Go Go": {
        "diamond": {55: MCGG + "d82daa464259e33bb8a8bc47203c2a04.png",
                    275: MCGG + "ee0ad04f84a047167782309906ce3c2a.png",
                    565: MCGG + "4a5e93cf5d6a3d7501a281774f2175f1.png",
                    1160: MCGG + "2d5bab70628c4ddc9a74e7a8c6114195.png",
                    1770: MCGG + "2d5bab70628c4ddc9a74e7a8c6114195.png",
                    2975: MCGG + "98e944d413859db664e72df177494ebf.png",
                    4165: MCGG + "9b37c0abd7f6a56a7a74881aeb09b48e.png",
                    6000: MCGG + "9b37c0abd7f6a56a7a74881aeb09b48e.png"},
        "named": {"weekly": MCGG + "50aaa23ffa956cdea7b85e5419c9f182.png",
                  "lukas": MCGG + "6ef00df729858de9c10be72ee2c8d3f1.png"},
    },
    "EAFC Mobile": {
        "point": {40: EAFC + "9c791f94113c5fffb593411867a0601b.png",
                  100: EAFC + "3dc2b799f5b68755bcb49d682c081a61.png",
                  520: EAFC + "3231a5af12d881c6a88ad4fe221f5fc4.png",
                  1070: EAFC + "a170279f4510f8f5734a423af9d02118.png",
                  2200: EAFC + "b53d2e47254fe8456dd35041cb4d8e7f.png",
                  5750: EAFC + "c35f0944a64a9109ccce9cbc24291c1e.png",
                  12000: EAFC + "453a1767f313ea05fb4fc838635dae37.png"},
        "silver": {39: EAFC + "a7f26a86ef3329f8e6f064a54e395902.png",
                   99: EAFC + "c30d05de57d0893291276d4335779ca5.png",
                   499: EAFC + "fdf2e2ce01d2885686d4c6b7f162cb33.png",
                   999: EAFC + "dc6c86afb0fba47aad21adc17d447255.png",
                   1999: EAFC + "adf04936c53da8a0202fae85ca43ed44.png",
                   4999: EAFC + "f27cdad088b1ab659041d0423a2f52c8.png",
                   9999: EAFC + "ab8debb7b199f570bb52d95ef6680ad1.png"},
    },
    "Love and Deepspace": {
        "crystal": {60: LAD + "60%20Crystals.png", 300: LAD + "300%20Crystals.png",
                    450: LAD + "450%20Crystals.png", 980: LAD + "980%20Crystals.png",
                    1980: LAD + "1980%20Crystals.png", 3280: LAD + "3280%20Crystals.png",
                    6480: LAD + "6480%20Crystals.png"},
        "named": {"companionship": LAD + "Companionship%20Pack.png",
                  "aurum": LAD + "Aurum%20Pass.png"},
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
    low = pname.lower()
    if game == "Honkai Impact 3rd":
        if "b-chip" in low or "bchip" in low or "b chip" in low:
            return HONKAI_BCHIP
        if "monthly" in low:
            return HONKAI_MONTHLY
        if "crystal" in low:
            return HONKAI_CRYSTAL
        return None
    spec = MAPS.get(game)
    if not spec:
        return None
    for key, url in spec.get("named", {}).items():
        if key in low:
            return url
    for unit, icons in spec.items():
        if unit == "named":
            continue
        if unit in low:
            return pick(icons, amount_of(pname))
    return None


def main() -> int:
    rows = json.load(open("/tmp/all-pkgs.json"))
    updates = []
    per_game: dict[str, int] = {}
    for r in rows:
        if r["img"] or r["gname"] not in ("Magic Chess Go Go", "EAFC Mobile", "Love and Deepspace", "Honkai Impact 3rd"):
            continue
        icon = icon_for(r["gname"], r["pname"])
        if icon:
            updates.append((r["pid"], icon))
            per_game[r["gname"]] = per_game.get(r["gname"], 0) + 1
    sql = "\n".join(f"UPDATE \"Package\" SET \"imageUrl\" = '{u}' WHERE id = {pid} AND \"imageUrl\" IS NULL;"
                    for pid, u in updates)
    open("/tmp/codashop-pkg.sql", "w").write(sql + "\n")
    print("updates:", len(updates), per_game)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
