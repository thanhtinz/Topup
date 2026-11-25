#!/usr/bin/env python3
"""Áp ảnh từ web nạp CHÍNH THỨC (đợt browser 3): Garena Undawn (Garena Topup
Center — mọi mệnh giá RC dùng chung 1 icon, deal đặc biệt có logo riêng) và
Solo Leveling: Arise (Netmarble web shop — chỉ khớp gói tên Pass/All-in-One/
Diamond Double Up có ảnh thật; Essence Stones không có ảnh mệnh giá công khai
nên để trống). Đọc /tmp/all-pkgs.json, ghi /tmp/official-pkg.sql.
"""
import json
import re

GOP = "https://cdn-gop.garenanow.com/gop/app/0000/100/"
UNDAWN_RC = GOP + "105/point.png"
UNDAWN_NAMED = {
    "weekly": GOP + "125/logo.png",
    "kartu mingguan": GOP + "125/logo.png",
    "monthly": GOP + "126/logo.png",
    "kartu bulanan": GOP + "126/logo.png",
    "growth fund": GOP + "221/logo.png",
    "elite fund": GOP + "222/logo.png",
    "ace fund": GOP + "300/logo.png",
    "glory pass": GOP + "361/logo.png",
}
NM = "https://sololv.gcdn.netmarble.com/sololv/image/live/"
SLV_PASS = NM + "BattlePass_ShopIcon_Mini_PassUpgrade01.png"
SLV_HUNTER_PASS = NM + "Item_Icon_BattlePass_Delux.png"
SLV_ALLINONE = NM + "Icon_WebShop_Pack00.png"
SLV_DIAMOND = NM + "Big_Package_Dia_Double00.png"


def undawn_icon(pname: str) -> str | None:
    low = pname.lower()
    for key, url in UNDAWN_NAMED.items():
        if key in low:
            return url
    if re.search(r"\brc\b", low):
        return UNDAWN_RC
    return None


def slv_icon(pname: str) -> str | None:
    low = pname.lower()
    if "diamond double up" in low:
        return SLV_DIAMOND
    if "all-in-one" in low or "all in one" in low:
        return SLV_ALLINONE
    if "pass" in low:
        return SLV_HUNTER_PASS if "hunter" in low else SLV_PASS
    return None


def main() -> int:
    rows = json.load(open("/tmp/all-pkgs.json"))
    updates = []
    per_game: dict[str, int] = {}
    for r in rows:
        if r["img"]:
            continue
        icon = None
        if r["gname"] == "Garena Undawn":
            icon = undawn_icon(r["pname"])
        elif r["gname"] == "Solo Leveling: Arise":
            icon = slv_icon(r["pname"])
        if icon:
            updates.append((r["pid"], icon))
            per_game[r["gname"]] = per_game.get(r["gname"], 0) + 1
    sql = "\n".join(f"UPDATE \"Package\" SET \"imageUrl\" = '{u}' WHERE id = {pid} AND \"imageUrl\" IS NULL;"
                    for pid, u in updates)
    open("/tmp/official-pkg.sql", "w").write(sql + "\n")
    print("updates:", len(updates), per_game)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
