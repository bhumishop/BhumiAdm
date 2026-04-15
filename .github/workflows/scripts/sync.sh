#!/usr/bin/env bash
# Sync script for UmaPenca stores (v4 - GitHub CDN)
# Usage: ./sync.sh [prataprint|bhumisprint|all] [--dry-run] [--sync-to-db] [--upload-images]
#
# Examples:
#   ./sync.sh bhumisprint --dry-run
#   ./sync.sh prataprint --sync-to-db --upload-images
#   ./sync.sh all --dry-run

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STORE="${1:-all}"
shift || true

DRY_RUN=""
SYNC_TO_DB=""
UPLOAD_IMAGES=""
OUTPUT_DIR=""

for arg in "$@"; do
  case $arg in
    --dry-run)
      DRY_RUN="--dry-run"
      ;;
    --sync-to-db)
      SYNC_TO_DB="--sync-to-db"
      ;;
    --upload-images)
      UPLOAD_IMAGES="--upload-images"
      ;;
  esac
done

sync_store() {
  local store=$1
  local url=""
  local store_id=""
  local subcollection="uma-penca"
  local collection=""

  case $store in
    prataprint)
      url="https://prataprint.bhumisparshaschool.org"
      store_id="11210"
      collection="prata-print"
      ;;
    bhumisprint)
      url="https://umapenca.com/bhumisprint"
      store_id="11205"
      collection="bhumi-print"
      ;;
    *)
      echo "Unknown store: $store"
      return 1
      ;;
  esac

  OUTPUT_DIR="${SCRIPT_DIR}/${store}/output"
  mkdir -p "$OUTPUT_DIR"

  echo "=== Syncing ${store} ==="
  echo "  URL: ${url}"
  echo "  Store ID: ${store_id}"
  echo "  Collection: ${collection}"
  echo "  Output: ${OUTPUT_DIR}/products.json"

  python3 "${SCRIPT_DIR}/umapenca.py" \
    --url "$url" \
    --store-id "$store_id" \
    --collection "$collection" \
    --subcollection "$subcollection" \
    --full \
    --output "${OUTPUT_DIR}/products.json" \
    --cdn-branch cdn \
    ${DRY_RUN} ${SYNC_TO_DB} ${UPLOAD_IMAGES}

  echo ""
}

if [ "$STORE" = "all" ]; then
  sync_store "prataprint"
  echo ""
  sync_store "bhumisprint"
else
  sync_store "$STORE"
fi

echo ""
echo "=== Sync complete ==="
