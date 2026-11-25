#!/usr/bin/env python3
"""Lan ảnh gói TRONG CÙNG GAME từ các gói đã có ảnh (mọi nguồn: Eris/SEAGM/
Codashop) sang gói còn thiếu — cùng triết lý pickIcon của enrich mà Tín đã
duyệt: trùng tên lấy đúng ảnh; cùng đơn vị tiền thì mệnh giá gần nhất; không
có số thì ảnh mệnh giá nhỏ nhất của game. Đọc /tmp/all-pkgs.json (xuất mới),
ghi /tmp/propagate.sql.
"""
import json
import math
import re
import unicodedata


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return " ".join(re.sub(r"[^a-z0-9 ]", " ", s.lower()).split())


def amount_of(name: str) -> int | None:
    m = re.search(r"(\d{1,3}(?:[.,]\d{3})+|\d+)", name)
    if not m:
        return None
    n = int(m.group(1).replace(".", "").replace(",", ""))
    return n if n > 0 else None


def unit_of(name: str) -> str:
    m = re.search(r"(?:\d{1,3}(?:[.,]\d{3})+|\d+)\s*([a-z]+)", name.lower())
    return m.group(1) if m else ""


def nearest(donors: list[tuple[int, str]], amount: int) -> str:
    return min(donors, key=lambda d: abs(math.log(amount / d[0])))[1]


def main() -> int:
    rows = json.load(open("/tmp/all-pkgs.json"))
    games: dict[int, list[dict]] = {}
    for r in rows:
        games.setdefault(r["gid"], []).append(r)
    updates: list[tuple[int, str]] = []
    per_game: dict[str, int] = {}
    for gid, pkgs in games.items():
        donors = [p for p in pkgs if p["img"]]
        if not donors:
            continue
        by_name: dict[str, str] = {}
        by_unit: dict[str, list[tuple[int, str]]] = {}
        all_amounts: list[tuple[int, str]] = []
        for d in donors:
            by_name.setdefault(norm(d["pname"]), d["img"])
            amt = amount_of(d["pname"])
            if amt:
                by_unit.setdefault(unit_of(d["pname"]), []).append((amt, d["img"]))
                all_amounts.append((amt, d["img"]))
        smallest = min(all_amounts)[1] if all_amounts else donors[0]["img"]
        for p in pkgs:
            if p["img"]:
                continue
            icon = by_name.get(norm(p["pname"]))
            amt = amount_of(p["pname"])
            if not icon and amt:
                unit = unit_of(p["pname"])
                if unit and unit in by_unit:
                    icon = nearest(by_unit[unit], amt)
                elif all_amounts:
                    icon = nearest(all_amounts, amt)
            if not icon:
                icon = smallest
            updates.append((p["pid"], icon))
            per_game[p["gname"]] = per_game.get(p["gname"], 0) + 1
    sql = "\n".join(f"UPDATE \"Package\" SET \"imageUrl\" = '{u}' WHERE id = {pid} AND \"imageUrl\" IS NULL;"
                    for pid, u in updates)
    open("/tmp/propagate.sql", "w").write(sql + "\n")
    top = sorted(per_game.items(), key=lambda kv: -kv[1])[:12]
    print("updates:", len(updates), "| games:", len(per_game), "| top:", top)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
