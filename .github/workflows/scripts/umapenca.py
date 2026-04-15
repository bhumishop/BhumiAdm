import base64
import concurrent.futures
import logging
import mimetypes
import threading
import time
from typing import Optional

import requests

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# GitHub CDN Uploader  (fixed)
# ─────────────────────────────────────────────


class GitHubCdnUploader:
    """Uploads images to GitHub CDN branch via GitHub Contents API.
    Falls back to Supabase Edge Function if direct GitHub API fails.

    Key fixes vs. previous version
    ────────────────────────────────
    * Sequential per-product uploads (workers=1 default) to avoid 409 cascades.
      The GitHub Contents API creates one commit per file; concurrent writes to
      the same branch constantly race on the HEAD SHA.
    * `_use_edge_function` is now protected by a threading.Lock so one thread
      flipping the flag cannot silently poison all other threads mid-run.
    * `_uploaded` / `_webp_generated` counters use a Lock to avoid data races.
    * `_upload_direct` sleeps with exponential back-off between 409 retries
      instead of hammering the API immediately.
    * `upload_product_images` now calls `is_likely_tshirt_placeholder` /
      `is_grey_or_empty_image` to skip grey placeholder images.
    """

    def __init__(
        self,
        token: str,
        owner: str,
        repo: str,
        branch: str = "cdn",
        supabase_url: str = "",
        supabase_key: str = "",
    ):
        self.token = token
        self.owner = owner
        self.repo = repo
        self.branch = branch
        self.base_url = f"https://api.github.com/repos/{owner}/{repo}/contents"
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github.v3+json",
        }

        # Edge-function fallback
        self.supabase_url = supabase_url.rstrip("/") if supabase_url else ""
        self.supabase_key = supabase_key

        # --- thread-safe state ---
        self._lock = threading.Lock()
        self._use_edge_function: bool = False
        self._uploaded: int = 0
        self._webp_generated: int = 0

    # ── public counters (read-only outside this class) ────────────────────────

    @property
    def uploaded(self) -> int:
        with self._lock:
            return self._uploaded

    @property
    def webp_generated(self) -> int:
        with self._lock:
            return self._webp_generated

    # ── branch management ─────────────────────────────────────────────────────

    def ensure_cdn_branch(self) -> bool:
        """Create CDN branch if it doesn't exist."""
        try:
            resp = requests.get(
                f"https://api.github.com/repos/{self.owner}/{self.repo}"
                f"/branches/{self.branch}",
                headers=self.headers,
                timeout=15,
            )
            if resp.ok:
                logger.info(f"CDN branch '{self.branch}' already exists")
                return True

            logger.info(
                f"Creating CDN branch '{self.branch}' from default branch…"
            )
            default_branch = self._get_default_branch()
            ref_resp = requests.get(
                f"https://api.github.com/repos/{self.owner}/{self.repo}"
                f"/git/ref/heads/{default_branch}",
                headers=self.headers,
                timeout=15,
            )
            if not ref_resp.ok:
                logger.error(
                    f"Failed to get default branch ref: {ref_resp.status_code}"
                )
                return False

            sha = ref_resp.json()["object"]["sha"]
            create_resp = requests.post(
                f"https://api.github.com/repos/{self.owner}/{self.repo}/git/refs",
                headers=self.headers,
                json={"ref": f"refs/heads/{self.branch}", "sha": sha},
                timeout=15,
            )
            if create_resp.ok:
                logger.info(f"Created CDN branch '{self.branch}'")
                return True

            logger.error(
                f"Failed to create branch: "
                f"{create_resp.status_code} {create_resp.text}"
            )
            return False

        except Exception as exc:
            logger.error(f"Error ensuring CDN branch: {exc}")
            return False

    def _get_default_branch(self) -> str:
        resp = requests.get(
            f"https://api.github.com/repos/{self.owner}/{self.repo}",
            headers=self.headers,
            timeout=15,
        )
        if resp.ok:
            return resp.json().get("default_branch", "main")
        return "main"

    # ── low-level GitHub helpers ──────────────────────────────────────────────

    def _get_file_sha(self, path: str) -> Optional[str]:
        """Return the blob SHA of an existing file, or None."""
        resp = requests.get(
            f"{self.base_url}/{path}",
            headers=self.headers,
            params={"ref": self.branch},
            timeout=15,
        )
        if resp.ok:
            return resp.json().get("sha")
        return None

    def _make_cdn_url(self, object_path: str) -> str:
        return (
            f"https://cdn.jsdelivr.net/gh/{self.owner}/{self.repo}"
            f"@{self.branch}/{object_path}"
        )

    # ── upload helpers ────────────────────────────────────────────────────────

    def upload_file(
        self,
        file_bytes: bytes,
        object_path: str,
        content_type: str = "image/jpeg",
    ) -> Optional[str]:
        """Upload a single file.  Returns CDN URL or None."""
        with self._lock:
            use_edge = self._use_edge_function

        if not use_edge:
            # Skip if already on CDN
            if self._get_file_sha(object_path):
                logger.debug(f"Already on CDN, skipping: {object_path}")
                return self._make_cdn_url(object_path)

            result = self._upload_direct(file_bytes, object_path, content_type)
            if result:
                return result

            # Direct upload failed — switch all future uploads to edge function
            logger.info(
                "Direct GitHub API failed; switching to Supabase edge function fallback"
            )
            with self._lock:
                self._use_edge_function = True

        return self._upload_via_edge_function(file_bytes, object_path, content_type)

    def _upload_direct(
        self,
        file_bytes: bytes,
        object_path: str,
        content_type: str,
        max_retries: int = 5,
    ) -> Optional[str]:
        """
        PUT file via GitHub Contents API.

        409 Conflict means the branch HEAD has moved since we last read it
        (common when another process is also committing).  We back off and
        re-fetch the SHA before every retry so we never send a stale SHA.
        """
        content_b64 = base64.b64encode(file_bytes).decode("utf-8")

        for attempt in range(max_retries):
            # Always fetch a fresh SHA; the file may have been created between
            # attempts, or a concurrent commit may have changed the branch HEAD.
            existing_sha = self._get_file_sha(object_path)

            payload: dict = {
                "message": f"chore: add product image {object_path}",
                "content": content_b64,
                "branch": self.branch,
            }
            if existing_sha:
                payload["sha"] = existing_sha

            resp = requests.put(
                f"{self.base_url}/{object_path}",
                headers=self.headers,
                json=payload,
                timeout=60,
            )

            if resp.ok:
                with self._lock:
                    self._uploaded += 1
                return self._make_cdn_url(object_path)

            if resp.status_code == 409:
                if attempt < max_retries - 1:
                    sleep_time = 2 ** attempt  # 1s, 2s, 4s, 8s …
                    logger.debug(
                        f"409 on {object_path} (attempt {attempt + 1}/{max_retries}), "
                        f"retrying in {sleep_time}s…"
                    )
                    time.sleep(sleep_time)
                    continue
                logger.warning(
                    f"Giving up on {object_path} after {max_retries} 409 conflicts"
                )
                return None

            # Any other non-OK status
            logger.warning(
                f"Direct CDN upload failed for {object_path}: "
                f"{resp.status_code} {resp.text[:200]}"
            )
            return None

        return None

    def _upload_via_edge_function(
        self,
        file_bytes: bytes,
        object_path: str,
        content_type: str,
    ) -> Optional[str]:
        if not self.supabase_url or not self.supabase_key:
            logger.warning("Edge function not configured (no supabase_url/key)")
            return None

        try:
            form_data = {
                "image": (object_path.split("/")[-1], file_bytes, content_type),
                "path": (None, object_path),
            }
            resp = requests.post(
                f"{self.supabase_url}/functions/v1/upload-cdn-image",
                headers={"Authorization": f"Bearer {self.supabase_key}"},
                files=form_data,
                timeout=120,
            )
            if resp.ok:
                data = resp.json()
                with self._lock:
                    self._uploaded += 1
                return data.get("cdnUrl") or data.get("original")

            logger.warning(
                f"Edge function upload failed: {resp.status_code} {resp.text[:200]}"
            )
            return None

        except Exception as exc:
            logger.warning(f"Edge function upload error: {exc}")
            return None

    def upload_file_with_webp(
        self,
        img_bytes: bytes,
        object_path: str,
        content_type: str = "image/jpeg",
    ) -> dict:
        """Upload original + WebP variant.  Returns {'original': url, 'webp': url}."""
        # import lazily to mirror the top-level HAS_PIL pattern
        try:
            from PIL import Image
            import io as _io

            has_pil = True
        except ImportError:
            has_pil = False

        result = {"original": None, "webp": None}

        result["original"] = self.upload_file(img_bytes, object_path, content_type)

        if has_pil:
            webp_bytes = self._to_webp(img_bytes)
            if webp_bytes:
                webp_path = (
                    object_path.rsplit(".", 1)[0] + ".webp"
                    if "." in object_path
                    else object_path + ".webp"
                )
                result["webp"] = self.upload_file(webp_bytes, webp_path, "image/webp")
                if result["webp"]:
                    with self._lock:
                        self._webp_generated += 1

        return result

    @staticmethod
    def _to_webp(img_bytes: bytes, quality: int = 80) -> Optional[bytes]:
        try:
            from PIL import Image
            import io as _io

            img = Image.open(_io.BytesIO(img_bytes))
            img = img.convert("RGBA" if img.mode in ("RGBA", "LA", "P") else "RGB")
            out = _io.BytesIO()
            img.save(out, format="WEBP", quality=quality)
            return out.getvalue()
        except Exception as exc:
            logger.warning(f"WebP conversion failed: {exc}")
            return None

    # ── product-level upload ──────────────────────────────────────────────────

    def upload_product_images(self, product, client) -> dict:
        """
        Download and upload all images for one product.

        Now calls is_likely_tshirt_placeholder / is_grey_or_empty_image
        (defined in the parent module) to skip grey placeholder images
        that were previously uploaded but shouldn't be.
        """
        # Import the filter helpers from the parent module if available
        try:
            from __main__ import is_likely_tshirt_placeholder, is_grey_or_empty_image
            has_filters = True
        except ImportError:
            has_filters = False

        pid = product.third_party_product_id or product.slug or "unknown"
        is_tshirt = product.category in ("camiseta", "camisetas")

        cdn_urls: list[str] = []
        webp_urls: list[str] = []

        for idx, url in enumerate(product.images):
            img_bytes = client.download_bytes(url)
            if not img_bytes:
                logger.debug(f"[{pid}] Could not download image #{idx}: {url}")
                continue

            # ── placeholder / grey-image filter (was missing before) ──────────
            if has_filters:
                if is_tshirt and is_likely_tshirt_placeholder(img_bytes):
                    logger.info(
                        f"[{pid}] Skipping grey t-shirt placeholder image #{idx}"
                    )
                    continue
                elif not is_tshirt and is_grey_or_empty_image(img_bytes):
                    logger.info(
                        f"[{pid}] Skipping grey/empty image #{idx}"
                    )
                    continue

            content_type = mimetypes.guess_type(url)[0] or "image/jpeg"
            ext = mimetypes.guess_extension(content_type) or ".jpg"
            object_path = f"products/{pid}/{idx:03d}_image{ext}"

            upload_result = self.upload_file_with_webp(
                img_bytes, object_path, content_type
            )
            if upload_result["original"]:
                cdn_urls.append(upload_result["original"])
            if upload_result["webp"]:
                webp_urls.append(upload_result["webp"])

        product.cdn_image_urls = cdn_urls
        product.cdn_webp_urls = webp_urls
        return {"cdn_urls": cdn_urls, "webp_urls": webp_urls}

    # ── batch upload ──────────────────────────────────────────────────────────

    def upload_all(
        self,
        products: list,
        client,
        workers: int = 1,        # ← default changed from 2 → 1
    ) -> dict:
        """
        Upload all product images.

        `workers` defaults to 1 (sequential) because the GitHub Contents API
        serialises commits on a single branch — concurrent writes cause 409
        cascades that exhaust retries and silently drop images.

        Set workers > 1 only if you have confirmed the target branch can
        handle concurrent writes (e.g. via a tree/commit API wrapper).
        """
        if not self.ensure_cdn_branch():
            logger.error("Failed to ensure CDN branch exists; aborting image upload")
            return {}

        if workers > 1:
            logger.warning(
                f"workers={workers} with the GitHub Contents API will likely "
                "cause 409 conflicts. Consider workers=1 for reliability."
            )

        results: dict = {}

        def _upload(p):
            return self.upload_product_images(p, client)

        products_with_images = [p for p in products if p.images]

        try:
            from tqdm import tqdm
            _wrap = lambda it, **kw: tqdm(it, **kw)
        except ImportError:
            _wrap = lambda it, **kw: it

        with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
            future_map = {
                pool.submit(_upload, p): (p.third_party_product_id or p.slug)
                for p in products_with_images
            }
            for fut in _wrap(
                concurrent.futures.as_completed(future_map),
                total=len(future_map),
                desc="Uploading to GitHub CDN",
            ):
                pid = future_map[fut]
                try:
                    results[pid] = fut.result()
                except Exception as exc:
                    logger.error(f"Upload failed for product {pid}: {exc}")
                    results[pid] = {"cdn_urls": [], "webp_urls": []}

        return results
