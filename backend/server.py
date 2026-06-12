"""TikTok Downloader backend.

Acts as a server-side proxy for the public tikwm.com endpoints so the mobile
app does not have to call third-party origins directly (avoids CORS / TLS
quirks on the Expo preview and lets us normalize the response shape).
"""

from fastapi import FastAPI, APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import re
import logging
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional, Any, Dict
import httpx


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

app = FastAPI(title="TikTok Downloader API")
api_router = APIRouter(prefix="/api")

TIKWM_BASE = "https://www.tikwm.com"
HTTP_TIMEOUT = 25.0


# ---------- Models ----------

class ResolveRequest(BaseModel):
    url: str
    hd: bool = True


class MediaItem(BaseModel):
    id: str
    type: str  # "video" | "photo"
    title: Optional[str] = None
    cover: Optional[str] = None
    duration: Optional[int] = None
    create_time: Optional[int] = None
    # For video posts:
    play: Optional[str] = None       # HD / no watermark playback URL
    play_sd: Optional[str] = None    # Lower-quality fallback
    wmplay: Optional[str] = None     # With watermark fallback
    size: Optional[int] = None
    # For photo posts:
    images: Optional[List[str]] = None
    author_id: Optional[str] = None
    author_unique_id: Optional[str] = None


class UserInfo(BaseModel):
    unique_id: str
    nickname: Optional[str] = None
    avatar: Optional[str] = None
    signature: Optional[str] = None
    follower_count: Optional[int] = None
    video_count: Optional[int] = None
    verified: Optional[bool] = None


class PostsResponse(BaseModel):
    items: List[MediaItem]
    cursor: Optional[str] = None
    has_more: bool = False


# ---------- Helpers ----------

USERNAME_RE = re.compile(r"@([A-Za-z0-9_.]+)")


def _extract_username(value: str) -> Optional[str]:
    """Accept '@user', a tiktok.com profile URL, or a bare username."""
    value = value.strip()
    if not value:
        return None
    m = USERNAME_RE.search(value)
    if m:
        return m.group(1).lower()
    # Bare username (no @)
    if re.fullmatch(r"[A-Za-z0-9_.]+", value):
        return value.lower()
    return None


def _normalize_video(d: Dict[str, Any]) -> MediaItem:
    images = d.get("images") or None
    is_photo = bool(images)
    vid = str(d.get("id") or d.get("video_id") or d.get("aweme_id") or "")
    author = d.get("author") or {}
    if isinstance(author, dict):
        author_unique_id = author.get("unique_id") or author.get("uniqueId")
        author_id = str(author.get("id") or "") or None
    else:
        author_unique_id = None
        author_id = None
    return MediaItem(
        id=vid,
        type="photo" if is_photo else "video",
        title=d.get("title"),
        cover=d.get("origin_cover") or d.get("cover"),
        duration=d.get("duration"),
        create_time=d.get("create_time"),
        play=d.get("hdplay") or d.get("play"),
        play_sd=d.get("play"),
        wmplay=d.get("wmplay"),
        size=d.get("hd_size") or d.get("size"),
        images=images,
        author_id=author_id,
        author_unique_id=author_unique_id,
    )


async def _tikwm_get(path: str, params: Dict[str, Any]) -> Dict[str, Any]:
    url = f"{TIKWM_BASE}{path}"
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT, follow_redirects=True) as client:
        try:
            r = await client.get(url, params=params, headers={
                "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile",
                "Accept": "application/json",
            })
            r.raise_for_status()
            data = r.json()
        except httpx.HTTPError as e:
            # Network / DNS / transport-level problems. Use 422 so the JSON body
            # survives Cloudflare-style edge gateways (which strip 502 bodies).
            raise HTTPException(status_code=422, detail=f"network: {e}")
    if data.get("code") != 0:
        msg = data.get("msg") or "tikwm error"
        # tikwm uses code != 0 for "no such user", "url parse failed", rate limit,
        # etc. — these are business / client errors, not gateway errors.
        raise HTTPException(status_code=422, detail=f"upstream: {msg}")
    return data.get("data") or {}


# ---------- Routes ----------

@api_router.get("/")
async def root():
    return {"ok": True, "service": "tiktok-downloader"}


@api_router.post("/tt/resolve", response_model=MediaItem)
async def resolve_url(body: ResolveRequest):
    """Resolve a single TikTok URL (video or photo post) into a MediaItem."""
    data = await _tikwm_get("/api/", {"url": body.url, "hd": 1 if body.hd else 0})
    return _normalize_video(data)


@api_router.get("/tt/user/info", response_model=UserInfo)
async def user_info(unique_id: str = Query(..., description="@handle or bare username")):
    uid = _extract_username(unique_id)
    if not uid:
        raise HTTPException(status_code=400, detail="invalid username")
    data = await _tikwm_get("/api/user/info", {"unique_id": uid})
    user = (data.get("user") or {})
    stats = (data.get("stats") or {})
    return UserInfo(
        unique_id=(user.get("uniqueId") or uid).lower(),
        nickname=user.get("nickname"),
        avatar=user.get("avatarLarger") or user.get("avatarMedium") or user.get("avatarThumb"),
        signature=user.get("signature"),
        follower_count=stats.get("followerCount"),
        video_count=stats.get("videoCount"),
        verified=user.get("verified"),
    )


@api_router.get("/tt/user/posts", response_model=PostsResponse)
async def user_posts(
    unique_id: str = Query(...),
    cursor: str = Query("0"),
    count: int = Query(30, ge=1, le=35),
):
    uid = _extract_username(unique_id)
    if not uid:
        raise HTTPException(status_code=400, detail="invalid username")
    data = await _tikwm_get("/api/user/posts", {
        "unique_id": uid,
        "count": count,
        "cursor": cursor,
    })
    raw_items = data.get("videos") or []
    items = [_normalize_video(v) for v in raw_items]
    return PostsResponse(
        items=items,
        cursor=str(data.get("cursor") or ""),
        has_more=bool(data.get("hasMore")),
    )


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("tiktok-dl")
