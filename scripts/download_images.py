"""
download_images.py
------------------
Downloads set images from BrickLink for all sets in public/data.json that
still have an external image URL, plus any sets added via the manual-entry
flow (public/manual_sets.json), which reference a local image path directly.
Updates data.json in-place so the Vite build can serve images from the local
public/images/ directory.

Used as a pre-build step in deploy.yml so every GitHub Pages deployment has
real images — even if the daily sync hasn't run yet with the new code.
"""

import json
import os
import requests

IMAGES_DIR = "public/images"
DATA_JSON = "public/data.json"
MANUAL_SETS_JSON = "public/manual_sets.json"
MIN_SIZE = 2000  # bytes — BrickLink returns a 1×1 GIF for missing sets
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}

os.makedirs(IMAGES_DIR, exist_ok=True)

seen: dict[str, str | None] = {}  # set_number -> resolved local path (or None)


def ensure_image_cached(set_id: str) -> str | None:
    """Make sure public/images/<num>.<ext> exists for this set, downloading
    it from BrickLink (full item number, e.g. "21028-1") if necessary.
    Returns the relative "images/<num>.<ext>" path, or None if unavailable."""
    num = set_id.split("-")[0]
    if num in seen:
        return seen[num]

    for ext in ("png", "jpg"):
        disk_path = os.path.join(IMAGES_DIR, f"{num}.{ext}")
        if os.path.exists(disk_path) and os.path.getsize(disk_path) > MIN_SIZE:
            seen[num] = f"images/{num}.{ext}"
            return seen[num]

    for ext in ("png", "jpg"):
        # BrickLink's image server requires the full item number (set_id),
        # not just the numeric set number — a bare number 404s.
        url = f"https://img.bricklink.com/ItemImage/SN/0/{set_id}.{ext}"
        try:
            r = requests.get(url, headers=HEADERS, timeout=15)
            if r.status_code == 200 and len(r.content) > MIN_SIZE:
                disk_path = os.path.join(IMAGES_DIR, f"{num}.{ext}")
                with open(disk_path, "wb") as fh:
                    fh.write(r.content)
                print(f"  Downloaded {num}.{ext}")
                seen[num] = f"images/{num}.{ext}"
                return seen[num]
        except Exception as exc:
            print(f"  Failed {url}: {exc}")

    print(f"  No image available for set {set_id}")
    seen[num] = None
    return None


with open(DATA_JSON) as f:
    data = json.load(f)

changed = False
for s in data["sets"]:
    # Already using a local path — verify the file exists
    if not s["image_url"].startswith("http"):
        disk_path = os.path.join(IMAGES_DIR, os.path.basename(s["image_url"]))
        if os.path.exists(disk_path) and os.path.getsize(disk_path) > MIN_SIZE:
            continue

    downloaded = ensure_image_cached(s["set_id"])
    if downloaded and s["image_url"].startswith("http"):
        s["image_url"] = downloaded
        changed = True

if changed:
    with open(DATA_JSON, "w") as f:
        json.dump(data, f, indent=2)
    print(f"Updated {DATA_JSON} with local image paths")
else:
    print("All images already local — nothing to update")

# Manual sets reference "images/<num>.png" directly (set by the app when the
# entry is created) — just make sure the file exists, data.json is untouched.
if os.path.exists(MANUAL_SETS_JSON):
    with open(MANUAL_SETS_JSON) as f:
        manual_sets = json.load(f)
    for m in manual_sets:
        set_id = m.get("set_id") or m.get("set_number")
        if set_id:
            ensure_image_cached(set_id)
