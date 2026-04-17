#!/usr/bin/env python3
"""
UICLAP Product Scraper v4 — JSON-LD Schema.org + GitHub CDN

Strategy:
  UICLAP has two entry points:

  1. Author bio page  https://uiclap.bio/{author_slug}
     The HTML embeds a <script type="application/ld+json"> block containing
     a @graph array with:
       - @type: Person   → author metadata (name, image, jobTitle)
       - @type: Product  → one entry per book/edition (name, sku, price, image, description, url)

  2. Book detail page  https://loja.uiclap.com/titulo/ua{sku}/
     Also embeds JSON-LD with extended info: pages, weight, dimensions,
     synopsis, format (físico/digital/combo), ISBN, category.
     Additional structured data may appear as window.__NEXT_DATA__ (Next.js).

  Image pattern:
    Cover  → http://images.uiclap.com/capa/ua{sku}.jpg
    Author → http://images.uiclap.com/bio/{user_id}.jpg
    (replace http with https — both work)

  SKU pattern:
    Short SKUs  e.g. 38350  → URL slug  ua38350
    Long SKUs   e.g. 153603 → URL slug  ua153603
    The canonical URL is always https://loja.uiclap.com/titulo/ua{sku}/

  Images are uploaded to GitHub CDN branch (not Supabase Storage) and jsDelivr URLs
  are stored in the database.

Usage:
    python uiclap.py --bio-url https://uiclap.bio/levikarmadrum
    python uiclap.py --bio-url https://uiclap.bio/levikarmadrum --fetch-details
    python uiclap.py --bio-url https://uiclap.bio/levikarmadrum --upload-images --cdn-branch cdn
    python uiclap.py --bio-url https://uiclap.bio/levikarmadrum --sync-to-db
    python uiclap.py --sku 38350                          # single product
    python uiclap.py --sku 38350 --sync-to-db

Arguments:
    --bio-url           Author bio URL (uiclap.bio/{slug})
    --sku               Single product SKU (numeric, with or without 'ua' prefix)
    --fetch-details     Fetch detail page for each product (adds pages, weight, synopsis, etc.)
    --dry-run           Parse and print but skip DB/CDN writes
    --full              Full sync (all products, no incremental check)
    --output FILE       Path to write products JSON (default: scraped_uiclap_{ts}.json)
    --upload-images     Upload cover images to GitHub CDN
    --cdn-branch        CDN branch name (default: cdn)
    --collection        Collection slug for DB (default: bhumi-livros)
    --subcollection     Subcollection slug for DB (default: uiclap)
    --sync-to-db        Sync to Supabase database

Environment Variables:
    SUPABASE_URL              Supabase project URL
    SUPABASE_SERVICE_ROLE_KEY Service role key (database writes)
    GITHUB_TOKEN              GitHub personal access token (for CDN uploads)
    GITHUB_OWNER              GitHub username/org
    GITHUB_REPO               GitHub repository name (default: BhumiAdm)
    CDN_BRANCH                CDN branch name (default: cdn)
    UICLAP_BIO_URL            Author bio URL (overridden by --bio-url)
    UICLAP_AUTHOR_SLUG        Author slug only (e.g. levikarmadrum)
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
import base64
import concurrent.futures
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
        logging.FileHandler("scraper_uiclap_v4.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────

UICLAP_BIO_BASE = "https://uiclap.bio"
UICLAP_STORE_BASE = "https://loja.uiclap.com"
UICLAP_IMG_BASE = "https://images.uiclap.com"

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
GITHUB_OWNER = os.environ.get("GITHUB_OWNER", "")
GITHUB_REPO = os.environ.get("GITHUB_REPO", "BhumiAdm")
CDN_BRANCH = os.environ.get("CDN_BRANCH", "cdn")

REQUEST_DELAY = 0.8
MAX_RETRIES = 3
RETRY_DELAY = 4

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
class BookVariant:
    """Physical / digital / combo edition of the same title."""

    format: Optional[str] = None  # "físico", "digital", "combo"
    sku: Optional[str] = None
    price: float = 0.0
    compare_at_price: Optional[float] = None
    stock_quantity: int = 0
    is_active: bool = True
    url: Optional[str] = None
    image_url: Optional[str] = None
    pages: Optional[int] = None
    weight_kg: Optional[float] = None
    isbn: Optional[str] = None
    dimensions: Optional[str] = None


@dataclass
class ScrapedBook:
    # Identity
    name: str = ""
    slug: Optional[str] = None
    description: Optional[str] = None
    short_description: Optional[str] = None
    category: Optional[str] = "livros"
    brand: str = "UICLAP"
    artist: Optional[str] = None  # author name
    author_slug: Optional[str] = None
    info: Optional[str] = None

    # Pricing — lowest variant price
    price: float = 0.0
    compare_at_price: Optional[float] = None

    # Media
    image: Optional[str] = None
    images: list = field(default_factory=list)
    author_image: Optional[str] = None

    # Variants (physical / digital / combo — each has its own SKU and price)
    variants: list = field(default_factory=list)  # list[BookVariant]

    # Flat metadata
    sizes: list = field(default_factory=list)
    colors: list = field(default_factory=list)
    materials: list = field(default_factory=list)
    tags: list = field(default_factory=list)
    pages: Optional[int] = None
    isbn: Optional[str] = None
    dimensions: Optional[str] = None

    # Physical
    weight: float = 0.300

    # Status
    is_active: bool = True

    # Third-party tracking
    third_party_product_id: Optional[str] = None  # primary SKU
    third_party_source: str = "uiclap"
    third_party_product_url: Optional[str] = None
    third_party_raw_data: Optional[dict] = None

    # CDN storage
    cdn_image_urls: list = field(default_factory=list)
    cdn_webp_urls: list = field(default_factory=list)
    local_image_paths: list = field(default_factory=list)

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


def normalize_sku(sku) -> str:
    """Normalize SKU: strip 'ua' prefix, return numeric string."""
    s = str(sku).strip().lower()
    return s[2:] if s.startswith("ua") else s


def cover_url(sku) -> str:
    """Canonical cover image URL for a given SKU."""
    return f"{UICLAP_IMG_BASE}/capa/ua{normalize_sku(sku)}.jpg"


def store_url(sku) -> str:
    """Canonical store page URL for a given SKU."""
    return f"{UICLAP_STORE_BASE}/titulo/ua{normalize_sku(sku)}/"


def make_slug(name: str, existing: set) -> str:
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


def detect_format(url: str, sku: str) -> str:
    """Guess product format from URL or context clues."""
    url_lower = url.lower()
    if "digital" in url_lower or "ebook" in url_lower:
        return "digital"
    if "combo" in url_lower:
        return "combo"
    return "físico"


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
    def __init__(self, delay: float = REQUEST_DELAY):
        self.delay = delay
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        # images.uiclap.com has a cert mismatch — disable verify for that host
        self.session.mount(
            "https://images.uiclap.com", requests.adapters.HTTPAdapter(max_retries=3)
        )
        import urllib3

        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        self._last = 0.0

    def _wait(self):
        elapsed = time.time() - self._last
        if elapsed < self.delay:
            time.sleep(self.delay - elapsed)
        self._last = time.time()

    def get(self, url: str) -> Optional[requests.Response]:
        for attempt in range(MAX_RETRIES):
            try:
                self._wait()
                # Disable verify for images.uiclap.com
                verify = "images.uiclap.com" not in url
                resp = self.session.get(
                    url, timeout=30, allow_redirects=True, verify=verify
                )
                resp.encoding = "utf-8"
                if resp.status_code == 429:
                    wait = int(
                        resp.headers.get("Retry-After", RETRY_DELAY * (attempt + 1))
                    )
                    logger.warning(f"Rate-limited, waiting {wait}s…")
                    time.sleep(wait)
                    continue
                if resp.status_code == 404:
                    logger.debug(f"404: {url}")
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
        try:
            self._wait()
            verify = "images.uiclap.com" not in url
            resp = self.session.get(
                url, timeout=60, stream=True, allow_redirects=True, verify=verify
            )
            resp.raise_for_status()
            return resp.content
        except Exception as exc:
            logger.warning(f"Download failed {url}: {exc}")
            return None


# ─────────────────────────────────────────────
# JSON-LD extractor
# ─────────────────────────────────────────────


class JsonLdExtractor:
    """
    Extracts structured data from UICLAP HTML pages.

    Bio page (uiclap.bio/{slug}):
      - Contains a single <script type="application/ld+json"> with a @graph
        array holding Person + Product nodes.

    Detail page (loja.uiclap.com/titulo/ua{sku}/):
      - May contain multiple <script type="application/ld+json"> blocks.
      - May also expose window.__NEXT_DATA__ (Next.js) with richer detail.
      - Relevant JSON-LD type: Product (with Offer) or Book.
    """

    # Matches <script type="application/ld+json">...</script>
    JSONLD_RE = re.compile(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        re.DOTALL | re.IGNORECASE,
    )
    # Matches window.__NEXT_DATA__ = {...}
    NEXT_DATA_RE = re.compile(
        r"window\.__NEXT_DATA__\s*=\s*(\{.*?\})\s*(?:;|</script>)",
        re.DOTALL,
    )

    def __init__(self, client: Client):
        self.client = client

    # ── Bio page ──────────────────────────────────────────────

    def fetch_bio(self, bio_url: str) -> dict:
        """
        Fetch an author bio page and return:
          {
            "author": { name, image, jobTitle, url },
            "products": [ { sku, name, description, price, image, url }, ... ]
          }
        """
        resp = self.client.get(bio_url)
        if not resp:
            return {}

        author_slug = bio_url.rstrip("/").split("/")[-1]
        all_products = []
        author_info = {}

        for block in self._iter_jsonld(resp.text):
            graph = block.get("@graph", [])

            # Handle both flat single-object and @graph array
            if not graph:
                # The whole block might be a single Product or Person
                graph = [block]

            for node in graph:
                t = node.get("@type", "")
                if t == "Person":
                    author_info = {
                        "name": node.get("name", ""),
                        "image": node.get("image", ""),
                        "jobTitle": node.get("jobTitle", ""),
                        "url": node.get("url", bio_url),
                        "sameAs": node.get("sameAs", []),
                    }
                elif t == "Product":
                    offers = node.get("offers", {}) or {}
                    sku_raw = node.get("sku", "")
                    sku = normalize_sku(sku_raw) if sku_raw else None

                    desc = node.get("description", "")
                    if desc in ("null", "None", None):
                        desc = None

                    p = {
                        "sku": sku,
                        "name": node.get("name", "").strip(),
                        "description": desc,
                        "image": cover_url(sku) if sku else node.get("image", ""),
                        "price": float(offers.get("price", 0) or 0),
                        "currency": offers.get("priceCurrency", "BRL"),
                        "url": offers.get("url") or (store_url(sku) if sku else ""),
                        "brand": node.get("brand", "UICLAP"),
                        "raw_ld": node,
                    }
                    all_products.append(p)

        return {
            "author": author_info,
            "author_slug": author_slug,
            "products": all_products,
            "source_url": bio_url,
        }

    # ── Detail page ───────────────────────────────────────────

    def fetch_detail(self, sku: str) -> dict:
        """
        Fetch a product detail page and return enriched metadata:
          pages, weight, isbn, dimensions, synopsis, formats (variants),
          category, full description, all image URLs.
        """
        url = store_url(sku)
        resp = self.client.get(url)
        if not resp:
            return {}

        detail = {
            "sku": sku,
            "url": url,
            "variants": [],  # list of {sku, format, price, url}
            "pages": None,
            "weight_kg": None,
            "isbn": None,
            "dimensions": None,
            "synopsis": None,
            "category": None,
            "images": [cover_url(sku)],  # always include canonical cover
        }

        # ── JSON-LD blocks ────────────────────────────────────
        for block in self._iter_jsonld(resp.text):
            graph = block.get("@graph", [block])
            for node in graph:
                t = node.get("@type", "")
                if t in ("Product", "Book"):
                    self._enrich_from_ld_node(detail, node)

        # ── Next.js __NEXT_DATA__ ─────────────────────────────
        next_data = self._extract_next_data(resp.text)
        if next_data:
            self._enrich_from_next_data(detail, next_data)

        # ── HTML fallback — scrape visible fields ─────────────
        self._enrich_from_html(detail, resp.text)

        return detail

    # ── Internal helpers ──────────────────────────────────────

    def _iter_jsonld(self, html: str):
        """Yield all parsed JSON-LD blocks from HTML."""
        for m in self.JSONLD_RE.finditer(html):
            raw = m.group(1).strip()
            try:
                yield json.loads(raw)
            except json.JSONDecodeError:
                # Try stripping trailing comma
                try:
                    yield json.loads(raw.rstrip(","))
                except Exception:
                    pass

    def _extract_next_data(self, html: str) -> Optional[dict]:
        m = self.NEXT_DATA_RE.search(html)
        if not m:
            # Also try <script id="__NEXT_DATA__">
            tag_m = re.search(
                r'<script[^>]+id=["\']__NEXT_DATA__["\'][^>]*>(.*?)</script>',
                html,
                re.DOTALL | re.IGNORECASE,
            )
            if tag_m:
                try:
                    return json.loads(tag_m.group(1).strip())
                except Exception:
                    return None
            return None
        try:
            return json.loads(m.group(1))
        except Exception:
            return None

    def _enrich_from_ld_node(self, detail: dict, node: dict):
        """Merge JSON-LD Product/Book node data into detail dict."""
        offers = node.get("offers", {}) or {}

        # Handle both single Offer and AggregateOffer / list
        offer_list = []
        if isinstance(offers, list):
            offer_list = offers
        elif isinstance(offers, dict):
            if offers.get("@type") == "AggregateOffer":
                offer_list = offers.get("offers", [offers])
            else:
                offer_list = [offers]

        for offer in offer_list:
            sku_raw = offer.get("sku") or node.get("sku")
            sku = normalize_sku(sku_raw) if sku_raw else detail["sku"]
            price = float(offer.get("price", 0) or 0)
            o_url = offer.get("url", store_url(sku))
            fmt = detect_format(o_url, sku)
            avail = offer.get("availability", "")
            active = "OutOfStock" not in avail

            # Avoid duplicates
            existing_skus = {v["sku"] for v in detail["variants"]}
            if sku not in existing_skus:
                detail["variants"].append(
                    {
                        "sku": sku,
                        "format": fmt,
                        "price": price,
                        "url": o_url,
                        "is_active": active,
                    }
                )

        # Synopsis / description
        desc = node.get("description", "")
        if desc and desc not in ("null", "None") and not detail.get("synopsis"):
            detail["synopsis"] = desc

        # Category / genre
        if not detail.get("category"):
            detail["category"] = node.get("genre") or node.get("category")

        # Book-specific fields
        if node.get("@type") == "Book":
            if not detail["pages"] and node.get("numberOfPages"):
                try:
                    detail["pages"] = int(node["numberOfPages"])
                except (ValueError, TypeError):
                    pass
            if not detail["isbn"]:
                detail["isbn"] = node.get("isbn") or node.get("gtin13")
            if not detail["weight_kg"] and node.get("weight"):
                # weight may be "0.3 kg" or numeric
                w = str(node["weight"]).replace("kg", "").strip()
                try:
                    detail["weight_kg"] = float(w)
                except ValueError:
                    pass

        # Additional images
        img = node.get("image")
        if img:
            imgs = img if isinstance(img, list) else [img]
            for i in imgs:
                if i and i not in detail["images"]:
                    detail["images"].append(i)

    def _enrich_from_next_data(self, detail: dict, next_data: dict):
        """
        Parse Next.js page props. UICLAP typically nests data as:
          props.pageProps.livro  or  props.pageProps.titulo  or  props.pageProps.data
        """
        try:
            page_props = next_data.get("props", {}).get("pageProps", {})
        except AttributeError:
            return

        # Try common keys for the book object
        book = (
            page_props.get("livro")
            or page_props.get("titulo")
            or page_props.get("book")
            or page_props.get("product")
            or page_props.get("data")
            or {}
        )

        if not book:
            # Flatten search: look for any dict with 'paginas' or 'numero_paginas'
            book = self._find_nested(
                next_data, ("paginas", "numero_paginas", "sinopse", "peso")
            )

        if not book:
            return

        # Pages
        pages = book.get("paginas") or book.get("numero_paginas") or book.get("pages")
        if pages and not detail["pages"]:
            try:
                detail["pages"] = int(pages)
            except (ValueError, TypeError):
                pass

        # Weight
        weight = book.get("peso") or book.get("weight") or book.get("peso_kg")
        if weight and not detail["weight_kg"]:
            try:
                detail["weight_kg"] = float(str(weight).replace("kg", "").strip())
            except (ValueError, TypeError):
                pass

        # ISBN
        isbn = book.get("isbn") or book.get("isbn13") or book.get("codigo_barras")
        if isbn and not detail["isbn"]:
            detail["isbn"] = str(isbn)

        # Dimensions
        dims = book.get("dimensoes") or book.get("dimensions") or book.get("formato")
        if dims and not detail["dimensions"]:
            detail["dimensions"] = str(dims)

        # Synopsis
        sinopse = (
            book.get("sinopse") or book.get("descricao") or book.get("description")
        )
        if sinopse and not detail.get("synopsis"):
            detail["synopsis"] = sinopse

        # Category / genre
        cat = book.get("categoria") or book.get("genero") or book.get("genre")
        if cat and not detail.get("category"):
            detail["category"] = cat

        # Variants / editions from page props
        editions = (
            book.get("edicoes")
            or book.get("titulos")
            or book.get("formatos")
            or book.get("editions")
            or []
        )
        for ed in editions:
            if not isinstance(ed, dict):
                continue
            sku_raw = ed.get("sku") or ed.get("codigo") or ed.get("id")
            if not sku_raw:
                continue
            sku = normalize_sku(sku_raw)
            price = float(ed.get("preco") or ed.get("price") or 0)
            fmt = ed.get("formato") or ed.get("tipo") or detect_format("", sku)
            o_url = ed.get("url") or store_url(sku)
            existing_skus = {v["sku"] for v in detail["variants"]}
            if sku not in existing_skus:
                detail["variants"].append(
                    {
                        "sku": sku,
                        "format": fmt,
                        "price": price,
                        "url": o_url,
                        "is_active": True,
                    }
                )

    def _enrich_from_html(self, detail: dict, html: str):
        """
        Last-resort HTML scraping for fields not found in structured data.
        Targets common patterns in UICLAP's store pages.
        """
        # Pages: <span>NNN páginas</span> or Páginas: NNN
        if not detail["pages"]:
            m = re.search(r"(\d+)\s*p[áa]ginas?", html, re.IGNORECASE)
            if m:
                try:
                    detail["pages"] = int(m.group(1))
                except ValueError:
                    pass

        # ISBN
        if not detail["isbn"]:
            m = re.search(r"ISBN[:\s]*([0-9\-]{10,17})", html, re.IGNORECASE)
            if m:
                detail["isbn"] = m.group(1).strip()

        # Weight (common in table rows)
        if not detail["weight_kg"]:
            m = re.search(r"[Pp]eso[:\s]*([\d,.]+)\s*kg?", html, re.IGNORECASE)
            if m:
                try:
                    detail["weight_kg"] = float(m.group(1).replace(",", "."))
                except ValueError:
                    pass

        # Synopsis from <meta name="description">
        if not detail.get("synopsis"):
            m = re.search(
                r'<meta[^>]+name=["\']description["\'][^>]+content=["\'](.*?)["\']',
                html,
                re.IGNORECASE | re.DOTALL,
            )
            if m:
                detail["synopsis"] = m.group(1).strip()

        # Dimensions
        if not detail["dimensions"]:
            m = re.search(r"(\d+)\s*[xXxX×]\s*(\d+)\s*(?:[xXxX×]\s*(\d+))?\s*cm", html)
            if m:
                parts = [g for g in m.groups() if g]
                detail["dimensions"] = " × ".join(parts) + " cm"

    def _find_nested(self, data, keys: tuple, depth: int = 0) -> Optional[dict]:
        """BFS to find the first dict that contains any of the given keys."""
        if depth > 8 or not isinstance(data, (dict, list)):
            return None
        if isinstance(data, dict):
            if any(k in data for k in keys):
                return data
            for v in data.values():
                result = self._find_nested(v, keys, depth + 1)
                if result:
                    return result
        elif isinstance(data, list):
            for item in data:
                result = self._find_nested(item, keys, depth + 1)
                if result:
                    return result
        return None


# ─────────────────────────────────────────────
# Raw data → ScrapedBook converter
# ─────────────────────────────────────────────


class BookConverter:
    def __init__(self, existing_slugs: set, author_slug: str = ""):
        self.existing_slugs = existing_slugs
        self.author_slug = author_slug

    def from_bio_product(
        self,
        product: dict,
        author_info: dict,
        detail: Optional[dict] = None,
    ) -> ScrapedBook:
        b = ScrapedBook()

        # ── Identity ──────────────────────────────────────────
        b.name = product.get("name", "").strip()
        b.artist = author_info.get("name", "")
        b.author_slug = self.author_slug
        b.brand = "UICLAP"
        b.category = "livros"

        primary_sku = product.get("sku") or ""
        b.third_party_product_id = primary_sku
        b.third_party_source = "uiclap"
        b.third_party_product_url = product.get("url") or (
            store_url(primary_sku) if primary_sku else None
        )

        # ── Description ───────────────────────────────────────
        synopsis = (detail or {}).get("synopsis") or product.get("description")
        if synopsis and synopsis not in ("null", "None"):
            b.description = synopsis
        else:
            b.description = None
        b.short_description = f"'{b.name}' — {b.artist}" if b.name else None

        # ── Pricing — use lowest variant price ────────────────
        base_price = product.get("price", 0.0)
        b.price = float(base_price) if base_price else 0.0

        # ── Images ────────────────────────────────────────────
        cover = product.get("image") or (
            cover_url(primary_sku) if primary_sku else None
        )
        if cover:
            b.image = cover.replace("http://", "https://")

        # All images from detail page
        detail_images = (detail or {}).get("images", [])
        all_images = []
        seen_imgs = set()
        for img in [cover] + detail_images:
            if img:
                img = img.replace("http://", "https://")
                if img not in seen_imgs:
                    seen_imgs.add(img)
                    all_images.append(img)
        b.images = all_images

        # Author image
        b.author_image = (author_info.get("image", "") or "").replace(
            "http://", "https://"
        )

        # ── Variants ──────────────────────────────────────────
        raw_variants = (detail or {}).get("variants", [])
        if not raw_variants:
            # Fallback: single variant from bio data
            raw_variants = [
                {
                    "sku": primary_sku,
                    "format": "físico",
                    "price": base_price,
                    "url": b.third_party_product_url,
                    "is_active": True,
                }
            ]

        # Update base price to lowest variant price
        prices = [v["price"] for v in raw_variants if v.get("price", 0) > 0]
        if prices:
            b.price = min(prices)

        for v in raw_variants:
            bv = BookVariant(
                format=v.get("format", "físico"),
                sku=v.get("sku"),
                price=float(v.get("price", 0) or 0),
                is_active=v.get("is_active", True),
                url=v.get("url"),
                image_url=cover_url(v["sku"]) if v.get("sku") else b.image,
                pages=(detail or {}).get("pages"),
                weight_kg=(detail or {}).get("weight_kg"),
                isbn=(detail or {}).get("isbn"),
                dimensions=(detail or {}).get("dimensions"),
            )
            b.variants.append(asdict(bv))

        # ── Physical metadata from detail ─────────────────────
        if detail:
            b.pages = detail.get("pages")
            b.isbn = detail.get("isbn")
            b.dimensions = detail.get("dimensions")
            b.weight = detail.get("weight_kg") or 0.300
            cat = detail.get("category")
            if cat:
                b.category = cat.lower()

        # ── Materials (paper for physical books) ──────────────
        b.materials = ["Papel"]

        # ── Tags ─────────────────────────────────────────────
        b.tags = ["uiclap", "livros", "dropshipping"]
        if self.author_slug:
            b.tags.append(self.author_slug)
        if b.artist:
            b.tags.append(b.artist.lower().replace(" ", "-"))

        # ── Slug ─────────────────────────────────────────────
        clean_name = b.name.replace(" - UICLAP", "").replace("—", " ").strip()
        b.slug = make_slug(clean_name, self.existing_slugs)

        # ── Metadata ─────────────────────────────────────────
        b.metadata = {
            "fulfillment_type": "uiclap",
            "author_slug": self.author_slug,
            "primary_sku": primary_sku,
            "pages": b.pages,
            "isbn": b.isbn,
            "dimensions": b.dimensions,
        }

        # ── Raw data ─────────────────────────────────────────
        b.third_party_raw_data = {
            "scraped_at": datetime.now(timezone.utc).isoformat(),
            "source": "uiclap",
            "author_info": author_info,
            "product_ld": product.get("raw_ld"),
            "detail": detail,
        }

        return b

    def from_sku(self, sku: str, detail: dict) -> ScrapedBook:
        """Build a ScrapedBook from a detail-only fetch (no bio page)."""
        variants = detail.get("variants", [])
        name = detail.get("name") or f"Livro UA{sku}"
        lowest_price = min(
            (v["price"] for v in variants if v.get("price", 0) > 0), default=0.0
        )

        product = {
            "sku": sku,
            "name": name,
            "description": detail.get("synopsis"),
            "image": cover_url(sku),
            "price": lowest_price,
            "url": store_url(sku),
        }
        return self.from_bio_product(product, {}, detail)


# ─────────────────────────────────────────────
# GitHub CDN Uploader
# ─────────────────────────────────────────────


class GitHubCdnUploader:
    """Uploads images to GitHub CDN branch via GitHub Contents API.
    Falls back to Supabase Edge Function if direct GitHub API fails.
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
        # Edge function fallback
        self.supabase_url = supabase_url.rstrip("/") if supabase_url else ""
        self.supabase_key = supabase_key
        self.use_edge_function = False
        self.uploaded = 0
        self.webp_generated = 0

    def ensure_cdn_branch(self):
        """Create CDN branch if it doesn't exist.
        In CI environment, skip git operations - just save files locally.
        """
        # In CI, skip git branch operations
        if os.environ.get('GITHUB_ACTIONS'):
            logger.info("Running in GitHub Actions - saving images locally for workflow to push")
            return True

        try:
            resp = requests.get(
                f"https://api.github.com/repos/{self.owner}/{self.repo}/branches/{self.branch}",
                headers=self.headers,
                timeout=15,
            )
            if resp.ok:
                logger.info(f"CDN branch '{self.branch}' already exists")
                return True

            # Branch doesn't exist, create it from default branch
            logger.info(f"Creating CDN branch '{self.branch}' from default branch...")
            default_branch = self._get_default_branch()
            ref_url = f"https://api.github.com/repos/{self.owner}/{self.repo}/git/refs"

            # Get the SHA of the default branch
            ref_resp = requests.get(
                f"https://api.github.com/repos/{self.owner}/{self.repo}/git/ref/heads/{default_branch}",
                headers=self.headers,
                timeout=15,
            )
            if not ref_resp.ok:
                logger.error(
                    f"Failed to get default branch ref: {ref_resp.status_code}"
                )
                return False

            sha = ref_resp.json()["object"]["sha"]

            # Create the branch
            create_resp = requests.post(
                ref_url,
                headers=self.headers,
                json={"ref": f"refs/heads/{self.branch}", "sha": sha},
                timeout=15,
            )
            if create_resp.ok:
                logger.info(f"Created CDN branch '{self.branch}'")
                return True
            else:
                logger.error(
                    f"Failed to create branch: {create_resp.status_code} {create_resp.text}"
                )
                return False
        except Exception as e:
            logger.error(f"Error ensuring CDN branch: {e}")
            return False

    def _get_default_branch(self) -> str:
        """Get the default branch name (main or master)."""
        resp = requests.get(
            f"https://api.github.com/repos/{self.owner}/{self.repo}",
            headers=self.headers,
            timeout=15,
        )
        if resp.ok:
            return resp.json().get("default_branch", "main")
        return "main"

    def _get_file_sha(self, path: str) -> Optional[str]:
        """Get the SHA of an existing file (needed for updates)."""
        resp = requests.get(
            f"{self.base_url}/{path}",
            headers={**self.headers, "Accept": "application/vnd.github.v3+json"},
            params={"ref": self.branch},
            timeout=15,
        )
        if resp.ok:
            return resp.json().get("sha")
        return None

    def _compute_content_hash(self, file_bytes: bytes) -> str:
        """Compute SHA-256 hash of file content for change detection."""
        return hashlib.sha256(file_bytes).hexdigest()

    def upload_file(
        self, file_bytes: bytes, object_path: str, content_type: str = "image/jpeg"
    ) -> Optional[str]:
        """Upload a file to the CDN branch. Returns CDN URL or None.
        Falls back to Supabase Edge Function if direct GitHub API fails.
        In CI environment, saves files locally for the workflow to push.

        Uses content-hash-based skip: if the file exists on the CDN branch,
        it is skipped (GitHub blob SHA is content-based, so same path = same content).
        """
        # In CI, save locally instead of using GitHub API
        if os.environ.get('GITHUB_ACTIONS'):
            return self._save_local(file_bytes, object_path)

        # Check if file already exists on CDN
        existing_sha = None
        if not self.use_edge_function:
            existing_sha = self._get_file_sha(object_path)
            if existing_sha:
                # File exists — GitHub blob SHA is content-based (SHA1 of content),
                # so if the file exists, the content is identical. Skip upload.
                logger.debug(
                    f"File exists: {object_path}, skipping upload"
                )
                return self._make_cdn_url(object_path)

        # Try direct GitHub API first
        if not self.use_edge_function:
            result = self._upload_direct(file_bytes, object_path, content_type, existing_sha=existing_sha)
            if result:
                return result
            # Direct failed, try edge function fallback
            logger.info(
                f"Direct GitHub API failed, falling back to Supabase edge function"
            )
            self.use_edge_function = True

        # Upload via Supabase Edge Function
        return self._upload_via_edge_function(file_bytes, object_path, content_type)

    def _upload_direct(
        self, file_bytes: bytes, object_path: str, content_type: str, max_retries: int = 3,
        existing_sha: Optional[str] = None,
    ) -> Optional[str]:
        """Upload directly via GitHub Contents API."""
        content_b64 = base64.b64encode(file_bytes).decode("utf-8")
        content_hash = self._compute_content_hash(file_bytes)
        sha = existing_sha

        for attempt in range(max_retries):
            # Get existing SHA if file already exists and not provided
            if sha is None:
                sha = self._get_file_sha(object_path)

            payload = {
                "message": f"chore: {'update' if sha else 'add'} product image {object_path} [{content_hash[:8]}]",
                "content": content_b64,
                "branch": self.branch,
            }
            if sha:
                payload["sha"] = sha
            
            resp = requests.put(
                f"{self.base_url}/{object_path}",
                headers=self.headers,
                json=payload,
                timeout=60,
            )
            if resp.ok:
                self.uploaded += 1
                return self._make_cdn_url(object_path)
            
            # Handle 409 conflict with retry
            if resp.status_code == 409 and attempt < max_retries - 1:
                logger.warning(f"409 conflict on {object_path}, retry {attempt + 1}/{max_retries}")
                time.sleep(1)
                continue
            
            logger.warning(
                f"Direct CDN upload failed for {object_path}: {resp.status_code} {resp.text[:200]}"
            )
            return None
        
        logger.error(f"Exhausted retries for {object_path}")
        return None

    def _upload_via_edge_function(
        self, file_bytes: bytes, object_path: str, content_type: str
    ) -> Optional[str]:
        """Upload via Supabase Edge Function fallback."""
        if not self.supabase_url or not self.supabase_key:
            logger.warning("Edge function not configured (no supabase_url/key)")
            return None
        try:
            import io as _io

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
                self.uploaded += 1
                return data.get("cdnUrl") or data.get("original")
            else:
                logger.warning(
                    f"Edge function upload failed: {resp.status_code} {resp.text[:200]}"
                )
                return None
        except Exception as e:
            logger.warning(f"Edge function upload error: {e}")
            return None

    def upload_file_with_webp(
        self, img_bytes: bytes, object_path: str, content_type: str = "image/jpeg"
    ) -> dict:
        """Upload original + WebP version. Returns dict with both URLs."""
        result = {"original": None, "webp": None}

        # Upload original
        result["original"] = self.upload_file(img_bytes, object_path, content_type)

        # Convert and upload WebP
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
                    self.webp_generated += 1

        return result

    def _make_cdn_url(self, object_path: str) -> str:
        """Generate jsDelivr CDN URL for a file in the CDN branch."""
        return f"https://cdn.jsdelivr.net/gh/{self.owner}/{self.repo}@{self.branch}/cdn_images/{object_path}"

    def _save_local(self, file_bytes: bytes, object_path: str) -> Optional[str]:
        """Save file locally in CI for workflow to push later."""
        try:
            file_path = Path("cdn_images") / object_path
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_bytes(file_bytes)
            self.uploaded += 1
            logger.debug(f"Saved locally: {object_path}")
            return self._make_cdn_url(object_path)
        except Exception as e:
            logger.error(f"Failed to save file locally: {e}")
            return None

    def upload_product_images(self, book: ScrapedBook, client: Client) -> dict:
        """Download and upload all images for a book to GitHub CDN.

        In CI, saves files locally for workflow to push.
        Checks if the file already exists locally BEFORE downloading to save time.
        """
        pid = book.third_party_product_id or book.slug or "unknown"
        cdn_urls = []
        webp_urls = []

        for idx, img_url in enumerate(book.images):
            content_type = mimetypes.guess_type(img_url)[0] or "image/jpeg"
            ext = mimetypes.guess_extension(content_type) or ".jpg"
            object_path = f"products/{pid}/{idx:03d}_cover{ext}"

            # In CI, check local filesystem before downloading
            if os.environ.get('GITHUB_ACTIONS'):
                local_path = Path("cdn_images") / object_path
                if local_path.exists():
                    logger.debug(f"[{pid}] Skipping unchanged image #{idx}")
                    cdn_urls.append(self._make_cdn_url(object_path))
                    # Also check WebP
                    webp_path = object_path.rsplit(".", 1)[0] + ".webp"
                    webp_local = Path("cdn_images") / webp_path
                    if webp_local.exists():
                        webp_urls.append(self._make_cdn_url(webp_path))
                    continue
            # Check CDN existence BEFORE downloading (non-CI)
            elif not self.use_edge_function:
                sha = self._get_file_sha(object_path)
                if sha:
                    logger.debug(f"[{pid}] Skipping unchanged image #{idx}")
                    self.uploaded += 0  # count as processed, not uploaded
                    cdn_urls.append(self._make_cdn_url(object_path))
                    # Also check WebP
                    webp_path = object_path.rsplit(".", 1)[0] + ".webp"
                    webp_sha = self._get_file_sha(webp_path)
                    if webp_sha:
                        webp_urls.append(self._make_cdn_url(webp_path))
                    continue

            img_bytes = client.download_bytes(img_url)
            if not img_bytes:
                continue

            upload_result = self.upload_file_with_webp(
                img_bytes, object_path, content_type
            )
            if upload_result["original"]:
                cdn_urls.append(upload_result["original"])
            if upload_result["webp"]:
                webp_urls.append(upload_result["webp"])

        book.cdn_image_urls = cdn_urls
        book.cdn_webp_urls = webp_urls
        return {"cdn_urls": cdn_urls, "webp_urls": webp_urls}

    def upload_all(
        self, books: list[ScrapedBook], client: Client, workers: int = 2
    ) -> dict:
        """Parallel upload of all book images to GitHub CDN.
        In CI, saves files locally for workflow to push.
        """
        # Skip branch management in CI
        if not os.environ.get('GITHUB_ACTIONS'):
            if not self.ensure_cdn_branch():
                logger.error("Failed to ensure CDN branch exists")
                return {}

        results = {}

        def _upload_book(b):
            return self.upload_product_images(b, client)

        with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
            future_map = {
                pool.submit(_upload_book, b): (b.third_party_product_id or b.slug)
                for b in books
                if b.images
            }
            iterator = concurrent.futures.as_completed(future_map)
            if HAS_TQDM:
                iterator = tqdm(
                    iterator, total=len(future_map), desc="Uploading to GitHub CDN"
                )
            for fut in iterator:
                pid = future_map[fut]
                results[pid] = fut.result()
        return results


# ─────────────────────────────────────────────
# Supabase Database sync
# ─────────────────────────────────────────────


class SupabaseSync:
    def __init__(self, url: str, key: str, subcollection_slug: str = "uiclap"):
        self.base = f"{url.rstrip('/')}/rest/v1"
        self.hdrs = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        self.subcollection_slug = subcollection_slug

    def _get(self, path: str) -> list:
        r = requests.get(f"{self.base}/{path}", headers=self.hdrs, timeout=15)
        return r.json() if r.ok else []

    def _post(self, path: str, payload) -> requests.Response:
        return requests.post(
            f"{self.base}/{path}", headers=self.hdrs, json=payload, timeout=30
        )

    def _patch(self, path: str, payload: dict) -> requests.Response:
        return requests.patch(
            f"{self.base}/{path}", headers=self.hdrs, json=payload, timeout=30
        )

    def get_collection_id(self, slug: str) -> Optional[str]:
        rows = self._get(f"collections?slug=eq.{slug}")
        return rows[0]["id"] if rows else None

    def get_subcollection_id(self, slug: str = None) -> Optional[str]:
        target = slug or self.subcollection_slug
        rows = self._get(f"subcollections?slug=eq.{target}")
        return rows[0]["id"] if rows else None

    def existing_product(self, third_party_id: str) -> Optional[dict]:
        rows = self._get(
            f"products?third_party_product_id=eq.{third_party_id}"
            f"&third_party_source=eq.uiclap&select=id,slug,third_party_synced_at,third_party_raw_data"
        )
        return rows[0] if rows else None

    def product_needs_update(self, book: ScrapedBook, existing: dict) -> bool:
        """Check if a book needs updating by comparing raw data hashes."""
        if not existing:
            return True

        # Check if third_party_raw_data exists and compare
        existing_raw = existing.get("third_party_raw_data") or {}
        existing_hash = existing_raw.get("data_hash")

        # Calculate current hash from product_ld
        current_raw = book.third_party_raw_data or {}
        raw_data = current_raw.get("product_ld", {})
        current_hash = hashlib.md5(
            json.dumps(raw_data, sort_keys=True).encode()
        ).hexdigest()

        # If hashes differ, update needed
        if existing_hash and existing_hash != current_hash:
            return True

        # If no hash stored, check sync age (update if older than 24h)
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

    def get_all_synced_products(self) -> dict:
        """Get all products from DB for incremental sync comparison."""
        rows = self._get(
            f"products?third_party_source=eq.uiclap"
            f"&select=id,third_party_product_id,third_party_synced_at,third_party_raw_data"
        )
        result = {}
        for row in rows:
            tp_id = row.get("third_party_product_id")
            if tp_id:
                result[tp_id] = row
        return result

    def upsert_product(
        self, book: ScrapedBook, collection_id, subcollection_id
    ) -> dict:
        # Use CDN URLs if available, otherwise fall back to original URLs
        image = book.cdn_image_urls[0] if book.cdn_image_urls else book.image
        images = book.cdn_image_urls if book.cdn_image_urls else book.images

        # Calculate hash of raw data for change detection
        raw_data = (book.third_party_raw_data or {}).get("product_ld", {})
        data_hash = hashlib.md5(
            json.dumps(raw_data, sort_keys=True).encode()
        ).hexdigest()

        # Update raw_data with hash
        if book.third_party_raw_data:
            book.third_party_raw_data["data_hash"] = data_hash

        # Build image index metadata
        image_index = {"total_images": len(images), "images": []}
        for idx, img_url in enumerate(images):
            image_index["images"].append(
                {
                    "index": idx,
                    "url": img_url,
                    "webp_url": book.cdn_webp_urls[idx]
                    if idx < len(book.cdn_webp_urls)
                    else None,
                }
            )

        payload = {
            "name": book.name,
            "slug": book.slug,
            "description": book.description,
            "short_description": book.short_description,
            "category": book.category,
            "collection_id": collection_id,
            "subcollection_id": subcollection_id,
            "price": book.price,
            "compare_at_price": book.compare_at_price,
            "stock_type": "print-on-demand",
            "fulfillment_type": "uiclap",
            "artist": book.artist,
            "brand": book.brand,
            "info": book.info,
            "materials": book.materials,
            "tags": book.tags,
            "weight": book.weight,
            "image": image,
            "images": images,
            "shipping_zones": ["BR"],
            "is_active": book.is_active,
            "is_featured": False,
            "is_archived": False,
            "third_party_product_id": book.third_party_product_id,
            "third_party_source": "uiclap",
            "third_party_synced_at": datetime.now(timezone.utc).isoformat(),
            "third_party_raw_data": book.third_party_raw_data,
            "product_url": book.third_party_product_url,
            "metadata": {
                **(book.metadata or {}),
                "image_index": image_index,
                "data_hash": data_hash,
                "has_webp": len(book.cdn_webp_urls) > 0,
            },
        }

        existing = self.existing_product(book.third_party_product_id or "")
        if existing:
            resp = self._patch(f"products?id=eq.{existing['id']}", payload)
            action = "updated"
        else:
            resp = self._post("products", payload)
            action = "inserted"

        if resp.ok:
            return {"success": True, "action": action, "data": resp.json()}
        return {"success": False, "action": action, "error": resp.text}

    def upsert_variants(self, product_id: int, variants: list) -> None:
        requests.delete(
            f"{self.base}/product_variants?product_id=eq.{product_id}",
            headers=self.hdrs,
            timeout=15,
        )
        for v in variants:
            payload = {
                "product_id": product_id,
                "size": None,
                "color": None,
                "variant_type": v.get("format"),
                "price_override": v.get("price") if v.get("price") else None,
                "sku": v.get("sku"),
                "stock_quantity": v.get("stock_quantity", 0),
                "is_active": v.get("is_active", True),
                "image_url": v.get("image_url"),
                "pages": v.get("pages"),
                "isbn": v.get("isbn"),
                "dimensions": v.get("dimensions"),
            }
            payload = {k: val for k, val in payload.items() if val is not None}
            self._post("product_variants", payload)

    def log_sync(self, sync_type: str, result: SyncResult):
        self._post(
            "third_party_sync_log",
            {
                "source": "uiclap",
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
                "triggered_by": "python-scraper-uiclap-v4",
            },
        )


# ─────────────────────────────────────────────
# JSON output
# ─────────────────────────────────────────────


def generate_products_json(
    books: list[ScrapedBook], output_path: str, bio_url: str = "", cdn_map: dict = None
) -> str:
    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "uiclap",
        "bio_url": bio_url,
        "total_products": len(books),
        "products": [asdict(b) for b in books],
    }
    if cdn_map:
        output["cdn_upload_results"] = cdn_map
    with open(output_path, "w", encoding="utf-8") as fh:
        json.dump(output, fh, indent=2, ensure_ascii=False)
    logger.info(f"Products JSON saved → {output_path} ({len(books)} books)")
    return output_path


# ─────────────────────────────────────────────
# Orchestrator
# ─────────────────────────────────────────────


def run(args) -> SyncResult:
    start = time.time()
    result = SyncResult()
    client = Client(delay=REQUEST_DELAY)

    extractor = JsonLdExtractor(client)
    books: list[ScrapedBook] = []
    bio_url = ""
    author_info = {}

    # ── 1. Collect raw product data ───────────────────────────

    if args.sku:
        # Single product by SKU
        sku = normalize_sku(args.sku)
        logger.info(f"Fetching single product SKU: {sku}")
        detail = extractor.fetch_detail(sku) if args.fetch_details or True else {}
        slugs = set()
        conv = BookConverter(slugs, author_slug="")
        b = conv.from_sku(sku, detail)
        books.append(b)

    elif args.bio_url:
        bio_url = args.bio_url.rstrip("/")
        logger.info(f"Fetching author bio: {bio_url}")
        bio_data = extractor.fetch_bio(bio_url)
        author_info = bio_data.get("author", {})
        raw_products = bio_data.get("products", [])
        author_slug = bio_data.get("author_slug", "")

        logger.info(
            f"Author: {author_info.get('name', '?')} — {len(raw_products)} product(s) found"
        )

        slugs = set()
        conv = BookConverter(slugs, author_slug=author_slug)

        for raw in raw_products:
            sku = raw.get("sku") or ""
            if not sku:
                logger.warning(f"Skipping product with no SKU: {raw.get('name')}")
                continue

            detail = {}
            if args.fetch_details:
                logger.info(f"  Fetching detail for SKU {sku}: {raw.get('name')}")
                detail = extractor.fetch_detail(sku)

            try:
                b = conv.from_bio_product(raw, author_info, detail or None)
                if b.name:
                    books.append(b)
            except Exception as exc:
                logger.warning(f"Conversion error for SKU {sku}: {exc}")
    else:
        logger.error("Must provide --bio-url or --sku")
        sys.exit(1)

    logger.info(f"Converted {len(books)} book(s)")

    # ── 1.5. Incremental sync: detect changed books ───────────

    books_to_sync = books
    skipped_unchanged = 0

    if (
        not args.full
        and not args.dry_run
        and SUPABASE_URL
        and SUPABASE_KEY
        and args.sync_to_db
    ):
        logger.info("Incremental sync mode: checking for changed books...")
        supabase_check = SupabaseSync(
            SUPABASE_URL,
            SUPABASE_KEY,
            getattr(args, "subcollection", "uiclap") or "uiclap",
        )
        synced_books = supabase_check.get_all_synced_products()

        changed_books = []
        for b in books:
            tp_id = b.third_party_product_id
            existing = synced_books.get(tp_id)

            if supabase_check.product_needs_update(b, existing):
                changed_books.append(b)
                if existing:
                    logger.info(f"  Changed: {b.name} (SKU: {tp_id})")
                else:
                    logger.info(f"  New: {b.name} (SKU: {tp_id})")
            else:
                skipped_unchanged += 1
                logger.debug(f"  Unchanged (skipped): {b.name} (SKU: {tp_id})")

        books_to_sync = changed_books
        logger.info(
            f"Incremental sync: {len(books_to_sync)} changed/new, {skipped_unchanged} unchanged"
        )

    # ── 2. Upload images to GitHub CDN ────────────────────────

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
        cdn_map = uploader.upload_all(books_to_sync, client, workers=2)
        result.images_uploaded = uploader.uploaded
        result.webp_generated = uploader.webp_generated

        # Update book image references to CDN URLs
        for b in books_to_sync:
            if b.cdn_image_urls:
                b.image = b.cdn_image_urls[0]
                b.images = b.cdn_image_urls

    elif args.upload_images and not (GITHUB_TOKEN and GITHUB_OWNER):
        logger.warning(
            "--upload-images specified but GITHUB_TOKEN/GITHUB_OWNER not set, skipping image upload"
        )

    # ── 3. Save JSON ──────────────────────────────────────────

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = args.output or f"scraped_uiclap_{ts}.json"
    generate_products_json(books, output_file, bio_url, cdn_map)

    # ── 4. Sync to DB ─────────────────────────────────────────

    should_sync = args.sync_to_db and not args.dry_run and SUPABASE_URL and SUPABASE_KEY

    if should_sync:
        subcollection_slug = getattr(args, "subcollection", "uiclap") or "uiclap"
        collection_slug = getattr(args, "collection", "bhumi-livros") or "bhumi-livros"
        supabase = SupabaseSync(SUPABASE_URL, SUPABASE_KEY, subcollection_slug)

        collection_id = supabase.get_collection_id(collection_slug)
        subcollection_id = supabase.get_subcollection_id()
        logger.info(
            f"DB sync: collection='{collection_slug}' subcollection='{subcollection_slug}'"
        )

        for b in books_to_sync:
            result.processed += 1
            try:
                sr = supabase.upsert_product(b, collection_id, subcollection_id)
                if sr["success"]:
                    if sr["action"] == "inserted":
                        result.inserted += 1
                    else:
                        result.updated += 1

                    if b.variants and sr.get("data"):
                        pid = sr["data"][0]["id"]
                        supabase.upsert_variants(pid, b.variants)

                    logger.info(f"{sr['action'].capitalize()}: {b.name}")
                else:
                    result.failed += 1
                    err = f"{b.name}: {sr.get('error', '?')}"
                    result.errors.append(err)
                    logger.error(err)
            except Exception as exc:
                result.failed += 1
                result.errors.append(f"{b.name}: {exc}")
                logger.error(f"Sync error for {b.name}: {exc}")

        supabase.log_sync("full" if args.full else "incremental", result)

    elif args.dry_run:
        logger.info("Dry run — DB sync skipped")
    elif not (SUPABASE_URL and SUPABASE_KEY):
        logger.info("No Supabase credentials — DB sync skipped")

    result.duration_seconds = time.time() - start

    # ── 5. Summary ───────────────────────────────────────────

    print("\n" + "=" * 52)
    print("UICLAP Scraper v4 — Summary")
    print("=" * 52)
    if author_info:
        print(f"  Author          : {author_info.get('name', '?')}")
    print(f"  Books found     : {len(books)}")
    if skipped_unchanged > 0:
        print(f"  Skipped unchanged : {skipped_unchanged}")
        print(f"  To sync           : {len(books_to_sync)}")
    print(f"  Inserted        : {result.inserted}")
    print(f"  Updated         : {result.updated}")
    print(f"  Failed          : {result.failed}")
    print(f"  Images uploaded : {result.images_uploaded}")
    print(f"  WebP generated  : {result.webp_generated}")
    print(f"  Output file     : {output_file}")
    print(f"  Duration        : {result.duration_seconds:.1f}s")

    if books and not should_sync:
        print("\n  Books:")
        for b in books:
            variants_str = ", ".join(
                f"{v.get('format', '?')} R${v.get('price', 0):.2f} (SKU {v.get('sku', '')})"
                for v in b.variants
            )
            print(f"    [{b.third_party_product_id}] {b.name}")
            print(f"      Price: R${b.price:.2f}  Variants: {variants_str}")
            if b.pages:
                print(f"      Pages: {b.pages}  ISBN: {b.isbn}")
            print(f"      Cover: {b.image}")

    if result.errors:
        print(f"\n  Errors ({len(result.errors)}):")
        for e in result.errors[:5]:
            print(f"    – {e}")

    return result


# ─────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser(
        description="UICLAP Scraper v4 — JSON-LD Schema.org + GitHub CDN"
    )

    # Source
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--bio-url", help="Author bio URL (https://uiclap.bio/{slug})")
    group.add_argument("--sku", help="Single product SKU (numeric or with ua prefix)")

    # Behaviour
    parser.add_argument(
        "--fetch-details",
        action="store_true",
        help="Fetch individual detail pages for extended metadata (slower)",
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Parse and print but skip DB/CDN writes"
    )
    parser.add_argument("--full", action="store_true", help="Full sync (all products)")
    parser.add_argument(
        "--sync-to-db",
        action="store_true",
        help="Sync scraped products to Supabase database",
    )
    parser.add_argument(
        "--upload-images", action="store_true", help="Upload cover images to GitHub CDN"
    )

    # CDN
    parser.add_argument(
        "--cdn-branch", default="cdn", help="CDN branch name (default: cdn)"
    )

    # Output
    parser.add_argument("--output", help="Output JSON file path")

    # DB slugs
    parser.add_argument(
        "--subcollection",
        default="uiclap",
        help="Subcollection slug for DB (default: uiclap)",
    )
    parser.add_argument(
        "--collection",
        default="bhumi-livros",
        help="Collection slug for DB (default: bhumi-livros)",
    )

    args = parser.parse_args()

    logger.info("UICLAP Scraper v4 starting")
    logger.info(f"  Supabase:       {SUPABASE_URL or '(not set)'}")
    logger.info(f"  GitHub CDN:     {GITHUB_OWNER}/{GITHUB_REPO}@{args.cdn_branch}")
    logger.info(f"  Dry run:        {args.dry_run}")
    logger.info(f"  Fetch details:  {args.fetch_details}")
    logger.info(f"  Upload images:  {args.upload_images}")
    logger.info(f"  Sync to DB:     {args.sync_to_db}")

    result = run(args)
    sys.exit(1 if result.failed and not result.inserted else 0)


if __name__ == "__main__":
    main()
