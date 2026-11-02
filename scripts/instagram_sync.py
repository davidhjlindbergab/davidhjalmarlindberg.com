#!/usr/bin/env python3
"""Fetch David's newest Instagram posts into instagram/feed.json and instagram/media/ for the phone on the front page.

Runs every night from .github/workflows/instagram.yml, or by hand:
    INSTAGRAM_TOKEN=... python3 scripts/instagram_sync.py

It reads @david.hjalmar.lindberg with the token in INSTAGRAM_TOKEN: an Instagram login token
(graph.instagram.com/me) or, as the app "David Hjalmar Lindberg site" makes it, a read-only system-user
token that never expires (graph.facebook.com/<INSTAGRAM_USER_ID>); it tries the first, then the second. What the API cannot tell is kept from the feed.json already there: the category
under the name, the highlights (titles, covers and links) and which posts are pinned ("pinned": shortcodes).
Without a token it changes nothing, so the site keeps the feed it has.

Needs Pillow. With ffmpeg on the machine, the newest reels are also saved as short clips that play,
muted, in the phone; without it the phone shows their covers.

Environment:
    INSTAGRAM_TOKEN   the token (never printed)
    INSTAGRAM_USER_ID the account's Instagram ID, for a system-user token (17841454963593364)
    REFRESH=1         renew an Instagram login token and write the new one to NEW_TOKEN_FILE (the workflow stores it)
"""
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
HERE = ROOT / "instagram"
MEDIA = HERE / "media"
FEED = HERE / "feed.json"
API = "https://graph.instagram.com"
API_FB = "https://graph.facebook.com/v23.0"
PROFILE = "id,username,name,profile_picture_url,followers_count,media_count"
GRID = 12          # posts in the phone's grid
CLIPS = 3          # newest reels kept as short clips
CLIP_SECONDS = 15
FIELDS = "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,shortcode"


def fail(message):
    print(f"::error::{message}")
    sys.exit(1)


def call(path, token, base=API, **params):
    params["access_token"] = token
    url = f"{base}/{path}?{urllib.parse.urlencode(params)}"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "davidhjalmarlindberg.com"}), timeout=40) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        try:
            body = json.loads(body).get("error", {}).get("message", body)
        except ValueError:
            pass
        raise RuntimeError(f"{path}: {e.code} {body[:300]}") from None


def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=60) as r:
        return r.read()


def short_number(n):
    n = int(n or 0)
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}".rstrip("0").rstrip(".") + "M"
    if n >= 10_000:
        return f"{round(n / 1000)}K"
    return f"{n:,}"


def trim(text, limit=170):
    text = re.sub(r"\s+", " ", (text or "")).strip()
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0].rstrip(",.;:–—-")
    return cut + "…"


def average(im):
    r, g, b = im.convert("RGB").resize((1, 1), Image.LANCZOS).getpixel((0, 0))
    return f"#{r:02x}{g:02x}{b:02x}"


def save_cover(code, data):
    """A 4:5 tile for the grid and a larger cover in the post's own shape for the player."""
    im = Image.open(io.BytesIO(data)).convert("RGB")
    w, h = im.size
    tw, th = (w, int(w * 1.25)) if w * 1.25 <= h else (int(h * 0.8), h)
    left, top = (w - tw) // 2, (h - th) // 2
    im.crop((left, top, left + tw, top + th)).resize((240, 300), Image.LANCZOS).save(MEDIA / f"{code}-s.webp", "WEBP", quality=78, method=6)
    large = im if w <= 720 else im.resize((720, round(h * 720 / w)), Image.LANCZOS)
    large.save(MEDIA / f"{code}-l.webp", "WEBP", quality=80, method=6)
    return large.size, average(im)


def save_clip(code, url):
    if not shutil.which("ffmpeg"):
        return None
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "in.mp4"
        src.write_bytes(fetch(url))
        out = MEDIA / f"{code}.mp4"
        cmd = ["ffmpeg", "-loglevel", "error", "-y", "-i", str(src), "-t", str(CLIP_SECONDS),
               "-vf", "scale='min(540,iw)':-2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "30",
               "-pix_fmt", "yuv420p", "-profile:v", "main", "-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart", str(out)]
        if subprocess.run(cmd).returncode != 0:
            return None
    return f"media/{code}.mp4"


def main():
    token = os.environ.get("INSTAGRAM_TOKEN", "").strip()
    if not token:
        print("No INSTAGRAM_TOKEN, so the feed stays as it is.")
        return

    old = json.loads(FEED.read_text("utf-8")) if FEED.exists() else {}
    MEDIA.mkdir(parents=True, exist_ok=True)

    # which kind of token: an Instagram login token, or a system-user token for the account's Instagram ID
    user_id = os.environ.get("INSTAGRAM_USER_ID", "").strip() or "17841454963593364"
    base, who = API, "me"
    try:
        me = call(who, token, base, fields=PROFILE)
    except RuntimeError as first:
        base, who = API_FB, user_id
        try:
            me = call(who, token, base, fields=PROFILE)
        except RuntimeError as e:
            fail(f"Instagram said no ({first}; {e}). The token may have been revoked: make a new one (README, Instagram).")
    try:
        extra = call(who, token, base, fields="biography,website")
    except RuntimeError:
        extra = {}

    if base == API and os.environ.get("REFRESH") == "1":
        try:
            fresh = call("refresh_access_token", token, base, grant_type="ig_refresh_token")
            days = int(fresh.get("expires_in", 0)) // 86400
            target = os.environ.get("NEW_TOKEN_FILE")
            if fresh.get("access_token") and fresh["access_token"] != token and target:
                Path(target).write_text(fresh["access_token"], "utf-8")
            print(f"Token renewed, good for {days} days.")
        except RuntimeError as e:
            print(f"::warning::Could not renew the token this time ({e}). It keeps working until it expires.")

    items, after = [], None
    while len(items) < 48:
        page = call(f"{who}/media", token, base, fields=FIELDS, limit=24, **({"after": after} if after else {}))
        items += page.get("data", [])
        after = page.get("paging", {}).get("cursors", {}).get("after")
        if not after or not page.get("paging", {}).get("next"):
            break

    pinned = [c for c in old.get("pinned", []) if isinstance(c, str)]
    by_code = {(m.get("shortcode") or m.get("id")): m for m in items}
    old_media = {m.get("id"): m for m in old.get("media", [])}

    chosen = [by_code[c] for c in pinned if c in by_code]
    chosen += [m for m in items if (m.get("shortcode") or m.get("id")) not in pinned]
    chosen = chosen[:GRID]

    media, clips, tries = [], 0, 0
    for m in chosen:
        code = m.get("shortcode") or m["id"]
        kind = {"CAROUSEL_ALBUM": "carousel", "IMAGE": "image"}.get(m.get("media_type"), "reel")
        cover = m.get("thumbnail_url") if m.get("media_type") == "VIDEO" else m.get("media_url")
        entry = {
            "id": code,
            "type": kind,
            "pinned": code in pinned,
            "url": m.get("permalink") or f"https://www.instagram.com/p/{code}/",
            "time": (m.get("timestamp") or "").replace("+0000", "Z"),
            "caption": trim(m.get("caption")),
            "alt": trim(m.get("caption"), 120) or "A post by @" + me.get("username", ""),
            "thumb": f"media/{code}-s.webp",
            "image": f"media/{code}-l.webp",
        }
        reuse = old_media.get(code) if old.get("source") == "instagram" else None
        if reuse and (MEDIA / f"{code}-l.webp").exists() and (MEDIA / f"{code}-s.webp").exists() and reuse.get("w"):
            entry.update({"w": reuse["w"], "h": reuse["h"], "color": reuse.get("color")})
        elif cover:
            (w, h), colour = save_cover(code, fetch(cover))
            entry.update({"w": w, "h": h, "color": colour})
        else:
            continue
        if kind == "reel" and tries < CLIPS and m.get("media_url") and not entry["pinned"]:
            tries += 1
            clip = f"media/{code}.mp4"
            if (MEDIA / f"{code}.mp4").exists() or save_clip(code, m["media_url"]):
                entry["video"] = clip
                clips += 1
        media.append(entry)

    # a pinned post older than the newest 48 stays as it was
    for code in pinned:
        if code not in by_code and code in old_media:
            media.insert(0, old_media[code])
    media = media[:GRID]

    profile = dict(old.get("profile", {}))
    profile.update({
        "username": me.get("username") or profile.get("username"),
        "name": me.get("name") or profile.get("name"),
        "followers": short_number(me.get("followers_count")),
        "posts": f"{int(me.get('media_count') or 0):,}",
        "url": f"https://www.instagram.com/{me.get('username') or profile.get('username')}/",
    })
    if extra.get("website"):
        profile["website"] = extra["website"]
    if me.get("profile_picture_url"):
        try:
            Image.open(io.BytesIO(fetch(me["profile_picture_url"]))).convert("RGB").resize((320, 320), Image.LANCZOS).save(MEDIA / "avatar.webp", "WEBP", quality=88, method=6)
            profile["picture"] = "media/avatar.webp"
        except Exception as e:  # keep the picture we had
            print(f"::warning::Profile picture not updated: {e}")

    feed = {
        "version": 1,
        "source": "instagram",
        "updated": old.get("updated"),
        "profile": profile,
        "highlights": old.get("highlights", []),
        "pinned": pinned,
        "media": media,
    }
    same = {k: v for k, v in old.items() if k != "updated"} == {k: v for k, v in feed.items() if k != "updated"}
    if not same:
        feed["updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        FEED.write_text(json.dumps(feed, ensure_ascii=False, indent=1) + "\n", "utf-8")

    # tidy: covers and clips no post uses any more
    keep = {"avatar.webp"} | {Path(x.get("cover", "")).name for x in feed["highlights"]}
    for m in media:
        keep |= {Path(m.get(k, "")).name for k in ("thumb", "image", "video") if m.get(k)}
    for f in MEDIA.iterdir():
        if f.is_file() and f.name not in keep:
            f.unlink()

    print(f"{'Updated' if not same else 'No change'}: {len(media)} posts, {profile['followers']} followers, {clips} clips.")


if __name__ == "__main__":
    main()
