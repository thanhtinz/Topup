#!/usr/bin/env python3
"""Áp ảnh web nạp chính thức đợt 5: Ludus (Xsolla — khớp tên mô tả + đơn vị),
Knives Out / Racing Master / Sword of Justice / Dunk City (NetEase GamesClub —
khớp mệnh giá gần nhất cùng đơn vị), Garena Delta Force (mọi Delta Coin dùng
chung 1 icon như Free Fire/Undawn). Đọc /tmp/all-pkgs.json, ghi /tmp/netease-pkg.sql.
"""
import json
import math
import re

XS = "https://cdn3.xsolla.com/img/misc/images/"
LUDUS_NAMED = {
    "small pile of gold": XS + "04d50f22b8051651dfbf5d3a35e4328a.png",
    "piggy bank of gold": XS + "948b9932af7352927765636db4b99db5.png",
    "carpetbag of gold": XS + "7f3984081ab4e1f1b7001b54e5f88407.png",
    "goblet of gold": XS + "204a41371d89c0f2ccfc0818ec3676d1.png",
    "strongbox of gold": XS + "dc7388bddee8b01389c1ac37cae8da15.png",
    "small pile of emeralds": XS + "e245b18d1a8de31730e52b3c179439ab.png",
    "pouch of emeralds": XS + "793a557f14a532a04293b1cac81b7a3d.png",
    "sack of emeralds": XS + "f80aee5b2cc0f2cc8cc6c6c96d5b3bb6.png",
    "chest of emeralds": XS + "c5d8a86da6e4fe2bdb1ebfcbfb7a3d76.png",
    "pot of emeralds": XS + "48e2e1a5a4a6bdc04e0e7c0d4e40c8bc.png",
    "a casket of crystals": XS + "12fbf4eb4f6f2f10ea6c94ebdb9e2c0c.png",
    "a tub of crystals": XS + "870cf9b698925f20c899fd8e1982fc29.png",
}
LUDUS_AMT = {"gold": {5000: LUDUS_NAMED["small pile of gold"], 25000: LUDUS_NAMED["piggy bank of gold"],
                      60000: LUDUS_NAMED["carpetbag of gold"], 140000: LUDUS_NAMED["goblet of gold"],
                      350000: LUDUS_NAMED["strongbox of gold"]},
             "emerald": {650: LUDUS_NAMED["small pile of emeralds"], 1500: LUDUS_NAMED["pouch of emeralds"],
                         3200: LUDUS_NAMED["sack of emeralds"], 8300: LUDUS_NAMED["chest of emeralds"],
                         17500: LUDUS_NAMED["pot of emeralds"]},
             "crystal": {50: LUDUS_NAMED["a casket of crystals"], 150: LUDUS_NAMED["a tub of crystals"]}}

EB = "http://hyxd.fp.ps.easebar.com/file/"
KNIVES = {6280: EB + "6862618c3efb661834abfd34zUumDCDd06?fop=imageView/6/f/webp/q/90",
          80: EB + "6904400bc4db765fc364b5e9hHAC7V8D06?fop=imageView/6/f/webp/q/90",
          240: EB + "6904400b2d0f0be45be3da653Emc4RQw06?fop=imageView/6/f/webp/q/90",
          400: EB + "6904400b2d78a99933cbf06cyBtLcZwt06?fop=imageView/6/f/webp/q/90",
          750: EB + "6904400b8c7ddf4ddf2cc7e5Qh7K9R0K06?fop=imageView/6/f/webp/q/90",
          1200: EB + "6904400ba08dc9c6c09fbd5cmR8vYh8x06?fop=imageView/6/f/webp/q/90",
          1900: EB + "6904400b8b1ee2b7c8c4c4f4P4DvKkU06?fop=imageView/6/f/webp/q/90",
          2500: EB + "6904400b5f6c0c39b5c1a8afcZV3iG5E06?fop=imageView/6/f/webp/q/90",
          5000: EB + "6904400c2ae63358609f1eb1hLxrizDb06?fop=imageView/6/f/webp/q/90",
          15000: EB + "6904400da4f3685e0b5e38734mdoi4MM06?fop=imageView/6/f/webp/q/90",
          25000: EB + "6904400dba325a18fbe034a76d9wOfhi06?fop=imageView/6/f/webp/q/90",
          50000: EB + "6904400e5951d9f5e517a182STfPsAxN06?fop=imageView/6/f/webp/q/90"}

AK = "https://gameclub-fp.akamaized.net/file/"
RACING = {70: AK + "69b7c68dd7c7986ef9cb9a08LUtIk8Db03?fop=imageView/6/f/webp/q/90",
          350: AK + "69b7c6973a0a74baff28397cY8qNlPBt03?fop=imageView/6/f/webp/q/90",
          700: AK + "69b7c6a352b638081ab8667ezwEZQOaM03?fop=imageView/6/f/webp/q/90",
          1050: AK + "69c1f249f55794af311a8776ylUORafP03?fop=imageView/6/f/webp/q/90",
          1400: AK + "69b7c6cbbecbcf9dbcf8cb5evzbivWjt03?fop=imageView/6/f/webp/q/90",
          2100: AK + "69b7c6d74655090786d986bfgTylbeMk03?fop=imageView/6/f/webp/q/90",
          3500: AK + "69c1f26ffe7a638913edd7875EH4hPSQ03?fop=imageView/6/f/webp/q/90",
          7000: AK + "69c1f2815ea8c006f369ebf5SkT2jp6103?fop=imageView/6/f/webp/q/90"}
SWORD = {60: AK + "6ae7f7bae80d7f32e7e6aaf6NYT8tlOT07?fop=imageView/6/f/webp/q/90",
         300: AK + "6ae7f7be696e1ff516d6991bxAli8U1R07?fop=imageView/6/f/webp/q/90",
         980: AK + "6ae7f7c2a02a73fd5de680afYOyiiJob07?fop=imageView/6/f/webp/q/90",
         1980: AK + "6ae7f7c6ab9e62690961c611xuqN5ia207?fop=imageView/6/f/webp/q/90",
         3280: AK + "6ae7f7caa23fe9f8c0d6c37bALrQiwZD07?fop=imageView/6/f/webp/q/90",
         6480: AK + "6ae7f7cd5b13d17015e19900myXl8KiF07?fop=imageView/6/f/webp/q/90"}
DUNK = {60: AK + "6805ff97afba33256298c1b2lBcIrbTr03?fop=imageView/6/f/webp/q/90",
        300: AK + "6806000c5a2dc7e5fcfa7a0e9lP4jM1V03?fop=imageView/6/f/webp/q/90",
        980: AK + "6806000c5acba2a2dbabf0e3hFz7hYt03?fop=imageView/6/f/webp/q/90",
        1980: AK + "6a62dc383f1d27c2ee2d8e5c3vY4r4Rw03?fop=imageView/6/f/webp/q/90",
        3280: AK + "6a62dc38c0ecafebc1b85b6bhrx6dXFR03?fop=imageView/6/f/webp/q/90",
        6480: AK + "6a62dc3e52c5b30e7b88a6366ukeswmt03?fop=imageView/6/f/webp/q/90"}
DELTA_COIN = "https://cdn-gop.garenanow.com/gop/app/0000/100/151/point.png"

AMOUNT_MAPS = {"Knives Out": ("voucher", KNIVES), "Racing Master": ("gem", RACING),
               "Sword of Justice": ("jade", SWORD), "Dunk City Dynasty": ("token", DUNK)}


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
    return icons[min(icons.keys(), key=lambda k: abs(math.log(amount / k)))]


def icon_for(game: str, pname: str) -> str | None:
    low = pname.lower()
    if game == "Ludus Strategy PVP":
        if low in LUDUS_NAMED:
            return LUDUS_NAMED[low]
        for unit, icons in LUDUS_AMT.items():
            if unit in low:
                return pick(icons, amount_of(pname))
        return None
    if game == "Garena Delta Force":
        return DELTA_COIN if "delta coin" in low else None
    spec = AMOUNT_MAPS.get(game)
    if spec and spec[0] in low:
        return pick(spec[1], amount_of(pname))
    return None


def main() -> int:
    rows = json.load(open("/tmp/all-pkgs.json"))
    updates = []
    per_game: dict[str, int] = {}
    for r in rows:
        if r["img"]:
            continue
        icon = icon_for(r["gname"], r["pname"])
        if icon:
            updates.append((r["pid"], icon))
            per_game[r["gname"]] = per_game.get(r["gname"], 0) + 1
    sql = "\n".join(f"UPDATE \"Package\" SET \"imageUrl\" = '{u}' WHERE id = {pid} AND \"imageUrl\" IS NULL;"
                    for pid, u in updates)
    open("/tmp/netease-pkg.sql", "w").write(sql + "\n")
    print("updates:", len(updates), per_game)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
