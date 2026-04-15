#!/usr/bin/env python3
"""
UmaPenca/PrataPrint Product Scraper v4 — HTML-embedded JSON + GitHub CDN

Strategy:
  The PrataPrint store is a SPA. The product list is embedded in the HTML as:
    window.vueInitialData = { "state": "vueProducts", "products": { "hits": [...] } }

  Each product hit contains: id, name, price, type, models (sizes), fabrics (colors),
  images_by_fabric (all gallery images), img_cover, full_link, product_color, etc.

  Images are uploaded to GitHub CDN branch (not Supabase Storage) and jsDelivr URLs
  are stored in the database.

Usage:
    python umapenca.py [--dry-run] [--full] [--output FILE]
    python umapenca.py --upload-images --cdn-branch cdn
    python umapenca.py --url https://umapenca.com/bhumisprint/ --store-id 11205 --sync-to-db

Environment Variables:
    SUPABASE_URL              Supabase project URL
    SUPABASE_SERVICE_ROLE_KEY Service role key (database writes)
    GITHUB_TOKEN              GitHub personal access token (for CDN uploads)
    GITHUB_OWNER              GitHub username/org
    GITHUB_REPO               GitHub repository name (default: BhumiAdm)
    CDN_BRANCH                CDN branch name (default: cdn)
    UMAPENCA_STORE_URL        Store base URL (default: https://prataprint.bhumisparshaschool.org)
    UMAPENCA_STORE_ID         Numeric store ID (default: 11210)
"""

import os
import re
import sys
import json
import time
import logging
import hashlib
import argparse
import mimetypes
import io
from pathlib import Path
from datetime import datetime, timezone
from dataclasses import dataclass, field, asdict
from typing import Optional
from urllib.parse import urljoin, urlparse, urlunparse, unquote

import requests

try:
    from PIL import Image

    HAS_PIL = True
except ImportError:
    HAS_PIL = False

try:
    from tqdm import tqdm

    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("scraper_v4.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────


def _parse_cli_overrides():
    """Parse --url and --store-id early so module-level defaults can be overridden."""
    url = None
    store_id = None
    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == "--url" and i + 1 < len(args):
            url = args[i + 1]
            i += 2
        elif args[i] == "--store-id" and i + 1 < len(args):
            store_id = args[i + 1]
            i += 2
        else:
            i += 1
    return url, store_id


_cli_url, _cli_store_id = _parse_cli_overrides()

STORE_URL = (
    _cli_url
    or os.environ.get("UMAPENCA_STORE_URL", "https://prataprint.bhumisparshaschool.org")
).rstrip("/")
STORE_ID = _cli_store_id or os.environ.get("UMAPENCA_STORE_ID", "11210")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
GITHUB_OWNER = os.environ.get("GITHUB_OWNER", "")
GITHUB_REPO = os.environ.get("GITHUB_REPO", "BhumiAdm")
CDN_BRANCH = os.environ.get("CDN_BRANCH", "cdn")

STANDARD_CARE_TEXT = """Detalhes do produto
Camiseta feita com 100% de fibra natural de algodao sustentavel.
Estampada com impressao digital
Produto vegano atestado pelo selo "PETA Cruelty Free"

Cuidados com a sua camiseta
Passar do avesso: Nunca passe o ferro diretamente sobre a estampa. Vire a camiseta ao avesso e use o ferro em temperatura media ou baixa.
Use um pano protetor: Se precisar passar a camiseta no lado da estampa, coloque um pano de algodao por cima para evitar o contato direto entre o ferro e a estampa.
Evitar vapor direto: O vapor em excesso pode danificar a estampa, portanto, use com cautela ou opte por uma passadoria a seco."""

REQUEST_DELAY = 0.5
MAX_RETRIES = 3
RETRY_DELAY = 4
MAX_WORKERS = 6

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.7",
}

# ─────────────────────────────────────────────
# Data models
# ─────────────────────────────────────────────


@dataclass
class PriceVariant:
    """Size/color variant with its own price and stock"""

    size: Optional[str] = None
    color: Optional[str] = None
    variant_type: Optional[str] = None
    model_id: Optional[int] = None
    fabric_id: Optional[int] = None
    sku: Optional[str] = None
    price: float = 0.0
    compare_at_price: Optional[float] = None
    stock_quantity: int = 0
    is_active: bool = True
    image_url: Optional[str] = None


@dataclass
class ScrapedProduct:
    name: str = ""
    slug: Optional[str] = None
    description: Optional[str] = None
    short_description: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    artist: Optional[str] = None
    info: Optional[str] = None
    price: float = 0.0
    compare_at_price: Optional[float] = None
    image: Optional[str] = None
    images: list = field(default_factory=list)
    variants: list = field(default_factory=list)
    sizes: list = field(default_factory=list)
    colors: list = field(default_factory=list)
    materials: list = field(default_factory=list)
    tags: list = field(default_factory=list)
    weight: float = 0.300
    is_active: bool = True
    third_party_product_id: Optional[str] = None
    third_party_source: str = "uma-penca"
    third_party_product_url: Optional[str] = None
    third_party_raw_data: Optional[dict] = None
    local_image_paths: list = field(default_factory=list)
    cdn_image_urls: list = field(default_factory=list)
    cdn_webp_urls: list = field(default_factory=list)
    metadata: dict = field(default_factory=dict)


@dataclass
class SyncResult:
    processed: int = 0
    inserted: int = 0
    updated: int = 0
    failed: int = 0
    images_uploaded: int = 0
    webp_generated: int = 0
    errors: list = field(default_factory=list)
    duration_seconds: float = 0.0


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────


def strip_imgix_transforms(url: str) -> str:
    """Remove imgix query-string transforms for full-resolution originals."""
    if not url:
        return url
    parsed = urlparse(url)
    if "imgix.net" not in parsed.netloc:
        return url
    return urlunparse(parsed._replace(query=""))


def make_slug(name: str, existing: set) -> str:
    """Generate a URL-safe slug, appending a counter to avoid collisions."""
    base = re.sub(r"[^a-z0-9\s-]", "", name.lower())
    base = re.sub(r"\s+", "-", base).strip("-")
    base = re.sub(r"-+", "-", base)
    slug = base
    counter = 2
    while slug in existing:
        slug = f"{base}-{counter}"
        counter += 1
    existing.add(slug)
    return slug


def category_weight(category: str) -> float:
    return {
        "camisetas": 0.200,
        "camiseta": 0.200,
        "canecas": 0.350,
        "caneca": 0.350,
        "posters": 0.100,
        "poster": 0.100,
        "livros": 0.400,
        "livro": 0.400,
        "bolsas": 0.250,
        "bolsa": 0.250,
        "ecobag": 0.150,
        "bottons": 0.050,
    }.get(category or "", 0.300)


def build_description(raw: dict, type_info: dict) -> str:
    """Build a rich product description from the raw data."""
    product_name = raw.get("name", "")
    type_name = type_info.get("name", "")
    observations = type_info.get("observations", "")
    parts = []
    if type_info.get("url") == "camiseta":
        parts.append(STANDARD_CARE_TEXT)
    if observations:
        obs = observations.replace(";", "\n")
        parts.append(f"\nInformacoes adicionais\n{obs}")
    return "\n".join(parts) if parts else None


def convert_to_webp(img_bytes: bytes, quality: int = 80) -> Optional[bytes]:
    """Convert image bytes to WebP format for web optimization."""
    if not HAS_PIL:
        return None
    try:
        img = Image.open(io.BytesIO(img_bytes))
        if img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGBA")
        else:
            img = img.convert("RGB")
        output = io.BytesIO()
        img.save(output, format="WEBP", quality=quality)
        return output.getvalue()
    except Exception as e:
        logger.warning(f"Failed to convert to WebP: {e}")
        return None


# ─────────────────────────────────────────────
# HTTP client
# ─────────────────────────────────────────────


class Client:
    """Polite HTTP client with rate limiting and retries."""

    def __init__(self, delay: float = REQUEST_DELAY):
        self.delay = delay
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self._last = 0.0

    def _wait(self):
        elapsed = time.time() - self._last
        if elapsed < self.delay:
            time.sleep(self.delay - elapsed)
        self._last = time.time()

    def get(
        self, url: str, as_json: bool = False, extra_headers: dict = None
    ) -> Optional[requests.Response]:
        hdrs = {}
        if extra_headers:
            hdrs.update(extra_headers)
        for attempt in range(MAX_RETRIES):
            try:
                self._wait()
                resp = self.session.get(
                    url, timeout=30, headers=hdrs, allow_redirects=True
                )
                if resp.status_code == 429:
                    wait = int(
                        resp.headers.get("Retry-After", RETRY_DELAY * (attempt + 1))
                    )
                    logger.warning(f"Rate-limited, waiting {wait}s...")
                    time.sleep(wait)
                    continue
                if resp.status_code == 404:
                    return None
                resp.raise_for_status()
                return resp
            except requests.RequestException as exc:
                logger.warning(
                    f"Request failed (attempt {attempt + 1}/{MAX_RETRIES}): {exc}"
                )
                if attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_DELAY * (attempt + 1))
        logger.error(f"Gave up after {MAX_RETRIES} retries: {url}")
        return None

    def download_bytes(self, url: str) -> Optional[bytes]:
        """Download binary content and return as bytes."""
        try:
            self._wait()
            resp = self.session.get(url, timeout=60, stream=True, allow_redirects=True)
            resp.raise_for_status()
            return resp.content
        except Exception as exc:
            logger.warning(f"Image download failed {url}: {exc}")
            return None


# ─────────────────────────────────────────────
# HTML extractor
# ─────────────────────────────────────────────


class HtmlExtractor:
    """Extracts product data from the embedded JSON in the store HTML."""

    VUE_DATA_RE = re.compile(r"window\.vueInitialData\s*=\s*(\{.*?\})\s*;", re.DOTALL)

    def __init__(self, client: Client):
        self.client = client
        parsed = urlparse(STORE_URL)
        self.path_prefix = (
            parsed.path.rstrip("/") if parsed.path and parsed.path != "/" else ""
        )

    def fetch_product_list(self) -> list[dict]:
        """Fetch the store page and extract all product hits."""
        pfx = self.path_prefix
        paths = [f"{pfx}/loja", f"{pfx}/", "/loja", "/"]
        seen = set()
        for path in paths:
            if path in seen:
                continue
            seen.add(path)
            if path.startswith("/"):
                base = f"{urlparse(STORE_URL).scheme}://{urlparse(STORE_URL).netloc}"
                url = f"{base}{path}"
            else:
                url = f"{STORE_URL}/{path}"
            logger.info(f"Fetching {url}")
            resp = self.client.get(url)
            if not resp:
                continue
            data = self._extract_vue_data(resp.text)
            if data:
                products = data.get("products", {})
                hits = products.get("hits", [])
                if hits:
                    total = products.get("totalHits", len(hits))
                    logger.info(f"Found {total} products from {url}")
                    return hits
        logger.warning("Could not extract product list from any page")
        return []

    def fetch_product_detail(self, product_id: str) -> Optional[dict]:
        """Fetch a single product detail page and extract its data."""
        url = f"{STORE_URL}/produto/{product_id}.html"
        resp = self.client.get(url)
        if not resp:
            return None
        data = self._extract_vue_data(resp.text)
        if data:
            products = data.get("products", {})
            hits = products.get("hits", [])
            if hits:
                return hits[0]
            for key in ("product", "item", "currentProduct"):
                if key in data:
                    return data[key]
        return None

    def _extract_vue_data(self, html: str) -> Optional[dict]:
        """Extract and parse window.vueInitialData from HTML."""
        match = self.VUE_DATA_RE.search(html)
        if not match:
            return None
        json_str = match.group(1).strip()
        if json_str.endswith("},"):
            json_str = json_str[:-1]
        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            return self._brute_force_extract(html)

    def _brute_force_extract(self, html: str) -> Optional[dict]:
        """Fallback: find JSON block containing 'totalHits' and 'hits'."""
        start = html.find('"products"')
        if start == -1:
            return None
        obj_start = html.rfind("{", 0, start)
        if obj_start == -1:
            return None
        depth = 0
        in_string = False
        escape_next = False
        for i in range(obj_start, len(html)):
            ch = html[i]
            if escape_next:
                escape_next = False
                continue
            if ch == "\\":
                escape_next = True
                continue
            if ch == '"' and not escape_next:
                in_string = not in_string
                continue
            if in_string:
                continue
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    candidate = html[obj_start : i + 1]
                    try:
                        return json.loads(candidate)
                    except json.JSONDecodeError:
                        pass
                    break
        return None


# ─────────────────────────────────────────────
# Raw data -> ScrapedProduct converter
# ─────────────────────────────────────────────


class ProductConverter:
    """Converts raw Chicorei/PrataPrint API dicts to ScrapedProduct."""

    def __init__(self, existing_slugs: set, store_tag: str = None):
        self.existing_slugs = existing_slugs
        parsed = urlparse(STORE_URL)
        hostname = parsed.hostname or ""
        if "umapenca.com" in hostname:
            path_parts = [p for p in parsed.path.strip("/").split("/") if p]
            self.store_tag = path_parts[0] if path_parts else "bhumisprint"
        else:
            self.store_tag = hostname.split(".")[0] if hostname else "uma-penca"

    def convert(self, raw: dict) -> ScrapedProduct:
        p = ScrapedProduct()
        p.name = raw.get("name", "").strip()
        pid = raw.get("id")
        p.third_party_product_id = str(pid) if pid else None

        type_info = raw.get("type", {}) or {}
        type_url = type_info.get("url", "")
        type_name = type_info.get("name", "")
        p.category = type_url if type_url else None

        store = raw.get("store", {}) or {}
        p.brand = store.get("name", "Prata Print")

        price = raw.get("price", 0) or 0
        price_old = raw.get("price_old", 0) or 0
        p.price = float(price) if price else 0.0
        p.compare_at_price = (
            float(price_old) if price_old and price_old > price else None
        )

        models = raw.get("models", []) or []
        size_map = {}
        for m in models:
            mid = m.get("id")
            mname = m.get("name", "")
            if mid:
                size_map[mid] = m
            if mname and mname not in p.sizes:
                p.sizes.append(mname)

        fabrics = raw.get("fabrics", []) or []
        fabric_map = {}
        for f in fabrics:
            fid = f.get("id")
            fname = f.get("product_color_name", f.get("name", ""))
            if fid:
                fabric_map[fid] = f
            if fname and fname not in p.colors:
                p.colors.append(fname)

        images_by_fabric = raw.get("images_by_fabric", []) or []
        all_image_urls = []
        seen_img_urls = set()

        for img_entry in images_by_fabric:
            img_url = img_entry.get("url", "")
            if img_url:
                clean_url = strip_imgix_transforms(img_url)
                if clean_url not in seen_img_urls:
                    seen_img_urls.add(clean_url)
                    all_image_urls.append(clean_url)

        for img_key in (
            "img_cover",
            "img_male",
            "img_female",
            "img_thumb_png",
            "img_thumb",
        ):
            img = raw.get(img_key)
            if img and isinstance(img, str):
                clean_url = strip_imgix_transforms(img)
                if clean_url not in seen_img_urls:
                    seen_img_urls.add(clean_url)
                    all_image_urls.append(clean_url)

        p.images = all_image_urls
        img_cover = raw.get("img_cover")
        if img_cover:
            p.image = strip_imgix_transforms(img_cover)
        elif all_image_urls:
            p.image = all_image_urls[0]

        for img_entry in images_by_fabric:
            model_id = img_entry.get("product_model_id")
            fabric_id = img_entry.get("fabric_id")
            img_url = img_entry.get("url", "")
            if model_id is None and fabric_id is None:
                continue
            model_info = size_map.get(model_id, {}) if model_id else {}
            fabric_info = fabric_map.get(fabric_id, {}) if fabric_id else {}
            size_name = model_info.get("name")
            color_name = fabric_info.get(
                "product_color_name", fabric_info.get("name", "")
            )
            variant_type = type_name if type_name else None
            sku_parts = [str(pid) if pid else ""]
            if model_info.get("url"):
                sku_parts.append(model_info["url"])
            if fabric_info.get("id"):
                sku_parts.append(f"F{fabric_info['id']}")
            sku = "-".join(sku_parts) if any(sku_parts) else None

            v = PriceVariant(
                size=size_name,
                color=color_name if color_name else None,
                variant_type=variant_type,
                model_id=model_id,
                fabric_id=fabric_id,
                sku=sku,
                price=p.price,
                compare_at_price=p.compare_at_price,
                stock_quantity=0,
                is_active=raw.get("in_stock", True),
                image_url=strip_imgix_transforms(img_url) if img_url else None,
            )
            p.variants.append(asdict(v))

        if not p.variants:
            v = PriceVariant(
                size=None,
                color=raw.get("product_color", {}).get("name")
                if raw.get("product_color")
                else None,
                variant_type=type_name if type_name else None,
                price=p.price,
                compare_at_price=p.compare_at_price,
                stock_quantity=0,
                is_active=raw.get("in_stock", True),
            )
            p.variants.append(asdict(v))

        if type_url == "camiseta":
            p.materials = ["100% algodao"]
        elif type_url == "caneca":
            p.materials = ["Ceramica"]
        elif type_url == "poster":
            p.materials = ["Papel couche 170g"]
        elif type_url == "ecobag":
            p.materials = ["100% algodao cru"]
        elif type_url == "bottons":
            p.materials = ["Metal laminado"]

        p.tags = [self.store_tag, "dropshipping"]
        if type_url and type_url not in p.tags:
            p.tags.append(type_url)
        if type_name and type_name.lower() not in p.tags:
            p.tags.append(type_name.lower())

        p.description = build_description(raw, type_info)
        p.short_description = f"{type_name} '{p.name}' - {p.brand}" if p.name else None
        p.weight = category_weight(type_url)

        clean_name = (
            p.name.replace(" - Prata Print", "")
            .replace(" - Uma Penca", "")
            .replace("-", " ")
            .strip()
        )
        p.slug = make_slug(clean_name, self.existing_slugs)

        full_link = raw.get("full_link", "")
        if full_link and not full_link.startswith("http"):
            full_link = f"{STORE_URL}{full_link}"
        p.third_party_product_url = full_link if full_link else None
        p.is_active = raw.get("in_stock", True)

        p.metadata = {
            "fulfillment_type": "uma_penca",
            "external_store": self.store_tag,
            "product_type": type_name,
            "product_type_url": type_url,
            "is_new": raw.get("is_new", False),
            "is_clothing": raw.get("is_clothing", False),
            "virtual_stock": raw.get("virtual_stock", False),
        }

        p.third_party_raw_data = {
            "scraped_at": datetime.now(timezone.utc).isoformat(),
            "store_id": int(STORE_ID),
            "store_name": p.brand,
            "raw": raw,
        }

        p.third_party_source = self.store_tag
        return p


# ─────────────────────────────────────────────
# GitHub CDN Uploader (local git operations)
# ─────────────────────────────────────────────


class GitHubCdnUploader:
    """Uploads images to GitHub CDN branch by saving files locally
    and using git add/commit/push operations.

    This avoids the GitHub Contents API 409 conflicts that occur
    when creating many commits on the same branch concurrently.
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
        self._uploaded = 0
        self._webp_generated = 0
        self._cdn_dir = Path("cdn_images")
        self._cdn_dir.mkdir(exist_ok=True)

    @property
    def uploaded(self) -> int:
        return self._uploaded

    @property
    def webp_generated(self) -> int:
        return self._webp_generated

    def ensure_cdn_branch(self) -> bool:
        """Checkout/create CDN branch locally."""
        import subprocess

        try:
            # Fetch the branch
            result = subprocess.run(
                ["git", "fetch", "origin", self.branch],
                capture_output=True, text=True, timeout=30
            )
            if result.returncode == 0:
                logger.info(f"CDN branch '{self.branch}' fetched")
            else:
                logger.info(f"CDN branch '{self.branch}' doesn't exist yet, creating...")
                # Create branch from origin/master or origin/main
                for default in ["main", "master"]:
                    result = subprocess.run(
                        ["git", "fetch", "origin", default],
                        capture_output=True, text=True, timeout=30
                    )
                    if result.returncode == 0:
                        break
                result = subprocess.run(
                    ["git", "checkout", "-b", self.branch, f"origin/{default}"],
                    capture_output=True, text=True, timeout=30
                )
                if result.returncode == 0:
                    result = subprocess.run(
                        ["git", "push", "-u", "origin", self.branch],
                        capture_output=True, text=True, timeout=60
                    )
                    if result.returncode == 0:
                        logger.info(f"Created CDN branch '{self.branch}'")
                    else:
                        logger.error(f"Failed to push branch: {result.stderr}")
                        return False
                else:
                    logger.error(f"Failed to create branch: {result.stderr}")
                    return False
                return True

            # Branch exists, checkout
            result = subprocess.run(
                ["git", "checkout", self.branch],
                capture_output=True, text=True, timeout=30
            )
            if result.returncode == 0:
                logger.info(f"Checked out CDN branch '{self.branch}'")
                return True
            else:
                # Create tracking branch
                result = subprocess.run(
                    ["git", "checkout", "--track", f"origin/{self.branch}"],
                    capture_output=True, text=True, timeout=30
                )
                if result.returncode == 0:
                    logger.info(f"Checked out CDN branch '{self.branch}'")
                    return True
                else:
                    logger.error(f"Failed to checkout branch: {result.stderr}")
                    return False

        except Exception as exc:
            logger.error(f"Error ensuring CDN branch: {exc}")
            return False

    def _make_cdn_url(self, object_path: str) -> str:
        return (
            f"https://cdn.jsdelivr.net/gh/{self.owner}/{self.repo}"
            f"@{self.branch}/{object_path}"
        )

    def _save_file_local(self, file_bytes: bytes, object_path: str) -> str:
        """Save file to local cdn_images directory."""
        file_path = self._cdn_dir / object_path
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_bytes(file_bytes)
        return str(file_path)

    def upload_file(
        self,
        file_bytes: bytes,
        object_path: str,
        content_type: str = "image/jpeg",
    ) -> Optional[str]:
        """Save a file locally for later git commit. Returns CDN URL."""
        self._save_file_local(file_bytes, object_path)
        self._uploaded += 1
        return self._make_cdn_url(object_path)

    def upload_file_with_webp(
        self,
        img_bytes: bytes,
        object_path: str,
        content_type: str = "image/jpeg",
    ) -> dict:
        """Upload original + WebP variant. Returns {'original': url, 'webp': url}."""
        result = {"original": None, "webp": None}

        # Save original
        result["original"] = self.upload_file(img_bytes, object_path, content_type)

        # Convert and save WebP
        if HAS_PIL:
            webp_bytes = convert_to_webp(img_bytes)
            if webp_bytes:
                webp_path = (
                    object_path.rsplit(".", 1)[0] + ".webp"
                    if "." in object_path
                    else object_path + ".webp"
                )
                result["webp"] = self.upload_file(webp_bytes, webp_path, "image/webp")
                if result["webp"]:
                    self._webp_generated += 1

        return result

    def upload_product_images(self, product, client) -> dict:
        """Download and save all images for one product locally."""
        pid = product.third_party_product_id or product.slug or "unknown"

        cdn_urls: list[str] = []
        webp_urls: list[str] = []

        for idx, url in enumerate(product.images):
            img_bytes = client.download_bytes(url)
            if not img_bytes:
                logger.debug(f"[{pid}] Could not download image #{idx}: {url}")
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

    def commit_and_push(self) -> bool:
        """Git add, commit, and push all saved images."""
        import subprocess

        if not (self._cdn_dir).exists():
            logger.info("No images to upload")
            return True

        logger.info(f"Committing and pushing {self._uploaded} images to CDN branch...")

        # Configure git credentials
        repo_url = f"https://{self.token}@github.com/{self.owner}/{self.repo}.git"

        # Add all new files
        result = subprocess.run(
            ["git", "add", "cdn_images/"],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode != 0:
            logger.error(f"git add failed: {result.stderr}")
            return False

        # Check if there are changes to commit
        result = subprocess.run(
            ["git", "diff", "--staged", "--quiet"],
            capture_output=True, text=True, timeout=15
        )
        if result.returncode == 0:
            logger.info("No changes to commit")
            return True

        # Commit
        result = subprocess.run(
            ["git", "commit", "-m", f"chore: add {self._uploaded} product images to CDN"],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode != 0:
            logger.error(f"git commit failed: {result.stderr}")
            return False

        # Push
        logger.info(f"Pushing to origin/{self.branch}...")
        result = subprocess.run(
            ["git", "push", "origin", self.branch],
            capture_output=True, text=True, timeout=300
        )
        if result.returncode != 0:
            logger.error(f"git push failed: {result.stderr}")
            return False

        logger.info(f"Successfully pushed {self._uploaded} images to CDN")
        return True

    def upload_all(
        self,
        products: list,
        client,
        workers: int = 1,
    ) -> dict:
        """Save all product images locally, then commit and push."""
        if not self.ensure_cdn_branch():
            logger.error("Failed to checkout CDN branch; aborting image upload")
            return {}

        results: dict = {}

        products_with_images = [p for p in products if p.images]
        total = len(products_with_images)
        logger.info(f"Processing {total} products with images...")

        try:
            from tqdm import tqdm
            _wrap = lambda it, **kw: tqdm(it, **kw)
        except ImportError:
            _wrap = lambda it, **kw: it

        for i, p in _wrap(enumerate(products_with_images), total=total, desc="Saving images"):
            pid = p.third_party_product_id or p.slug
            try:
                results[pid] = self.upload_product_images(p, client)
                logger.info(f"  [{i+1}/{total}] Saved images for {p.name}")
            except Exception as exc:
                logger.error(f"Save failed for product {pid}: {exc}")
                results[pid] = {"cdn_urls": [], "webp_urls": []}

        # After all images saved, commit and push
        if self._uploaded > 0:
            self.commit_and_push()

        return results


# ─────────────────────────────────────────────
# Supabase Database sync
# ─────────────────────────────────────────────


class SupabaseSync:
    def __init__(self, url: str, key: str, subcollection_slug: str = "uma-penca"):
        self.base = f"{url.rstrip('/')}/rest/v1"
        self.hdrs = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        self.subcollection_slug = subcollection_slug

    def _get(self, path: str) -> list:
        resp = requests.get(f"{self.base}/{path}", headers=self.hdrs, timeout=15)
        return resp.json() if resp.ok else []

    def _post(self, path: str, payload) -> requests.Response:
        return requests.post(
            f"{self.base}/{path}", headers=self.hdrs, json=payload, timeout=30
        )

    def _patch(self, path: str, payload: dict) -> requests.Response:
        return requests.patch(
            f"{self.base}/{path}", headers=self.hdrs, json=payload, timeout=30
        )

    def get_collection_id(self, slug: str = "bhumi-print") -> Optional[str]:
        rows = self._get(f"collections?slug=eq.{slug}")
        return rows[0]["id"] if rows else None

    def get_subcollection_id(self, slug: str = None) -> Optional[str]:
        target = slug or self.subcollection_slug
        rows = self._get(f"subcollections?slug=eq.{target}")
        return rows[0]["id"] if rows else None

    def existing_product(
        self, third_party_id: str, source: str = "uma-penca"
    ) -> Optional[dict]:
        if not third_party_id:
            return None
        rows = self._get(
            f"products?third_party_product_id=eq.{third_party_id}"
            f"&third_party_source=eq.{source}&select=id,slug,third_party_synced_at,third_party_raw_data"
        )
        return rows[0] if rows else None

    def product_needs_update(self, product: ScrapedProduct, existing: dict) -> bool:
        """Check if a product needs updating by comparing raw data hashes."""
        if not existing:
            return True
        existing_raw = existing.get("third_party_raw_data") or {}
        existing_hash = existing_raw.get("data_hash")
        current_raw = product.third_party_raw_data or {}
        raw_data = current_raw.get("raw", {})
        current_hash = hashlib.md5(
            json.dumps(raw_data, sort_keys=True).encode()
        ).hexdigest()
        if existing_hash and existing_hash != current_hash:
            return True
        synced_at = existing.get("third_party_synced_at")
        if synced_at:
            try:
                sync_time = datetime.fromisoformat(synced_at.replace("Z", "+00:00"))
                age_hours = (
                    datetime.now(timezone.utc) - sync_time
                ).total_seconds() / 3600
                if age_hours > 24:
                    return True
            except Exception:
                pass
        return False

    def get_all_synced_products(self, source: str = "uma-penca") -> dict:
        """Get all products from DB for incremental sync comparison."""
        rows = self._get(
            f"products?third_party_source=eq.{source}"
            f"&select=id,third_party_product_id,third_party_synced_at,third_party_raw_data"
        )
        result = {}
        for row in rows:
            tp_id = row.get("third_party_product_id")
            if tp_id:
                result[tp_id] = row
        return result

    def upsert_product(
        self,
        product: ScrapedProduct,
        collection_id: Optional[str],
        subcollection_id: Optional[str],
    ) -> dict:
        image = product.cdn_image_urls[0] if product.cdn_image_urls else product.image
        images = product.cdn_image_urls if product.cdn_image_urls else product.images

        raw_data = (product.third_party_raw_data or {}).get("raw", {})
        data_hash = hashlib.md5(
            json.dumps(raw_data, sort_keys=True).encode()
        ).hexdigest()
        if product.third_party_raw_data:
            product.third_party_raw_data["data_hash"] = data_hash

        image_index = {"total_images": len(images), "images": []}
        for idx, img_url in enumerate(images):
            image_index["images"].append(
                {
                    "index": idx,
                    "url": img_url,
                    "webp_url": product.cdn_webp_urls[idx]
                    if idx < len(product.cdn_webp_urls)
                    else None,
                }
            )

        payload = {
            "name": product.name,
            "slug": product.slug,
            "description": product.description,
            "short_description": product.short_description,
            "category": product.category,
            "collection_id": collection_id,
            "subcollection_id": subcollection_id,
            "price": product.price,
            "compare_at_price": product.compare_at_price,
            "stock_type": "print-on-demand",
            "fulfillment_type": "uma penca",
            "artist": product.artist,
            "brand": product.brand,
            "info": product.info,
            "materials": product.materials,
            "tags": product.tags,
            "weight": product.weight,
            "image": image,
            "images": images,
            "shipping_zones": ["BR"],
            "is_active": product.is_active,
            "is_featured": False,
            "is_archived": False,
            "third_party_product_id": product.third_party_product_id,
            "third_party_source": product.third_party_source,
            "third_party_synced_at": datetime.now(timezone.utc).isoformat(),
            "third_party_raw_data": product.third_party_raw_data,
            "product_url": product.third_party_product_url,
            "metadata": {
                **(product.metadata or {}),
                "image_index": image_index,
                "data_hash": data_hash,
                "has_webp": len(product.cdn_webp_urls) > 0,
            },
        }

        existing = self.existing_product(
            product.third_party_product_id or "", product.third_party_source
        )
        if existing:
            resp = self._patch(f"products?id=eq.{existing['id']}", payload)
            action = "updated"
        else:
            resp = self._post("products", payload)
            action = "inserted"

        if resp.ok:
            data = resp.json()
            return {"success": True, "action": action, "data": data}
        return {"success": False, "action": action, "error": resp.text}

    def upsert_variants(self, product_id: int, variants: list) -> None:
        """Delete existing variants then re-insert fresh ones."""
        requests.delete(
            f"{self.base}/product_variants?product_id=eq.{product_id}",
            headers=self.hdrs,
            timeout=15,
        )
        for v in variants:
            v_payload = {
                "product_id": product_id,
                "size": v.get("size"),
                "color": v.get("color"),
                "variant_type": v.get("variant_type"),
                "price_override": v.get("price") if v.get("price") else None,
                "compare_at_price_override": v.get("compare_at_price"),
                "sku": v.get("sku"),
                "stock_quantity": v.get("stock_quantity", 0),
                "is_active": v.get("is_active", True),
                "image_url": v.get("image_url"),
            }
            v_payload = {k: v for k, v in v_payload.items() if v is not None}
            self._post("product_variants", v_payload)

    def log_sync(self, sync_type: str, result: SyncResult):
        self._post(
            "third_party_sync_log",
            {
                "source": "uma-penca",
                "sync_type": sync_type,
                "status": "failed"
                if result.failed and not result.inserted
                else "success",
                "items_processed": result.processed,
                "items_inserted": result.inserted,
                "items_updated": result.updated,
                "items_failed": result.failed,
                "errors": result.errors[:20],
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "duration_seconds": result.duration_seconds,
                "triggered_by": "python-scraper-v4",
            },
        )


# ─────────────────────────────────────────────
# Products.json generator
# ─────────────────────────────────────────────


def generate_products_json(
    products: list[ScrapedProduct], output_path: str, cdn_map: dict = None
):
    """Generate a complete products.json with all data for CI pipeline."""
    parsed = urlparse(STORE_URL)
    hostname = parsed.hostname or "store"
    if "umapenca.com" in hostname:
        path_parts = [p for p in parsed.path.strip("/").split("/") if p]
        store_name = path_parts[0].title().replace("-", " ") if path_parts else "Store"
    else:
        store_name = hostname.split(".")[0].title() if hostname else "Store"

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "store": {
            "url": STORE_URL,
            "id": int(STORE_ID),
            "name": store_name,
        },
        "total_products": len(products),
        "products": [],
    }

    for p in products:
        product_dict = asdict(p)
        if cdn_map and p.third_party_product_id:
            product_dict["cdn_upload_result"] = cdn_map.get(
                p.third_party_product_id, {}
            )
        output["products"].append(product_dict)

    with open(output_path, "w", encoding="utf-8") as fh:
        json.dump(output, fh, indent=2, ensure_ascii=False)
    logger.info(f"Products JSON saved -> {output_path} ({len(products)} products)")
    return output_path


# ─────────────────────────────────────────────
# Orchestrator
# ─────────────────────────────────────────────


def run(args) -> SyncResult:
    start = time.time()
    result = SyncResult()
    client = Client(delay=REQUEST_DELAY)

    # 1. Discover + fetch raw product data
    extractor = HtmlExtractor(client)
    raw_products = []

    if args.product_id:
        logger.info(f"Fetching single product ID: {args.product_id}")
        detail = extractor.fetch_product_detail(args.product_id)
        if detail:
            raw_products = [detail]
        else:
            logger.error(f"Could not fetch product {args.product_id}")
    else:
        raw_products = extractor.fetch_product_list()

    if not raw_products:
        logger.error(
            "No product data found. The store HTML structure may have changed."
        )
        sys.exit(1)

    logger.info(f"Total raw products: {len(raw_products)}")

    # 2. Convert to ScrapedProduct
    slugs = set()
    converter = ProductConverter(slugs)
    products = []
    for raw in raw_products:
        try:
            p = converter.convert(raw)
            if p.name:
                products.append(p)
        except Exception as exc:
            pid = raw.get("id", "?")
            logger.warning(f"Conversion error for product {pid}: {exc}")

    logger.info(f"Converted {len(products)} products")

    # 2.5. Incremental sync: detect changed products
    products_to_sync = products
    skipped_unchanged = 0

    if not args.full and not args.dry_run and SUPABASE_URL and SUPABASE_KEY:
        logger.info("Incremental sync mode: checking for changed products...")
        subcollection = getattr(args, "subcollection", "uma-penca") or "uma-penca"
        supabase_check = SupabaseSync(SUPABASE_URL, SUPABASE_KEY, subcollection)
        synced_products = supabase_check.get_all_synced_products("uma-penca")

        changed_products = []
        for p in products:
            tp_id = p.third_party_product_id
            existing = synced_products.get(tp_id)
            if supabase_check.product_needs_update(p, existing):
                changed_products.append(p)
                if existing:
                    logger.info(f"  Changed: {p.name} (ID: {tp_id})")
                else:
                    logger.info(f"  New: {p.name} (ID: {tp_id})")
            else:
                skipped_unchanged += 1
                logger.debug(f"  Unchanged (skipped): {p.name} (ID: {tp_id})")

        products_to_sync = changed_products
        logger.info(
            f"Incremental sync: {len(products_to_sync)} changed/new, {skipped_unchanged} unchanged"
        )

    # 3. Save raw JSON
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = args.output or f"scraped_products_{ts}.json"

    # 4. Upload images to GitHub CDN
    cdn_map = {}
    if args.upload_images and GITHUB_TOKEN and GITHUB_OWNER:
        branch = getattr(args, "cdn_branch", "cdn") or "cdn"
        uploader = GitHubCdnUploader(
            GITHUB_TOKEN,
            GITHUB_OWNER,
            GITHUB_REPO,
            branch,
            supabase_url=SUPABASE_URL,
            supabase_key=SUPABASE_KEY,
        )
        logger.info(
            f"Uploading images to GitHub CDN: {GITHUB_OWNER}/{GITHUB_REPO}@{branch}"
        )
        if SUPABASE_URL:
            logger.info(
                f"Edge function fallback available: {SUPABASE_URL}/functions/v1/upload-cdn-image"
            )
        cdn_map = uploader.upload_all(products_to_sync, client, workers=1)
        result.images_uploaded = uploader.uploaded
        result.webp_generated = uploader.webp_generated

        # Update product image references to CDN URLs
        for p in products_to_sync:
            if p.cdn_image_urls:
                p.image = p.cdn_image_urls[0]
                p.images = p.cdn_image_urls

    # 5. Generate products.json
    generate_products_json(products, output_file, cdn_map)

    # 6. Sync to Supabase Database
    should_sync_db = (
        args.sync_to_db and not args.dry_run and (SUPABASE_URL and SUPABASE_KEY)
    )

    if should_sync_db:
        subcollection_slug = getattr(args, "subcollection", "uma-penca") or "uma-penca"
        supabase = SupabaseSync(SUPABASE_URL, SUPABASE_KEY, subcollection_slug)

        collection_slug = getattr(args, "collection", None)
        if not collection_slug:
            parsed_store = urlparse(STORE_URL)
            hostname = parsed_store.hostname or ""
            path = (
                parsed_store.path.strip("/").split("/")[0] if parsed_store.path else ""
            )
            if "prataprint" in hostname or "prataprint" in STORE_URL.lower():
                collection_slug = "prata-print"
            elif "bhumisprint" in hostname or "bhumisprint" in path:
                collection_slug = "bhumi-print"
            else:
                collection_slug = "bhumi-print"

        collection_id = supabase.get_collection_id(collection_slug)
        subcollection_id = supabase.get_subcollection_id()
        logger.info(
            f"DB sync: collection='{collection_slug}' subcollection='{subcollection_slug}'"
        )
        if collection_id:
            logger.info(f"  collection_id = {collection_id}")
        if subcollection_id:
            logger.info(f"  subcollection_id = {subcollection_id}")

        for p in products_to_sync:
            result.processed += 1
            try:
                sr = supabase.upsert_product(p, collection_id, subcollection_id)
                if sr["success"]:
                    if sr["action"] == "inserted":
                        result.inserted += 1
                    else:
                        result.updated += 1
                    if p.variants and sr.get("data"):
                        product_db_id = sr["data"][0]["id"]
                        supabase.upsert_variants(product_db_id, p.variants)
                    logger.info(f"{sr['action'].capitalize()}: {p.name}")
                else:
                    result.failed += 1
                    err = f"{p.name}: {sr.get('error', '?')}"
                    result.errors.append(err)
                    logger.error(err)
            except Exception as exc:
                result.failed += 1
                result.errors.append(f"{p.name}: {exc}")
                logger.error(f"Sync error for {p.name}: {exc}")

        result.duration_seconds = time.time() - start
        supabase.log_sync("full" if args.full else "incremental", result)
    elif args.dry_run:
        logger.info("Dry run - skipping DB sync")
    elif not (SUPABASE_URL and SUPABASE_KEY):
        logger.warning("No Supabase credentials - skipping DB sync")
    elif not args.sync_to_db:
        logger.info(
            "No --sync-to-db flag - skipping DB sync (use --output to save JSON)"
        )

    result.duration_seconds = time.time() - start

    # 7. Summary
    print("\n" + "=" * 52)
    print("Sync summary")
    print("=" * 52)
    print(f"  Discovered       : {len(raw_products)}")
    print(f"  Converted        : {len(products)}")
    if skipped_unchanged > 0:
        print(f"  Skipped unchanged  : {skipped_unchanged}")
        print(f"  To sync            : {len(products_to_sync)}")
    print(f"  Inserted         : {result.inserted}")
    print(f"  Updated          : {result.updated}")
    print(f"  Failed           : {result.failed}")
    print(f"  Images uploaded  : {result.images_uploaded}")
    print(f"  WebP generated   : {result.webp_generated}")
    print(f"  Duration         : {result.duration_seconds:.1f}s")
    if result.errors:
        print(f"\n  Errors ({len(result.errors)}):")
        for e in result.errors[:5]:
            print(f"    - {e}")

    return result


# ─────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser(
        description="UmaPenca/PrataPrint Scraper v4 - HTML-embedded JSON + GitHub CDN"
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Scrape but skip DB write"
    )
    parser.add_argument("--full", action="store_true", help="Full sync (all products)")
    parser.add_argument("--product-id", help="Fetch a single product by numeric ID")
    parser.add_argument("--output", help="Output JSON file")
    parser.add_argument(
        "--upload-images", action="store_true", help="Upload images to GitHub CDN"
    )
    parser.add_argument(
        "--cdn-branch", default="cdn", help="CDN branch name (default: cdn)"
    )
    parser.add_argument(
        "--storage-bucket", default=None, help="Deprecated: use CDN instead"
    )
    parser.add_argument(
        "--url", default=None, help="Store URL to scrape (overrides env)"
    )
    parser.add_argument(
        "--store-id", default=None, help="Store numeric ID (overrides env)"
    )
    parser.add_argument(
        "--subcollection", default="uma-penca", help="Subcollection slug for DB sync"
    )
    parser.add_argument(
        "--collection",
        default=None,
        help="Collection slug for DB sync (auto-detect if not set)",
    )
    parser.add_argument(
        "--sync-to-db", action="store_true", help="Sync scraped products to Supabase DB"
    )
    args = parser.parse_args()

    # Apply CLI url/store-id overrides to globals
    if args.url:
        global STORE_URL
        STORE_URL = args.url.rstrip("/")
    if args.store_id:
        global STORE_ID
        STORE_ID = args.store_id

    logger.info(f"Store: {STORE_URL} (ID {STORE_ID})")
    logger.info(f"CDN: {GITHUB_OWNER}/{GITHUB_REPO}@{args.cdn_branch}")
    logger.info(f"Dry run: {args.dry_run}")
    logger.info(f"Upload images: {args.upload_images}")
    logger.info(f"Sync to DB: {args.sync_to_db}")

    result = run(args)
    sys.exit(1 if result.failed and not result.inserted else 0)


if __name__ == "__main__":
    main()
