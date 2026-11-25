#!/usr/bin/env python3
"""Áp ảnh shop chính thức Artstorm cho Modern Warships: Naval Battles.
Shop artstorm.com/en-US/shop/{gold,dollars,premium,market} render phía server,
mỗi offer có ảnh riêng theo đúng mệnh giá (trích 2026-11-24):
Gold -> goldoffer_N, Dollars -> softoffer_N, Artcoins -> artcoinoffer_N,
Premium theo số ngày. Khớp CHÍNH XÁC mệnh giá + đơn vị từ tên gói của mình.
Đọc /tmp/all-pkgs.json, ghi /tmp/artstorm.sql. Chỉ điền ô trống.
"""
import json
import re

BASE = "https://artstorm.com/res/images/offers/_medium/"
MAP = {
    ("gold", 500): "goldoffer_1.png",
    ("gold", 1200): "goldoffer_2.png",
    ("gold", 2500): "goldoffer_3.png",
    ("gold", 5500): "goldoffer_4.png",
    ("gold", 12000): "goldoffer_5.png",
    ("gold", 16000): "goldoffer_6.png",
    ("dollars", 500000): "softoffer_1.png",
    ("dollars", 1500000): "softoffer_2.png",
    ("dollars", 3500000): "softoffer_3.png",
    ("dollars", 8000000): "softoffer_4.png",
    ("dollars", 20000000): "softoffer_5.png",
    ("dollars", 30000000): "softoffer_6.png",
    ("artcoins", 140): "artcoinoffer_1.png",
    ("artcoins", 300): "artcoinoffer_2.png",
    ("artcoins", 650): "artcoinoffer_3.png",
    ("artcoins", 1750): "artcoinoffer_4.png",
    ("artcoins", 3000): "artcoinoffer_5.png",
    ("artcoins", 4000): "artcoinoffer_6.png",
    ("premium", 7): "premium_7d.png",
    ("premium", 30): "premium_30d.png",
}


def key_of(name: str):
    n = name.lower()
    m = re.search(r"(\d[\d,]*)\s*(gold|dollars|artcoins)", n)
    if m:
        return (m.group(2), int(m.group(1).replace(",", "")))
    m = re.search(r"premium account - (\d+) days", n)
    if m:
        return ("premium", int(m.group(1)))
    return None


rows = json.load(open("/tmp/all-pkgs.json"))
updates, missed = [], []
for r in rows:
    if r["gname"] != "Modern Warships: Naval Battles" or r["img"]:
        continue
    k = key_of(r["pname"])
    if k and k in MAP:
        updates.append((r["pid"], BASE + MAP[k]))
    else:
        missed.append((r["pname"], k))

with open("/tmp/artstorm.sql", "w") as f:
    for pid, url in updates:
        f.write(f'UPDATE "Package" SET "imageUrl" = \'{url}\' WHERE id = {pid} AND "imageUrl" IS NULL;\n')
print(f"updates: {len(updates)} | missed: {missed}")
