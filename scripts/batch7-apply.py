#!/usr/bin/env python3
"""Áp ảnh đợt 7: Bullet Echo (API store.xsolla.com của shop chính thức — khớp
tên), CATS + Pixel Gun 3D (Xsolla — khớp tên mô tả / mệnh giá theo đơn vị),
Ghost Story (VNGGames — Jade theo mệnh giá gần nhất + thẻ tháng theo tên),
LOTR Rise to War (Codashop — Gems theo mệnh giá), Moonlight Blade M (Codashop
— Ticket Package/Card Pack theo tên). Đọc /tmp/all-pkgs.json (+ /tmp/be-items.json
cho Bullet Echo), ghi /tmp/batch7-pkg.sql.
"""
import json
import math
import re
import unicodedata

A = "https://cdn3.xsolla.com/image-proxy/rs:fit:3840:0/q:80/f:webp/static/img/misc/images/"
B = "https://cdn.xsolla.net/image-proxy/rs:fit:3840:0/q:80/f:webp/storage/merchant-bucket-prod/files/uploaded/707055/"
CATS = {
    "leaderboard berseker": A + "6767eaecdf138324abced63dae65fa3d.png@webp",
    "berserker offer": A + "217c7f522c564f6552f7e3b3a4808e58.png@webp",
    "deep freeze": A + "a325defce2ae8e401ab3c7db9cc0e827.png@webp",
    "first aid kit": A + "6f7ee29eed346f2855e439d1ce4a34a8.png@webp",
    "double blade": A + "d32d92038631f2dc11a8479334aef17a.png@webp",
    "copter drone": A + "9c113b9685e4ace52c00a53f178b7135.png@webp",
    "surfer": A + "7c5518063acb3e9d6201b3377ddb051c.png@webp",
    "sneaky": A + "86ba84a914430d2196722e4ea37649d9.png@webp",
    "magic toolboxes": A + "76d6b55b95c3103bf745c96949bb1d5b.png@webp",
    "power toolboxes": A + "16e8502eb3759645f2f13b93bb3e9f2f.png@webp",
    "shield": A + "5ad2970283c942d0ead9d1dbf514b936.png@webp",
    "tranquilizer gun": A + "42ef09685054a1cee446509e5f1a69ca.png@webp",
    "boomerang": A + "890c304f5cdf05326d41a5113158a0b9.png@webp",
    "minigun": A + "befe44c44de98c8b9d3cf4c54abeb869.png@webp",
    "classic": A + "c7d8db5cdfcd1a26cb0e3127f21a0e49.png@webp",
    "whale": A + "537a773269880a2f93a15a627ff9aca5.png@webp",
    "warrior offer": A + "4e535c28b2b0b15111e936999830a9ea.jpg@webp",
    "container of cash": B + "6e476b003f5498e30f9db211e6ff768a.png@webp",
    "basket of cash": B + "8f9410b89f5948d7490024543528552b.png@webp",
    "chest of cash": B + "2a8a338e7993ca0bf1eda5120c037212.png@webp",
    "box of cash": B + "e046ce81b882ec933db2699ed0b92864.png@webp",
    "pile of cash": B + "a9aa8cebf0da2cfa0ce80f6f8364bf2e.png@webp",
    "handful of cash": B + "928fce305207a001c0a0f76c5e20fa37.png@webp",
    "handful of tokens": B + "59527977176f2618d5dbb6b73bb6e1bb.png@webp",
    "pile of tokens": B + "9b798df609e2b1660db0d56f9bb5ebea.png@webp",
    "box of tokens": B + "54a350f9d4d0cc1aa50c147037a5f1a1.png@webp",
    "chest of tokens": B + "165ab2f3bbe7f44b156fc3a3131e892b.png@webp",
    "basket of tokens": B + "5bff4878a0fc63518d8f9940ec6de156.png@webp",
    "container of tokens": B + "4b8e6a109b349b328e570a957470b633.png@webp",
    "handful of gems": A + "620f47978aa19cb701029740a0de333e.png@webp",
    "pile of gems": A + "1cb53f4bf30d2e35e90db0a98252b9c3.png@webp",
    "box of gems": A + "e585db52deaf85f9f29eb2f55c6a52de.png@webp",
    "chest of gems": A + "54ee44943a8f8fdc1594c98f5fdef72c.png@webp",
    "basket of gems": A + "8e8cf7a106c9c64b1f278a8d07272e84.png@webp",
    "container of gems": A + "3faa1f39fa8c2053bd059163c9a42dad.png@webp",
}
C = "https://cdn3.xsolla.com/image-proxy/rs:fit:3840:0/f:webp/static/img/misc/images/"
PG_NAMED = {"starter pack": C + "bd60901b321d2a97971478522ef8377a.png@webp",
            "basic set": C + "7f2ad8499e61f9901f506a15d9964c01.png@webp",
            "common set": C + "77c247b9ab0e1b50856a9ac1908823c2.png@webp",
            "advanced set": C + "84b651707942ac63a5d061c5fd9e83a9.png@webp",
            "ultimate set": C + "3eb32dbe8c599691e73449114dbca91c.png@webp",
            "free chest": C + "384d43b484bedd6b4adb0d043faf7760.png@webp"}
PG_AMT = {"key": {275: C + "81296ac9747d6e0dd14c3ad5c5aa3ce0.png@webp", 600: C + "34d99b092218fe6cf91582867196a6d1.png@webp",
                  1300: C + "5d261b37e289426af6d333cb131b5272.png@webp", 3500: C + "0d46df30e3a8c05e1d3e531beb43d19c.png@webp",
                  5500: C + "6dbf04772c626659882980eb9da03af6.png@webp", 8000: C + "4ef106b82f0fbb5dfce43d5d83639b72.png@webp"},
          "gem": {175: C + "b040b69c6dca515f270981622b8031bb.png@webp", 375: C + "7b6fc07ec61ef75ac7e4aa8eb6a3736f.png@webp",
                  800: C + "8566b80dc1ec3082395044b91c7f1f5a.png@webp", 2200: C + "1a9aaece6cb50a537ceaa9fb425df4b8.png@webp",
                  3500: C + "f5fc791aa0a0d2090d4e27a26be9fdb8.png@webp", 5000: C + "66cf26852091a58191ddd205f0daff15.png@webp"},
          "coin": {275: C + "cc77fc64d1ac1bc6068726a896f41a4a.png@webp", 600: C + "f0e3bf456ae579ebcf3c84e17ee6882f.png@webp",
                   1300: C + "d4ca7eec0fe7b69c3cbe320e7928aab9.png@webp", 3500: C + "1c877585a174081c5e981f9f6623e54a.png@webp",
                   5500: C + "545c4120a17d0cc899de276c5ed9dc3c.png@webp", 8000: C + "d6d13ddb4fb5e9078ad3703cf0a8ee9c.png@webp"},
          "ticket": {350: C + "01ba64e7c53ea0327fde30a986ed5eb0.png@webp", 750: C + "84a384060ef1a71bd55b96699b998c5d.png@webp",
                     1750: C + "0641c0b4db5d25a5d763b68a3db0974d.png@webp", 4500: C + "45e484b05bbb3526b38cdd9988494c7a.png@webp",
                     7000: C + "185102450a1bc033efb457a12267835c.png@webp", 10000: C + "3d575ffd29e0cfb7e38ecfec0ba7ccbe.png@webp"}}
V = "https://scdn-stc-billing.vnggames.com/thiennu3vn/package_newUI/"
GHOST_JADE = {70: V + "70.png", 145: V + "145.png", 360: V + "360.png", 720: V + "720.png", 1440: V + "1440.png",
              3600: V + "3600.png", 7200: V + "7200.png", 14400: V + "14400.png", 36000: V + "36000.png", 72000: V + "72000.png"}
GHOST_NAMED = {"privilege monthly card": V + "com.webshop.monthlyspecial.jpg",
               "monthly pass": V + "com.webshop.monthly.jpg"}
L = "https://cdn1.codashop.com/S/content/common/images/denom-image/LOTR/"
LOTR = {200: L + "200_LOTR_Gems.png", 1000: L + "1000_LOTR_Gems.png", 2300: L + "2300_LOTR_Gems.png",
        4600: L + "4600_LOTR_Gems.png", 11500: L + "11500_LOTR_Gems.png", 23000: L + "23000_LOTR_Gems.png"}
M = "https://cdn1.codashop.com/images/116_27a0ea46-7b6a-4f59-98a6-7c4039c6778c_99542106b65b3290ec2743454abea7c5_image/"
MOON = {"card pack normal": M + "33e01514fdfd3dda561c437f57aee330.png",
        "card pack advanced": M + "e62dea4d90df5735670f270670fe762a.png",
        "ticket package 1": M + "be82cf60de83bfdd1c1b1cced85b77d5.png",
        "ticket package 2": M + "a7b770f7bccc5bedef77f367101ba97d.png",
        "ticket package 3": M + "afb9597f3b3b13062a79f2221d8c8b66.png",
        "ticket package 4": M + "f3d6c0336022ad2b8cc34c3bdbfaa7b0.png",
        "ticket package 5": M + "b21c4af14af7f2d1a704fbe2908b220c.png",
        "ticket package 6": M + "e5e4e93013ce3d1af11aadd07e211699.png",
        "ticket package 7": M + "f94ec117210a86e74aa9527bd8cf9f76.png",
        "ticket package 8": M + "7dc88fc74e59d2d21cb82570ecf51d3e.png",
        "ticket package 9": M + "0b404b260fac02610d39ee68e152242a.png",
        "ticket package 10": M + "6393bb4cfd647f9a742fdfd8fab4d8bb.png",
        "ticket package 11": M + "c2f0da9ddea26bafc13d0197693cfb64.png"}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return " ".join(re.sub(r"[^a-z0-9 ]", " ", s).split())


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


def main() -> int:
    be = {}
    try:
        for it in json.load(open("/tmp/be-items.json")).get("items", []):
            if it.get("name") and it.get("image_url"):
                be[norm(it["name"])] = it["image_url"]
    except Exception:
        pass
    moon = {norm(k): v for k, v in MOON.items()}
    rows = json.load(open("/tmp/all-pkgs.json"))
    updates = []
    per_game: dict[str, int] = {}
    for r in rows:
        if r["img"]:
            continue
        g, low = r["gname"], norm(r["pname"])
        icon = None
        if g == "Bullet Echo":
            icon = be.get(low)
        elif g == "CATS: Crash Arena Turbo Stars":
            icon = CATS.get(low)
        elif g == "Pixel Gun 3D":
            icon = PG_NAMED.get(low)
            if not icon:
                for unit, icons in PG_AMT.items():
                    if unit in low:
                        icon = pick(icons, amount_of(r["pname"]))
                        break
        elif g == "Ghost Story: Love Destiny":
            icon = GHOST_NAMED.get(low)
            if not icon and "jade" in low:
                icon = pick(GHOST_JADE, amount_of(r["pname"]))
        elif g == "The Lord of the Rings: Rise to War":
            if "gem" in low:
                icon = pick(LOTR, amount_of(r["pname"]))
        elif g == "Moonlight Blade M":
            icon = moon.get(low)
        if icon:
            updates.append((r["pid"], icon))
            per_game[g] = per_game.get(g, 0) + 1
    sql = "\n".join(f"UPDATE \"Package\" SET \"imageUrl\" = '{u}' WHERE id = {pid} AND \"imageUrl\" IS NULL;"
                    for pid, u in updates)
    open("/tmp/batch7-pkg.sql", "w").write(sql + "\n")
    print("updates:", len(updates), per_game)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
