#!/usr/bin/env python3
"""Probe cac trang SEAGM ung vien: trich cap (icon -> ten SKU) de xay mapping tay.
SKU block: img icon_sku/icon_400 xuat hien truoc, ten SKU o class="sku" ngay sau.
Ghi /tmp/seagm-probe2.json: {slug: {icon_url: [sku names...]}} + trang thai HTTP.
"""
import json
import re
import subprocess
import sys
import time

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

SLUGS = [
    "ragnarok-origin-global",
    "ragnarok-idle-adventure-plus-top-up",
    "acecraft-global-top-up",
    "be-the-king-global-gold-instant-top-up",
    "dragon-raja-sea-coupon-top-up",
    "dynasty-heros-top-up",
    "golden-spatula-top-up",
    "kings-choice-gold-sea",
    "life-after-top-up",
    "life-after-credits-hk-mo-tw",
    "life-after-night-falls-credits-eu",
    "silver-and-blood-top-up",
    "slam-dunk-global-top-up",
    "the-division-resurgence-top-up",
    "lineage-w-sea-top-up",
]


def curl(url: str) -> tuple[int, str]:
    out = subprocess.run(["curl", "-sL", "--max-time", "30", "-A", UA, "-w", "\n%{http_code}", url],
                         capture_output=True, timeout=40)
    if out.returncode != 0:
        return 0, ""
    body = out.stdout.decode("utf-8", "replace")
    nl = body.rfind("\n")
    try:
        return int(body[nl + 1:]), body[:nl]
    except ValueError:
        return 0, body


def parse(html: str) -> dict[str, list[str]]:
    icons: dict[str, list[str]] = {}
    pat = re.compile(r"https://seagm-media\.seagmcdn\.com/(icon_sku/[\d-]+\.png|icon_400/\d+\.jpg)")
    for m in pat.finditer(html):
        url = m.group(0)
        after = html[m.end():m.end() + 1500]
        sku = re.search(r'class="sku"[^>]*>\s*<span>([^<]+)</span>', after)
        name = sku.group(1).strip() if sku else "(no-sku-name)"
        icons.setdefault(url, [])
        if name not in icons[url]:
            icons[url].append(name)
    return icons


def main() -> int:
    only = sys.argv[1:] or SLUGS
    report = {}
    for slug in only:
        status, html = curl(f"https://www.seagm.com/en-us/{slug}")
        time.sleep(1.0)
        if status != 200:
            report[slug] = {"status": status, "icons": {}}
            print(f"{slug}: HTTP {status}", flush=True)
            continue
        icons = parse(html)
        report[slug] = {"status": status, "icons": icons}
        print(f"{slug}: {len(icons)} icons", flush=True)
        for u, names in icons.items():
            print(f"   {u} -> {names[:6]}{'...' if len(names) > 6 else ''} ({len(names)})", flush=True)
    json.dump(report, open("/tmp/seagm-probe2.json", "w"), ensure_ascii=False, indent=1)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
