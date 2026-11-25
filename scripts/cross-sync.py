#!/usr/bin/env python3
"""Đồng bộ ảnh gói QUA LẠI giữa các bản ghi trùng của cùng một game bị tách
thành nhiều entry (Undawn Global <- Undawn + Garena Undawn; Delta Force <-
Garena Delta Force). Khớp: tên chuẩn hoá giống hệt -> cùng đơn vị + mệnh giá
gần nhất (log-ratio) -> gói có tên riêng chỉ khớp khi tên phủ nhau, không có
thì để trống và báo cáo. Chỉ điền ô trống. Ghi /tmp/cross-sync.sql.
"""
import json
import math
import re
import unicodedata

PAIRS = [
    ("Undawn Global", ["Undawn", "Garena Undawn"]),
    ("Delta Force", ["Garena Delta Force"]),
]


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


def main() -> int:
    rows = json.load(open("/tmp/all-pkgs.json"))
    updates: list[tuple[int, str]] = []
    for target_name, donor_names in PAIRS:
        donors = [r for r in rows if r["gname"] in donor_names and r["img"]]
        targets = [r for r in rows if r["gname"] == target_name and not r["img"]]
        by_name = {}
        for d in donors:
            by_name.setdefault(norm(d["pname"]), d["img"])
        amt_donors = [(amount_of(d["pname"]), unit_of(d["pname"]), d["img"])
                      for d in donors if amount_of(d["pname"])]
        filled, skipped = 0, []
        for t in targets:
            icon = by_name.get(norm(t["pname"]))
            if not icon:
                amt, unit = amount_of(t["pname"]), unit_of(t["pname"])
                if amt:
                    pool = [(a, u) for a, un, u in amt_donors if un == unit] or \
                           [(a, u) for a, un, u in amt_donors]
                    if pool:
                        icon = min(pool, key=lambda x: abs(math.log(amt / x[0])))[1]
            if icon:
                updates.append((t["pid"], icon))
                filled += 1
            else:
                skipped.append(t["pname"])
        print(f"{target_name}: filled {filled}/{len(targets)}; skipped: {skipped}")
    sql = "\n".join(f"UPDATE \"Package\" SET \"imageUrl\" = '{u}' WHERE id = {pid} AND \"imageUrl\" IS NULL;"
                    for pid, u in updates)
    open("/tmp/cross-sync.sql", "w").write(sql + "\n")
    print("updates:", len(updates))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
