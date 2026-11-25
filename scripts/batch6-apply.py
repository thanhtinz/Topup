#!/usr/bin/env python3
"""Áp ảnh đợt 6: Ludus (toàn bộ store Xsolla — khớp tên + Might Pass % + Royal
theo ngày), Haikyu + AoV (Garena — icon chung theo đơn vị + deal khớp tên;
bỏ file 191/561 của Haikyu vì ảnh hỏng), Eggy Party (NetEase — Egg Coins theo
mệnh giá), TFT Mobile + Legends of Runeterra (Codashop — Coins theo mệnh giá).
Đọc /tmp/all-pkgs.json, ghi /tmp/batch6-pkg.sql.
"""
import json
import math
import re
import unicodedata

XS = "https://cdn3.xsolla.com/img/misc/images/"
LUDUS2 = {
    "uruk bundle": XS + "42876dd6d0a2273bad43741e593d58d8.png",
    "small welcome bundle": XS + "6c9fd1ca4039649704b1412f8492bf6a.png",
    "medium welcome bundle": XS + "4340bf19785c2e22a75a1cc8d8618167.png",
    "big welcome bundle": XS + "a8a9b8d960f5c714903a013e9978763a.png",
    "atlantis ruby permit": XS + "95f1e55bed4130f9b16a0f4d0d77e90a.png",
    "atlantis super permit": XS + "80010a74800206cf0cab1054cf01faef.png",
    "atlantis sapphire permit": XS + "a71f03acf69247885119fc40ec933af0.png",
    "atlantis diamond ticket": XS + "27a71aeb17bdb519161ec51c3b5b371e.png",
    "atlantis golden ticket": XS + "938f2d31336930e38c885046195d8b0c.png",
    "free emeralds": XS + "df4d11806e5c003a089b1fc539a57c5d.png",
    "atlantis tokens": XS + "0f313ff3c318cda43be6257dfa56f611.png",
    "double seal": XS + "55591ad28aa5d3b8bbbedb33b8514707.png",
    "runes seal": XS + "e83933fea028b1727b2c15d7871cdf94.png",
    "heroes seal": XS + "b4db25ed7cf256ad68c63ca240f6df63.png",
    "tournament diamond ticket": XS + "7e548f1b30de01f68102835459ffcf87.png",
    "tournament golden ticket": XS + "194199d9bb47d856b5f679038bfd544c.png",
    "battle pass diamond ticket": XS + "7290716f84387414f92e70739d3468cd.png",
    "battle pass golden ticket": XS + "516269a8abce1283b40b596cdc7e5987.png",
    "clan war diamond ticket": XS + "57337f3e83b77f7ae11ff6ff384083c2.png",
    "clan war golden ticket": XS + "874f943cd31cbd0020e5129152b39ab2.png",
    "divisions license x4": XS + "00191543cba62995ec6541f3b2afc000.png",
    "divisions license": XS + "4b12706ad3b3f35d572782543536192c.png",
    "spell of earth": XS + "8013814708bd10b238a9f719f40c1730.png",
    "spell of water": XS + "8a8d98f561f02b00ba36b3039fdc4f70.png",
    "spell of fire": XS + "d6776b9a0f8ed50f3dd02fa853ffde01.png",
    "horn of runes": XS + "62dbe3214dffd2c1d90400dfcf991c49.png",
    "barrel of runes": XS + "3d6d906e171d75b8eeec2f88f657d2c1.png",
    "chest of runes": XS + "98b32645c78f0c8ad627a46d5c09c747.png",
    "wagon of runes": XS + "bec87f2b2c01808db0e6a192a0c0255c.png",
    "longship of runes": XS + "c4fc7b1ad3843fd8223dc2f33c97a775.png",
    "small pile of golden runes": XS + "1dd9208eb6c36e884ed40744fd5743f9.png",
    "crate of golden runes": XS + "084f929dda7043b190ed8001a0da5f2d.png",
    "cauldron of golden runes": XS + "ff4fe36e339a6b95b2c7910901179758.png",
    "handful of dice of fortune": XS + "134daaa3e36a546e1ec80739cab117d0.png",
    "bowl of dice of fortune": XS + "217b387c2327865d8f8fd5c3f6aab2cc.png",
    "heap of dice of fortune": XS + "3d309f6d2edb9d0259088fd98cc6606a.png",
    "astral echo": XS + "65b2259e83152396cdf4110cb85ad547.png",
    "outlaws": XS + "013c0878d2630adb2264b07bc6169e72.png",
    "unique emote": XS + "cf71f9fa74b4c950bfc1a88714b8b92b.png",
    "unique avatar": XS + "e354edb64ebe9136e6edb7224810b981.png",
    "unique frame": XS + "4e9e5fa842ab120c752b6feb422189e1.png",
    "spell chest": XS + "e062533454e70e566982328690c12cf4.png",
    "essence bundle": XS + "4c740e6907b5ba8a62a57772c069d975.png",
}
LUDUS_MIGHT = {0: XS + "2abe627d8bafa138f8be12bbead820af.png", 120: XS + "6940e20ebf4506fe067e84d4b99b714c.png",
               250: XS + "058c2127562e1e2bf40d7fe24e8733d6.png", 500: XS + "0bb4e63d4e8549eeede6ce74e29a07cf.png",
               1000: XS + "e6ccecb73d5c58776aa0526818810d31.png"}
LUDUS_ROYAL = {10: XS + "79db2647d57d7570393a17d494776997.png", 30: XS + "b19102b3e77e174a717412f3b8c8a3e0.png"}

HK = "https://cdn-gop.garenanow.com/gop/app/0000/100/153/"
HAIKYU_GEM = HK + "point.png"
HAIKYU_NAMED = {
    "festival opening special pack i": HK + "item/0000/041/308/logo.png",
    "festival opening special pack ii": HK + "item/0000/041/309/logo.png",
    "supreme recruit special i": HK + "item/0000/191/556/logo.png",
    "supreme recruit special ii": HK + "item/0000/191/557/logo.png",
    "supreme recruit special iii": HK + "item/0000/191/558/logo.png",
    "supreme recruit special iv": HK + "item/0000/191/559/logo.png",
    "ultra recruit special i": HK + "item/0000/191/560/logo.png",
    "ultra recruit special iii": HK + "item/0000/191/562/logo.png",
    "ultra recruit special iv": HK + "item/0000/191/563/logo.png",
    "memory recruit special i": HK + "item/0000/191/564/logo.png",
    "memory recruit special ii": HK + "item/0000/191/565/logo.png",
    "memory recruit special iii": HK + "item/0000/191/566/logo.png",
    "memory recruit special iv": HK + "item/0000/191/567/logo.png",
    "stamina boost pack i": HK + "item/0000/191/554/logo.png",
    "stamina boost pack ii": HK + "item/0000/191/555/logo.png",
    "starter-only pack": HK + "item/0000/113/001/logo.png",
    "starter only pack": HK + "item/0000/113/001/logo.png",
    "first cheer special offer": HK + "item/0000/191/011/logo.png",
    "first memory special offer": HK + "item/0000/191/012/logo.png",
    "first growth special offer": HK + "item/0000/191/013/logo.png",
    "level up bonuses": HK + "item/0000/016/001/logo.png",
    "ultra recruit ticket i": HK + "item/0000/135/002/logo.png",
    "ultra recruit ticket ii": HK + "item/0000/135/003/logo.png",
    "ultra recruit ticket iii": HK + "item/0000/135/004/logo.png",
    "ultra recruit ticket iv": HK + "item/0000/135/005/logo.png",
    "ultra recruit ticket v": HK + "item/0000/135/006/logo.png",
    "ultra recruit ticket vi": HK + "item/0000/135/007/logo.png",
    "recruit ticket x1": HK + "item/0000/126/002/logo.png",
    "recruit ticket x5": HK + "item/0000/126/003/logo.png",
    "recruit ticket x10": HK + "item/0000/126/004/logo.png",
    "recruit ticket x20": HK + "item/0000/126/005/logo.png",
    "recruit ticket x30": HK + "item/0000/126/006/logo.png",
    "recruit ticket x55": HK + "item/0000/126/007/logo.png",
}
AOV_ICON = "https://cdn-gop.garenanow.com/gop/app/0000/100/057/point.png"

AK = "https://gameclub-fp.akamaized.net/file/"
EGGY = {10: AK + "689f1c9a45301048cf5332edEuJJSD0103?fop=imageView/6/f/webp/q/90",
        60: AK + "68d661229eafd7cf9102b243imrecsFI03?fop=imageView/6/f/webp/q/90",
        120: AK + "68d660d9961b087702db6a761sBd1rHX03?fop=imageView/6/f/webp/q/90",
        300: AK + "68d6610a961b087702db6e8dfKZ21m2b03?fop=imageView/6/f/webp/q/90",
        700: AK + "68d6613182b57400fec9680daikiZosg03?fop=imageView/6/f/webp/q/90",
        1380: AK + "68d660ef95d73f29d2bf27f0SttJaTZw03?fop=imageView/6/f/webp/q/90",
        2080: AK + "68d66100e7915e08d1bc6004BQFiODVb03?fop=imageView/6/f/webp/q/90",
        3450: AK + "68d6611682b57400fec966c1iUxjxzqN03?fop=imageView/6/f/webp/q/90",
        6880: AK + "68d66149ade9f788630c02b5SBQbPOSK03?fop=imageView/6/f/webp/q/90"}
EGGY_NAMED = {"yoyo membership": "https://hfc20-mgb-hz-allysdk.s3.nie.netease.com/1350a6ec5ab1f42eae55b5591dd7569e_script.png",
              "iris coin jar": AK + "6a2240ba9d59100241ddb14cF8oSU1XL03?fop=imageView/6/f/webp/q/90",
              "ebby weekly pack": AK + "68e8ba7e85358d4f9c9467afLpdf4gUb03?fop=imageView/6/f/webp/q/90"}

TFTB = "https://cdn1.codashop.com/images/420_970f15c8-b05c-4471-9ffc-84a35936ead9_f182006f3a7d62a059e8703ff50a2125_image/"
TFT = {575: TFTB + "b769bc8a893be210aafa5ea655c8b096.png", 1380: TFTB + "023f5af536f65fea0182fce0e5c8a4dc.png",
       2800: TFTB + "6d40128b883d3586f336cda5de0ce7cd.png", 4500: TFTB + "66257ad4922d3650f859a1a668948a98.png",
       6500: TFTB + "fa7be62e0661e81983bd60024328c410.png", 13500: TFTB + "357412b505f602139f714a65e7865830.png"}
LORB = "https://cdn1.codashop.com/images/420_c46a238e-5f5a-4f1c-b902-c636e6682b30_20f7c5ef024972b0afe68b8e687eb50f_image/"
LOR = {475: LORB + "ff40df55cd36275490e2b48c349d05db.png", 1000: LORB + "37e72eb7bbcc0ebb3d87087b6a712d22.png",
       2050: LORB + "25df94a74a54f813872b44c860b8ab46.png", 3650: LORB + "24706fb6a2727b3585fb8535585f0150.png",
       5350: LORB + "e91bb815c3176414a633915621e17e6d.png", 11000: LORB + "2b850203d59034a88ef0a3b676ede803.png"}


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


def low_norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return " ".join(s.split())


def icon_for(game: str, pname: str) -> str | None:
    low = low_norm(pname)
    if game == "Ludus Strategy PVP":
        if low in LUDUS2:
            return LUDUS2[low]
        m = re.search(r"might pass (\d+)%", low)
        if m:
            return LUDUS_MIGHT.get(int(m.group(1)))
        m = re.search(r"ludus royal for (\d+) days", low)
        if m:
            return LUDUS_ROYAL.get(int(m.group(1)))
        return None
    if game == "Haikyu!! Fly High":
        if "star gem" in low:
            return HAIKYU_GEM
        return HAIKYU_NAMED.get(low)
    if game == "Arena of Valor":
        return AOV_ICON if "voucher" in low else None
    if game == "Eggy Party":
        if low in EGGY_NAMED:
            return EGGY_NAMED[low]
        if "egg coin" in low:
            return pick(EGGY, amount_of(pname))
        return None
    if game == "TFT Mobile":
        return pick(TFT, amount_of(pname)) if "coin" in low else None
    if game == "Legends of Runeterra":
        return pick(LOR, amount_of(pname)) if "coin" in low else None
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
    open("/tmp/batch6-pkg.sql", "w").write(sql + "\n")
    print("updates:", len(updates), per_game)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
