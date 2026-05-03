"""
download_images.py
------------------
Downloads set images from BrickLink for all sets in public/data.json that
still have an external image URL.  Updates data.json in-place so the Vite
build can serve images from the local public/images/ directory.

Used as a pre-build step in deploy.yml so every GitHub Pages deployment has
real images — even if the daily sync hasn't run yet with the new code.
"""

import json
import os
import requests

IMAGES_DIR = "public/images"
DATA_JSON = "public/data.json"
MIN_SIZE = 2000  # bytes — BrickLink returns a 1×1 GIF for missing sets
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}

os.makedirs(IMAGES_DIR, exist_ok=True)

with open(DATA_JSON) as f:
    data = json.load(f)

changed = False
seen: dict[str, str | None] = {}  # set_number -> resolved local path (or None)

for s in data["sets"]:
    num = s["set_id"].split("-")[0]

    # Reuse result if we already resolved this set number this run
    if num in seen:
        if seen[num] and s["image_url"].startswith("http"):
            s["image_url"] = seen[num]
            changed = True
        continue

    # Already using a local path — verify the file exists
    if not s["image_url"].startswith("http"):
        disk_path = os.path.join(IMAGES_DIR, os.path.basename(s["image_url"]))
        if os.path.exists(disk_path) and os.path.getsize(disk_path) > MIN_SIZE:
            seen[num] = s["image_url"]
            continue

    # Check for a previously cached image on disk
    downloaded: str | None = None
    for ext in ("png", "jpg"):
        disk_path = os.path.join(IMAGES_DIR, f"{num}.{ext}")
        if os.path.exists(disk_path) and os.path.getsize(disk_path) > MIN_SIZE:
            downloaded = f"images/{num}.{ext}"
            break

    # Download from BrickLink if not cached
    if not downloaded:
        for ext in ("png", "jpg"):
            url = f"https://img.bricklink.com/ItemImage/SN/0/{num}.{ext}"
            try:
                r = requests.get(url, headers=HEADERS, timeout=15)
                if r.status_code == 200 and len(r.content) > MIN_SIZE:
                    disk_path = os.path.join(IMAGES_DIR, f"{num}.{ext}")
                    with open(disk_path, "wb") as fh:
                        fh.write(r.content)
                    downloaded = f"images/{num}.{ext}"
                    print(f"  Downloaded {num}.{ext}")
                    break
            except Exception as exc:
                print(f"  Failed {url}: {exc}")

    seen[num] = downloaded

    if downloaded and s["image_url"].startswith("http"):
        s["image_url"] = downloaded
        changed = True
    elif not downloaded:
        print(f"  No image available for set {num}")

if changed:
    with open(DATA_JSON, "w") as f:
        json.dump(data, f, indent=2)
    print(f"Updated {DATA_JSON} with local image paths")
else:
    print("All images already local — nothing to update")
