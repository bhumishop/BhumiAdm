-- BhumiAdm Visual Orchestrator Infrastructure
-- Tables for: user sessions, active users, geolocation, operation logs, OpenTelemetry data

-- ============================================
-- User Sessions Table
-- ============================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  email TEXT,
  session_token TEXT UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active, last_active);

-- ============================================
-- User Geolocation Table
-- ============================================
CREATE TABLE IF NOT EXISTS user_geolocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  session_id UUID REFERENCES user_sessions(id),
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  city TEXT,
  region TEXT,
  country TEXT,
  country_code TEXT,
  ip_address TEXT,
  accuracy_meters INTEGER,
  source TEXT DEFAULT 'ip', -- 'gps', 'ip', 'manual'
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_user_geolocations_user_id ON user_geolocations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_geolocations_session ON user_geolocations(session_id);

-- ============================================
-- Operation Logs Table
-- ============================================
CREATE TABLE IF NOT EXISTS operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation TEXT NOT NULL, -- 'edge_function_call', 'db_query', 'config_change', 'auth'
  entity_type TEXT, -- 'edge_function', 'product', 'order', 'gateway', 'user'
  entity_id TEXT,
  user_id TEXT,
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'success', 'error', 'timeout'
  duration_ms INTEGER,
  request_payload JSONB,
  response_payload JSONB,
  error_message TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_operation_logs_operation ON operation_logs(operation);
CREATE INDEX IF NOT EXISTS idx_operation_logs_status ON operation_logs(status);
CREATE INDEX IF NOT EXISTS idx_operation_logs_user ON operation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_created ON operation_logs(created_at);

-- ============================================
-- OpenTelemetry Spans Table
-- ============================================
CREATE TABLE IF NOT EXISTS otel_spans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id TEXT NOT NULL,
  span_id TEXT NOT NULL,
  parent_span_id TEXT,
  name TEXT NOT NULL,
  kind TEXT DEFAULT 'INTERNAL', -- INTERNAL, SERVER, CLIENT, PRODUCER, CONSUMER
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_ns BIGINT,
  status_code TEXT DEFAULT 'UNSET', -- UNSET, OK, ERROR
  status_message TEXT,
  service_name TEXT DEFAULT 'bhumi-shop',
  resource_attributes JSONB DEFAULT '{}',
  span_attributes JSONB DEFAULT '{}',
  events JSONB DEFAULT '[]',
  links JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otel_spans_trace_id ON otel_spans(trace_id);
CREATE INDEX IF NOT EXISTS idx_otel_spans_name ON otel_spans(name);
CREATE INDEX IF NOT EXISTS idx_otel_spans_service ON otel_spans(service_name);
CREATE INDEX IF NOT EXISTS idx_otel_spans_status ON otel_spans(status_code);
CREATE INDEX IF NOT EXISTS idx_otel_spans_start_time ON otel_spans(start_time);

-- ============================================
-- OpenTelemetry Metrics Table
-- ============================================
CREATE TABLE IF NOT EXISTS otel_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT,
  type TEXT NOT NULL, -- COUNTER, GAUGE, HISTOGRAM, SUMMARY
  value DOUBLE PRECISION,
  count BIGINT,
  sum DOUBLE PRECISION,
  min DOUBLE PRECISION,
  max DOUBLE PRECISION,
  bucket_bounds DOUBLE PRECISION[],
  bucket_counts BIGINT[],
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  resource_attributes JSONB DEFAULT '{}',
  metric_attributes JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otel_metrics_name ON otel_metrics(name);
CREATE INDEX IF NOT EXISTS idx_otel_metrics_type ON otel_metrics(type);
CREATE INDEX IF NOT EXISTS idx_otel_metrics_timestamp ON otel_metrics(timestamp);

-- ============================================
-- Edge Function Status Table
-- ============================================
CREATE TABLE IF NOT EXISTS edge_function_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'active', -- active, inactive, degraded, error
  last_execution TIMESTAMPTZ,
  last_status TEXT,
  last_error TEXT,
  total_calls BIGINT DEFAULT 0,
  success_calls BIGINT DEFAULT 0,
  error_calls BIGINT DEFAULT 0,
  avg_duration_ms DECIMAL(10, 2),
  config JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_geolocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE otel_spans ENABLE ROW LEVEL SECURITY;
ALTER TABLE otel_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE edge_function_status ENABLE ROW LEVEL SECURITY;

-- Admin users can read/write all
CREATE POLICY "Admin full access user_sessions"
  ON user_sessions FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admin full access user_geolocations"
  ON user_geolocations FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admin full access operation_logs"
  ON operation_logs FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admin full access otel_spans"
  ON otel_spans FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admin full access otel_metrics"
  ON otel_metrics FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admin full access edge_function_status"
  ON edge_function_status FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Allow anon inserts for telemetry (edge functions call with anon key)
CREATE POLICY "Anon insert otel_spans"
  ON otel_spans FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anon insert otel_metrics"
  ON otel_metrics FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anon insert operation_logs"
  ON operation_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anon insert user_sessions"
  ON user_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anon update user_sessions"
  ON user_sessions FOR UPDATE
  USING (true);

-- ============================================
-- Seed edge function status entries
-- ============================================
INSERT INTO edge_function_status (function_name, status, config) VALUES
  ('admin-auth', 'active', '{"description": "Google OAuth admin authentication"}'),
  ('list-products', 'active', '{"description": "Product CRUD + variants + stock"}'),
  ('list-orders', 'active', '{"description": "Order management"}'),
  ('list-collections', 'active', '{"description": "Collections/subcollections/categories"}'),
  ('shipping-calculator', 'active', '{"description": "Shipping cost calculation, CEP lookup"}'),
  ('dashboard-metrics', 'active', '{"description": "KPIs, daily metrics, top products"}'),
  ('inventory-management', 'active', '{"description": "Stock movements, low stock alerts"}'),
  ('manage-integrations', 'active', '{"description": "Third-party sync logs, webhooks, mappings"}'),
  ('manage-variants', 'active', '{"description": "Variant CRUD"}'),
  ('manage-users', 'active', '{"description": "User management"}'),
  ('manage-shipping', 'active', '{"description": "Shipping management"}'),
  ('manage-orders-advanced', 'active', '{"description": "Advanced order operations"}'),
  ('network-graph', 'active', '{"description": "Graph data for visualization"}'),
  ('user-roles', 'active', '{"description": "RBAC management"}'),
  ('shop-config', 'active', '{"description": "Payment gateway/product rule config"}'),
  ('sales-analytics', 'active', '{"description": "Sales stats by gateway/location"}'),
  ('track-analytics', 'active', '{"description": "Product views, searches, cart events"}'),
  ('abacatepay-webhook', 'active', '{"description": "AbacatePay payment webhooks"}'),
  ('check-pix-status', 'active', '{"description": "PIX payment status checking"}'),
  ('create-billing', 'active', '{"description": "Billing creation"}'),
  ('storefront-auth', 'active', '{"description": "Storefront authentication"}'),
  ('storefront-cart', 'active', '{"description": "Storefront cart operations"}'),
  ('storefront-orders', 'active', '{"description": "Storefront order creation"}'),
  ('storefront-products', 'active', '{"description": "Storefront product listing"}'),
  ('storefront-shipping', 'active', '{"description": "Storefront shipping"}'),
  ('uma-penca-proxy', 'active', '{"description": "UmaPenca API proxy"}'),
  ('uma-penca-shipping', 'active', '{"description": "UmaPenca shipping calculation"}'),
  ('umapenca-prefill', 'active', '{"description": "UmaPenca registration pre-fill"}'),
  ('upload-cdn-image', 'active', '{"description": "CDN image upload to GitHub"}'),
  ('infra-manager', 'active', '{"description": "Infrastructure management and monitoring"}'),
  ('user-tracker', 'active', '{"description": "User session and geolocation tracking"}'),
  ('telemetry-collector', 'active', '{"description": "OpenTelemetry data collector"}')
ON CONFLICT (function_name) DO NOTHING;
