"""Backend API tests for TikTok Downloader proxy.

Covers all endpoints under /api/ with happy paths, error paths, username
normalization, and pagination. Tikwm.com is rate-limited so transient 502s
are retried once.
"""
import time
import pytest
import requests


def _get(api_client, base_url, path, params=None, retries=1):
    """GET with one retry on upstream 502 (tikwm rate-limit)."""
    last = None
    for attempt in range(retries + 1):
        r = api_client.get(f"{base_url}{path}", params=params, timeout=30)
        last = r
        if r.status_code != 502:
            return r
        time.sleep(1.5)
    return last


def _post(api_client, base_url, path, json=None, retries=1):
    last = None
    for attempt in range(retries + 1):
        r = api_client.post(f"{base_url}{path}", json=json, timeout=30)
        last = r
        if r.status_code != 502:
            return r
        time.sleep(1.5)
    return last


# ---------- Health ----------

class TestHealth:
    def test_root_ok(self, api_client, base_url):
        r = _get(api_client, base_url, "/api/")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        assert data.get("service") == "tiktok-downloader"


# ---------- User info ----------

class TestUserInfo:
    def test_user_info_valid(self, api_client, base_url):
        r = _get(api_client, base_url, "/api/tt/user/info", {"unique_id": "tiktok"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["unique_id"]
        assert data.get("nickname")
        assert data.get("avatar", "").startswith("http")
        assert isinstance(data.get("follower_count"), int)
        assert data["follower_count"] > 0

    def test_user_info_invalid_username_returns_error(self, api_client, base_url):
        r = _get(
            api_client,
            base_url,
            "/api/tt/user/info",
            {"unique_id": "invalid_user_xxx_yyy"},
        )
        # tikwm returns code != 0 -> backend turns into 502.
        # NOTE: through k8s ingress the body is rewritten to Cloudflare HTML
        # (see report). We only assert on the status code at the public edge.
        assert r.status_code in (400, 404, 422, 502), f"got {r.status_code}: {r.text}"
        ctype = r.headers.get("content-type", "")
        if "application/json" in ctype:
            assert "detail" in r.json()

    def test_user_info_bad_format_returns_400(self, api_client, base_url):
        # Symbols not allowed by _extract_username -> 400
        r = _get(api_client, base_url, "/api/tt/user/info", {"unique_id": "!!!!"})
        assert r.status_code == 400
        assert r.json()["detail"] == "invalid username"

    @pytest.mark.parametrize(
        "raw",
        [
            "@tiktok",
            "tiktok",
            "https://www.tiktok.com/@tiktok",
        ],
    )
    def test_username_extraction_variants(self, api_client, base_url, raw):
        r = _get(api_client, base_url, "/api/tt/user/info", {"unique_id": raw})
        assert r.status_code == 200, f"raw={raw} -> {r.status_code} {r.text}"
        data = r.json()
        assert data["unique_id"].lower() == "tiktok"


# ---------- User posts (pagination) ----------

class TestUserPosts:
    def test_user_posts_basic(self, api_client, base_url):
        r = _get(
            api_client,
            base_url,
            "/api/tt/user/posts",
            {"unique_id": "tiktok", "cursor": "0", "count": 10},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "items" in data
        assert isinstance(data["items"], list)
        assert len(data["items"]) > 0
        # Pagination flags
        assert "cursor" in data
        assert "has_more" in data
        assert isinstance(data["has_more"], bool)
        # Validate item shape
        first = data["items"][0]
        assert first["id"]
        assert first["type"] in ("video", "photo")
        # cover may be None for some items, but key must exist
        assert "cover" in first
        # play is required for video posts (or images for photos)
        if first["type"] == "video":
            assert first.get("play"), "video item missing play URL"
        else:
            assert first.get("images"), "photo item missing images"

    def test_user_posts_pagination_no_overlap(self, api_client, base_url):
        r1 = _get(
            api_client,
            base_url,
            "/api/tt/user/posts",
            {"unique_id": "tiktok", "cursor": "0", "count": 10},
        )
        assert r1.status_code == 200, r1.text
        page1 = r1.json()
        ids1 = {item["id"] for item in page1["items"]}
        assert ids1, "first page empty"

        if not page1.get("has_more"):
            pytest.skip("Account has no second page")

        next_cursor = page1.get("cursor")
        assert next_cursor and next_cursor != "0", f"unexpected cursor: {next_cursor}"

        time.sleep(1.0)  # be polite with tikwm
        r2 = _get(
            api_client,
            base_url,
            "/api/tt/user/posts",
            {"unique_id": "tiktok", "cursor": next_cursor, "count": 10},
        )
        assert r2.status_code == 200, r2.text
        page2 = r2.json()
        ids2 = {item["id"] for item in page2["items"]}
        assert ids2, "second page empty"
        overlap = ids1 & ids2
        assert not overlap, f"pages overlap: {overlap}"


# ---------- Resolve ----------

class TestResolve:
    def test_resolve_video_hd(self, api_client, base_url):
        payload = {
            "url": "https://www.tiktok.com/@tiktok/video/7650300237860424990",
            "hd": True,
        }
        r = _post(api_client, base_url, "/api/tt/resolve", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["id"]
        assert data["type"] in ("video", "photo")
        if data["type"] == "video":
            assert data.get("play"), "missing HD play URL"
            assert data["play"].startswith("http")
        else:
            assert data.get("images")

    def test_resolve_invalid_url_returns_502(self, api_client, base_url):
        payload = {"url": "https://not-a-real-domain.example/abc", "hd": True}
        r = _post(api_client, base_url, "/api/tt/resolve", json=payload, retries=0)
        assert r.status_code == 502, f"got {r.status_code}: {r.text}"
        # NOTE: through k8s ingress the body is rewritten to Cloudflare HTML
        # for 5xx upstream responses; only check JSON detail when JSON is
        # actually returned (i.e. when hitting backend directly).
        ctype = r.headers.get("content-type", "")
        if "application/json" in ctype:
            assert "detail" in r.json()
