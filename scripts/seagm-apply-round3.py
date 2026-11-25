#!/usr/bin/env python3
"""Ap anh SEAGM vong 3 cho cac game thieu toan bo anh goi.
Nguon: probe scripts/seagm-probe2.py tren cac trang SEAGM cua chinh game.
Mau da chung minh: SEAGM dung 1 icon_400 cho ca dong tien te (ke ca goi ten
rieng ma chinh trang do liet ke duoi cung icon) -> ap icon do cho cac goi
khop ten/dong tien te tuong ung cua minh. Chi dien goi chua co anh.
Doc /tmp/all-pkgs.json, ghi /tmp/seagm-round3.sql + in ke hoach de doi chieu.
"""
import json

CDN = "https://seagm-media.seagmcdn.com/icon_400"

# (game, icon_id, che do chon goi)
# che do: "all" = moi goi thieu anh; "contains:X" = pname chua X;
# "names:a|b|c" = pname khop chinh xac mot trong cac ten.
RULES = [
    ("Ragnarok Origin", 1508, "contains:Nyan Berry"),
    ("Ragnarok Idle Adventure Plus", 2838, "all"),
    ("Acecraft", 3230, "all"),
    ("Be The King", 966, "all"),
    ("Dragon Raja", 927, "all"),
    ("Dynasty Heroes: Legend Samkok", 2742, "all"),
    ("Golden Spatula", 3483, "all"),
    ("Kings Choice", 1560, "all"),
    ("LifeAfter", 790, "all-except:LifeAfter Fund"),
    ("LifeAfter", 1682, "names:LifeAfter Fund"),
    ("Silver and Blood", 3097, "contains:Moonflow"),
    ("Slam Dunk", 1003, "all"),
    ("The Division Resurgence", 3428, "all"),
    ("Lineage W", 3448, "names:40 Diamonds|120 Diamonds|400 Diamonds|1200 Diamonds|"
     "2000 Diamonds|4000 Diamonds|10000 Diamonds|20000 Diamonds|"
     "Shining Diamond Crate|RK's Magic Doll Box|RK's Morph Box|"
     "Journey of Growth Key|W Membership (28d)"),
]

EXPECT = {
    "Ragnarok Origin": 11,
    "Ragnarok Idle Adventure Plus": 14,
    "Acecraft": 15,
    "Be The King": 13,
    "Dragon Raja": 16,
    "Dynasty Heroes: Legend Samkok": 14,
    "Golden Spatula": 14,
    "Kings Choice": 12,
    "LifeAfter": 12,
    "Silver and Blood": 6,
    "Slam Dunk": 15,
    "The Division Resurgence": 14,
    "Lineage W": 13,
}


def pick(pname: str, mode: str) -> bool:
    if mode == "all":
        return True
    if mode.startswith("contains:"):
        return mode[9:] in pname
    if mode.startswith("all-except:"):
        return pname != mode[11:]
    if mode.startswith("names:"):
        return pname in mode[6:].split("|")
    raise ValueError(mode)


def main() -> int:
    rows = json.load(open("/tmp/all-pkgs.json"))
    updates: list[tuple[int, str, str, str]] = []
    counts: dict[str, int] = {}
    for gname, icon, mode in RULES:
        url = f"{CDN}/{icon}.jpg"
        for r in rows:
            if r["gname"] != gname or r["img"]:
                continue
            if pick(r["pname"], mode):
                updates.append((r["pid"], url, gname, r["pname"]))
                counts[gname] = counts.get(gname, 0) + 1
    for g, exp in EXPECT.items():
        got = counts.get(g, 0)
        flag = "OK " if got == exp else "!!!"
        print(f"{flag} {g}: planned {got} (expect {exp})")
    print(f"TOTAL planned: {len(updates)}")
    with open("/tmp/seagm-round3.sql", "w") as f:
        for pid, url, gname, pname in updates:
            f.write(f"UPDATE \"Package\" SET \"imageUrl\" = '{url}' WHERE id = {pid} AND \"imageUrl\" IS NULL; -- {gname} | {pname}\n")
    icons = sorted({u for _, u, _, _ in updates})
    print("icons:", " ".join(icons))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
