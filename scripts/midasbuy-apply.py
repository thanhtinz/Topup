#!/usr/bin/env python3
"""Áp ảnh Midasbuy cho Dragonheir: Silent Gods (đợt browser 4): gói Dragon
Crystal khớp mệnh giá (gần nhất theo log khi thiếu), gói tên riêng khớp tên
chuẩn hoá (bỏ dấu câu/số nhiều). Đọc /tmp/all-pkgs.json, ghi /tmp/midasbuy-pkg.sql.
"""
import json
import math
import re
import unicodedata

PUB = "https://cdn.midasbuy.com/public/"
CRYSTAL = {70: PUB + "d6af3962972c14145cfaa247af2833ab.png",
           350: PUB + "bb3bd1334360052fd9203cd73f74f8a4.png",
           700: PUB + "55133b2a43ee1df05302034c53ebd52b.png",
           1400: PUB + "a2a06e5b1fbadb2129da1e0e056cddda.png",
           14000: PUB + "0949459b47b99a56ae3d5e1c7466c7d4.png",
           35000: PUB + "a4ccedfcd0b7b281f0cf54dd9342100e.png"}

NAMED = {
    "Magic Rune Divination": "https://cdn.midasbuy.com/images/midas_oversea/dc6d311182789337666dad7fccec2234.png",
    "Support Creator Pack II": PUB + "a4bb3e343e648eb1568bd3ae4b33266f.png",
    "Support Creator Pack III": PUB + "494b28157b88cb06110be453ee9c97eb.png",
    "Departure Goodie Bag": PUB + "f4a139edcfd0cbc5c3711bfeec9e510e.png",
    "Departure Satchel": PUB + "4b298d56654607bc9ab12b315b30792d.png",
    "Departure Treasure": PUB + "204ef37cca725d904f2542f3c8c1b22e.png",
    "Season Select Refinement Pack": PUB + "eee49f5bcafe636dd677a53340bd109c.png",
    "Season Deluxe Refinement Pack": PUB + "c2b2ced50d47095e329af1ea79a86e2c.png",
    "Roar of Steel": PUB + "66457f52c90988d251d3a2c6494203c1.png",
    "Strategists Grimoire": PUB + "178acc8beda6217f6fc78e2a4cd750b6.png",
    "Frostforged Bygones": PUB + "f10fe843557fcd1ca20d154de4fe33d9.png",
    "Account Evaluation Pack (SSS)": PUB + "07c3ee9c76539890b03bc4c610144f75.png",
    "Account Evaluation Pack (SS)": PUB + "23f0c6c8562f442bee756a75d20194bb.png",
    "Account Evaluation Pack (S+)": PUB + "b57f44cb290cd53fffdcf004adfc61ee.png",
    "Account Evaluation Pack (S)": PUB + "876791774081cb5aa614edc98e92f49a.png",
    "Account Evaluation Pack (A+)": PUB + "2cf623245696d8f601c7fca2d1a86581.png",
    "Inside the Resistance": PUB + "3979f8c51f60e66fda9d92ca1b6bf4eb.png",
    "Crucial Horn": PUB + "a92859b36263df167bef716a25af110d.png",
    "Season Summons Pack I": PUB + "916b172fd408e3c97a3d3832860be407.png",
    "Season Summons Pack II": PUB + "16063be46bcef4b0fc5a399f6b7be4d2.png",
    "Season Summons Pack III": PUB + "ec2d11d4f6ce991718adc090f77309ac.png",
    "Season Summons Pack IV": PUB + "daaf8993056289a36d552e5df11bfee1.png",
    "Season Summons Pack V": PUB + "d0b47fcb62f733d8a6614d4653f4668d.png",
    "Season Summons Pack VI": PUB + "050b90b65ad497593cf0f8ce35329746.png",
    "Monthly Summons Pack I": PUB + "f92b4907adb62ef3b1ed5ca133f17d0b.png",
    "Monthly Summons Pack II": PUB + "3c246341d9032578ee6182540d3654d5.png",
    "Monthly Summons Pack III": PUB + "37eecad3c3b619bbc5eae64accd898ff.png",
    "Monthly Summons Pack IV": PUB + "3dd52c14e73d32b6d6302eb45be66004.png",
    "Weekly Summons Pack I": PUB + "ac361f8efd5618c10be1b8260c89e9e7.png",
    "Weekly Summons Pack II": PUB + "47055d1eb7cc6adbcb767bfb2241091e.png",
    "Weekly Summons Pack III": PUB + "95f80ca17acb23e0072eb07e2d2fa639.png",
    "Monthly Master Gift": PUB + "cbe4b5de307917947040c9317bf53a58.png",
    "Weekly Master Gift I": PUB + "2f2d81a9aaed86f39bb798a218074be8.png",
    "Weekly Master Gift II": PUB + "42f43010637d7841055546b6043a4cb0.png",
    "Weekly Master Gift III": PUB + "81239183e150de400bb9e328ae08202b.png",
    "Monthly Scholar Gift": PUB + "d6c5263b034329d119422a5963838a19.png",
    "Weekly Scholar Gift": PUB + "5379a222bce83bdce89581d461a5cd7a.png",
    "Monthly Apprentice Gift": PUB + "36b753f7a314d7adbf5812b6bcd63a29.png",
    "Weekly Apprentice Gift": PUB + "ba86df631a67606eaee5e007635f0750.png",
    "Wyrmarrow Mining Warrant": PUB + "3491adb43dee7de7f85af4ef7990d56e.png",
    "Daily Supply from Three Ears": PUB + "f0ba1e861ba7b3e3748bc4d912292dfa.png",
    "Walkers Selection": PUB + "182f9a835f0ac834354913d42536d6e1.png",
    "Feys Gift": PUB + "b8cac93504b5c9ff8e306b6524a8d3ae.png",
    "Daily Value for 7 days": PUB + "4012489bb47bdd7320673810e6015fcd.png",
    "Vow of Companionship": PUB + "228fcc178893d3289b4fe7c29e738879.png",
    "Imperial Shadow": PUB + "721ee39d17774324bc5a11a24d138739.png",
    "Snowland Lament": PUB + "00110da9ea278fca42b53786fb0bae44.png",
    "Apprentices Secret Collection": PUB + "4184b3389ddf7a11535f6c0ee28d2ee7.png",
    "Scholars Secret Collection": PUB + "1866098eb5e521cbadc1bce5c2e06d65.png",
    "Masters Secret Collection": PUB + "be48d074315a4de93ad043775fc8b799.png",
}


def key(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    toks = [t for t in re.split(r"[^a-z0-9+]+", s) if t and t != "s"]
    toks = [t[:-1] if t.endswith("s") and len(t) > 3 else t for t in toks]
    return " ".join(toks)


def amount_of(name: str) -> int | None:
    m = re.search(r"(\d{1,3}(?:[.,]\d{3})+|\d+)", name)
    if not m:
        return None
    n = int(m.group(1).replace(".", "").replace(",", ""))
    return n if n > 0 else None


def main() -> int:
    by_key = {key(k): v for k, v in NAMED.items()}
    rows = json.load(open("/tmp/all-pkgs.json"))
    updates = []
    for r in rows:
        if r["img"] or r["gname"] != "Dragonheir: Silent Gods":
            continue
        icon = by_key.get(key(r["pname"]))
        if not icon and "crystal" in r["pname"].lower():
            amt = amount_of(r["pname"])
            if amt:
                best = min(CRYSTAL.keys(), key=lambda k: abs(math.log(amt / k)))
                icon = CRYSTAL[best]
        if icon:
            updates.append((r["pid"], icon))
    sql = "\n".join(f"UPDATE \"Package\" SET \"imageUrl\" = '{u}' WHERE id = {pid} AND \"imageUrl\" IS NULL;"
                    for pid, u in updates)
    open("/tmp/midasbuy-pkg.sql", "w").write(sql + "\n")
    print("updates:", len(updates))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
