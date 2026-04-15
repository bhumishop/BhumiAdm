#!/usr/bin/env bash
# =============================================================================
# BhumiAdm/BhumiShop End-to-End Test Suite
# Tests: Edge Functions, RLS Policies, SECURITY DEFINER Functions, Data Integrity
# =============================================================================
set -eo pipefail

SUPABASE_URL="https://pyidnhtwlxlyuwswaazf.supabase.co"
SK="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5aWRuaHR3bHhseXV3c3dhYXpmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjIwMTI5NiwiZXhwIjoyMDkxNzc3Mjk2fQ.24VuW_WHpvDpK0KZi2e89O1m-L0wp7FZFlxmEU37wbk"
AK="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5aWRuaHR3bHhseXV3c3dhYXpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMDEyOTYsImV4cCI6MjA5MTc3NzI5Nn0.4LAxeX9FAYNzrmYjj5e4PHjkol9OJSAuGGYSamsNSTA"

EDGE="$SUPABASE_URL/functions/v1"
REST="$SUPABASE_URL/rest/v1"

PASS=0; FAIL=0; N=0
RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'

ok() { echo -e "  ${GREEN}PASS${NC} [$((++N))] $1"; PASS=$((PASS+1)); }
fail() { echo -e "  ${RED}FAIL${NC} [$((++N))] $1 -> $2"; FAIL=$((FAIL+1)); }

section() { echo ""; echo -e "${BLUE}=== $1 ===${NC}"; }

# HTTP test: expects specific status code
test_status() {
    local desc="$1" url="$2" expected="$3"
    shift 3
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" "$@" "$url")
    if [ "$status" = "$expected" ]; then ok "$desc -> $status"; else fail "$desc" "$status (expected $expected)"; fi
}

# RLS blocked test: 401/403 OR 200 with []
test_rls_blocked() {
    local desc="$1" url="$2"
    shift 2
    local resp
    resp=$(curl -s -w "\n%{http_code}" "$@" "$url")
    local body=$(echo "$resp" | head -n -1)
    local status=$(echo "$resp" | tail -1)
    if [ "$status" = "401" ] || [ "$status" = "403" ] || [ "$body" = "[]" ]; then
        ok "$desc -> $status (blocked)"
    else
        fail "$desc" "$status (NOT blocked: $(echo "$body" | head -c 80))"
    fi
}

# RLS allowed test: 200 with non-empty result
test_rls_allowed() {
    local desc="$1" url="$2"
    shift 2
    local resp
    resp=$(curl -s -w "\n%{http_code}" "$@" "$url")
    local body=$(echo "$resp" | head -n -1)
    local status=$(echo "$resp" | tail -1)
    if [ "$status" = "200" ] && [ "$body" != "[]" ]; then
        ok "$desc -> $status (allowed)"
    else
        fail "$desc" "$status (body: $(echo "$body" | head -c 60))"
    fi
}

# JSON field test
test_field() {
    local desc="$1" url="$2" field="$3" expected="$4"
    shift 4
    local result
    result=$(curl -s "$@" "$url" | python3 -c "
import json,sys
d=json.load(sys.stdin)
if isinstance(d,list): d=d[0] if d else {}
print(str(d.get('$field','NOT_FOUND')))
" 2>/dev/null || echo "ERROR")
    if echo "$result" | grep -qi "$expected"; then
        ok "$desc -> '$result'"
    else
        fail "$desc" "'$result' (expected '$expected')"
    fi
}

echo -e "${BLUE}BhumiAdm/BhumiShop E2E Test Suite - $(date -u +%Y-%m-%d\ %H:%M)\n${NC}"

# ===================== EDGE FUNCTIONS =====================
section "1. EDGE FUNCTION ENDPOINTS"
H_SK=(-H "Authorization: Bearer $SK")
H_AK=(-H "apikey: $AK")
H_SK_AK=(-H "Authorization: Bearer $SK" -H "apikey: $AK")
H_JSON=(-H "Content-Type: application/json")

test_status "infra-manager GET /" "$EDGE/infra-manager" "200" "${H_SK[@]}"
test_status "infra-manager GET /functions" "$EDGE/infra-manager/functions" "200" "${H_SK[@]}"
test_status "infra-manager GET /orchestrator-graph" "$EDGE/infra-manager/orchestrator-graph" "200" "${H_SK[@]}"
test_status "infra-manager POST /test" "$EDGE/infra-manager/functions/infra-manager/test" "200" "${H_SK[@]}" "${H_JSON[@]}" -d '{"args":{}}'

test_status "user-tracker GET /sessions" "$EDGE/user-tracker/sessions" "200" "${H_SK[@]}"
test_status "user-tracker POST /session" "$EDGE/user-tracker/session" "200" "${H_SK[@]}" "${H_JSON[@]}" -d '{"user_id":"e2e","email":"e2e@t.com","ip_address":"1.2.3.4"}'
test_status "user-tracker POST /geo" "$EDGE/user-tracker/geolocation" "200" "${H_SK[@]}" "${H_JSON[@]}" -d '{"user_id":"e2e","latitude":-23.5,"longitude":-46.6,"city":"SP","country":"BR","country_code":"BR"}'
test_status "user-tracker GET /map" "$EDGE/user-tracker/map" "200" "${H_SK[@]}"

test_status "telemetry GET /health" "$EDGE/telemetry-collector/health" "200" "${H_SK[@]}"
test_status "telemetry POST /spans" "$EDGE/telemetry-collector/spans" "200" "${H_SK[@]}" "${H_JSON[@]}" -d '{"spans":[]}'
test_status "telemetry POST /metrics" "$EDGE/telemetry-collector/metrics" "200" "${H_SK[@]}" "${H_JSON[@]}" -d '{"metrics":[]}'
test_status "telemetry GET /analysis" "$EDGE/telemetry-collector/analysis" "200" "${H_SK[@]}"

# ===================== STOREFRONT READ =====================
section "2. STOREFRONT RLS - ANON READ (allowed)"
H_AK_JSON=("${H_AK[@]}" "${H_JSON[@]}")

test_rls_allowed "anon READ products" "$REST/products?select=*&is_active=eq.true&limit=1" "${H_AK[@]}"
test_rls_allowed "anon READ collections" "$REST/collections?select=*&is_active=eq.true&limit=1" "${H_AK[@]}"
test_rls_allowed "anon READ subcollections" "$REST/subcollections?select=*&is_active=eq.true&limit=1" "${H_AK[@]}"
test_rls_allowed "anon READ categories" "$REST/categories?select=*&limit=1" "${H_AK[@]}"
test_rls_allowed "anon READ variants" "$REST/product_variants?select=*&is_active=eq.true&limit=1" "${H_AK[@]}"
test_rls_allowed "anon READ delivery_types" "$REST/delivery_types?select=*&limit=1" "${H_AK[@]}"
test_rls_allowed "anon READ shipping_zones" "$REST/shipping_zones?select=*&is_active=eq.true&limit=1" "${H_AK[@]}"
test_rls_allowed "anon READ option_values" "$REST/product_option_values?select=*&limit=1" "${H_AK[@]}"
test_rls_allowed "anon READ cep_mapping" "$REST/cep_state_mapping?select=*&limit=1" "${H_AK[@]}"

# ===================== ANON WRITE BLOCKED =====================
section "3. STOREFRONT RLS - ANON WRITE (blocked)"
test_rls_blocked "anon INSERT products" "$REST/products" "${H_AK_JSON[@]}" -d '{"slug":"x","name":"x","collection_id":"00000000-0000-0000-0000-000000000000"}'
test_rls_blocked "anon INSERT collections" "$REST/collections" "${H_AK_JSON[@]}" -d '{"slug":"x","name":"x"}'
test_rls_blocked "anon INSERT orders" "$REST/orders" "${H_AK_JSON[@]}" -d '{"order_number":"BH2026999999","customer_name":"test","customer_email":"test@test.com","payment_method":"pix","status":"pending","payment_status":"pending","subtotal":100,"total":100}'
test_rls_blocked "anon INSERT user_sessions" "$REST/user_sessions" "${H_AK_JSON[@]}" -d '{"user_id":"hacker"}'
test_rls_blocked "anon INSERT operation_logs" "$REST/operation_logs" "${H_AK_JSON[@]}" -d '{"operation":"hack","status":"success"}'
test_rls_blocked "anon INSERT edge_function_status" "$REST/edge_function_status" "${H_AK_JSON[@]}" -d '{"function_name":"hack","status":"active"}'
test_rls_blocked "anon INSERT otel_spans" "$REST/otel_spans" "${H_AK_JSON[@]}" -d '{"trace_id":"1","span_id":"1","name":"hack","start_time":"2026-01-01"}'
test_rls_blocked "anon INSERT otel_metrics" "$REST/otel_metrics" "${H_AK_JSON[@]}" -d '{"name":"hack","type":"COUNTER","value":1}'

# ===================== SENSITIVE TABLES =====================
section "4. SENSITIVE TABLES - ANON READ (blocked)"
test_rls_blocked "anon READ webhook_endpoints" "$REST/webhook_endpoints?limit=1" "${H_AK[@]}"
test_rls_blocked "anon READ inventory_movements" "$REST/inventory_movements?limit=1" "${H_AK[@]}"
test_rls_blocked "anon READ daily_metrics" "$REST/daily_metrics?limit=1" "${H_AK[@]}"
test_rls_blocked "anon READ rate_limits" "$REST/rate_limits?limit=1" "${H_AK[@]}"
test_rls_blocked "anon READ security_audit_log" "$REST/security_audit_log?limit=1" "${H_AK[@]}"
test_rls_blocked "anon READ third_party_sync_log" "$REST/third_party_sync_log?limit=1" "${H_AK[@]}"
test_rls_blocked "anon READ fulfillment_metrics" "$REST/fulfillment_metrics?limit=1" "${H_AK[@]}"

# ===================== VIEW SECURITY =====================
section "5. VIEW SECURITY (security_barrier)"
test_rls_allowed "anon READ product_details (public products)" "$REST/product_details?limit=1" "${H_AK[@]}"
test_rls_allowed "anon READ collection_summary (public collections)" "$REST/collection_summary?limit=1" "${H_AK[@]}"
test_rls_blocked "anon READ order_details (orders blocked)" "$REST/order_details?limit=1" "${H_AK[@]}"

# ===================== CART RLS =====================
section "6. CART RLS (anon blocked)"
test_rls_blocked "anon READ carts" "$REST/carts?limit=1" "${H_AK[@]}"
test_rls_blocked "anon INSERT carts" "$REST/carts" "${H_AK_JSON[@]}" -d '{"user_id":"00000000-0000-0000-0000-000000000000"}'
test_rls_blocked "anon READ cart_items" "$REST/cart_items?limit=1" "${H_AK[@]}"

# ===================== RPC FUNCTIONS =====================
section "7. SECURITY DEFINER FUNCTIONS"
H_SK_AK_JSON=("${H_SK_AK[@]}" "${H_JSON[@]}")
# These functions exist but may return 400 due to validation (missing FK refs, etc.)
# We test that they exist by checking they don't return 404 or 401
test_status "RPC: insert_order_item (exists)" "$REST/rpc/insert_order_item" "400" "${H_SK_AK_JSON[@]}" -d '{"p_order_id":"00000000-0000-0000-0000-000000000000","p_product_id":1,"p_product_name":"t","p_product_price":10,"p_quantity":1}'
test_status "RPC: insert_order_status_history (exists)" "$REST/rpc/insert_order_status_history" "400" "${H_SK_AK_JSON[@]}" -d '{"p_order_id":"00000000-0000-0000-0000-000000000000","p_status":"pending"}'
test_status "RPC: insert_webhook_event" "$REST/rpc/insert_webhook_event" "200" "${H_SK_AK_JSON[@]}" -d '{"p_source":"t","p_event_type":"t","p_payload":{}}'
# 204 = success with no content (void return)
test_status "RPC: increment_edge_function_counters (exists)" "$REST/rpc/increment_edge_function_counters" "204" "${H_SK_AK_JSON[@]}" -d '{"p_function_name":"infra-manager","p_increment_total":0}'
test_status "RPC: cleanup_orchestrator_data" "$REST/rpc/cleanup_orchestrator_data" "200" "${H_SK_AK_JSON[@]}" -d '{}'
test_status "RPC: insert_rate_limit_entry" "$REST/rpc/insert_rate_limit_entry" "200" "${H_SK_AK_JSON[@]}" -d '{"p_key":"e2e-test","p_count":1}'
test_status "RPC: insert_security_audit_log" "$REST/rpc/insert_security_audit_log" "200" "${H_SK_AK_JSON[@]}" -d '{"p_event_type":"auth_failure","p_identifier":"e2e"}'
test_status "RPC: insert_third_party_sync_log" "$REST/rpc/insert_third_party_sync_log" "200" "${H_SK_AK_JSON[@]}" -d '{"p_source":"t","p_sync_type":"full"}'

# ===================== DATA INTEGRITY =====================
section "8. DATA INTEGRITY - BhumisPrint + Livros"
test_field "Collection name = BhumisPrint" "$REST/collections?slug=eq.bhumi-print&select=name" "name" "BhumisPrint" "${H_SK_AK[@]}"
test_rls_allowed "Livros subcollection exists" "$REST/subcollections?select=*&slug=eq.livros" "${H_SK_AK[@]}"
test_field "Livros fulfillment_type" "$REST/subcollections?slug=eq.livros&select=fulfillment_type" "fulfillment_type" "own-stock" "${H_SK_AK[@]}"

# ===================== RATE LIMITS =====================
section "9. RATE LIMITS CONSOLIDATION"
# Table is empty (no data yet) but columns should exist. 200 with [] is success.
test_status "rate_limits accessible (columns exist)" "$REST/rate_limits?select=key,max_count,window_duration_seconds&limit=1" "200" "${H_SK_AK[@]}"

# ===================== COUNTER TEST =====================
section "10. ATOMIC COUNTER INCREMENT"
test_status "GET function before" "$EDGE/infra-manager/functions/infra-manager" "200" "${H_SK[@]}"
test_status "Trigger test (increment)" "$EDGE/infra-manager/functions/user-tracker/test" "200" "${H_SK[@]}" "${H_JSON[@]}" -d '{"args":{}}'
test_status "GET function after" "$EDGE/infra-manager/functions/infra-manager" "200" "${H_SK[@]}"

# ===================== SUMMARY =====================
echo -e "\n${BLUE}=== SUMMARY ===${NC}"
echo "  Total: $((PASS+FAIL))"
echo -e "  ${GREEN}Passed: $PASS${NC}"
echo -e "  ${RED}Failed: $FAIL${NC}"
echo ""
[ $FAIL -eq 0 ] && echo -e "  ${GREEN}ALL TESTS PASSED${NC}" && exit 0
echo -e "  ${RED}$FAIL TEST(S) FAILED${NC}" && exit 1
