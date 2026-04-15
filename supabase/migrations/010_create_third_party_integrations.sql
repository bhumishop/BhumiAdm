-- Migration: 010_create_third_party_integrations
-- Description: Creates tables for third-party integrations (UmaPenca, etc.) and sync tracking

-- Third-party sync log
CREATE TABLE IF NOT EXISTS third_party_sync_log (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  source TEXT NOT NULL, -- 'uma-penca', 'prata-print', etc.
  sync_type TEXT NOT NULL CHECK (
    sync_type IN ('full', 'incremental', 'products', 'inventory', 'orders', 'pricing')
  ),
  -- Status
  status TEXT NOT NULL DEFAULT 'running' CHECK (
    status IN ('running', 'success', 'partial', 'failed')
  ),
  -- Results
  items_processed INTEGER DEFAULT 0,
  items_inserted INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  -- Errors
  errors JSONB DEFAULT '[]'::jsonb,
  -- Duration
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_seconds NUMERIC(10, 2),
  -- Trigger info
  triggered_by TEXT, -- 'github-actions', 'manual', 'scheduler'
  github_run_id TEXT, -- GitHub Actions run ID
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX idx_sync_log_source ON third_party_sync_log(source);
CREATE INDEX idx_sync_log_status ON third_party_sync_log(status);
CREATE INDEX idx_sync_log_started_at ON third_party_sync_log(started_at DESC);

-- Third-party product mapping (external ID -> internal ID)
CREATE TABLE IF NOT EXISTS third_party_product_mapping (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  internal_product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  external_product_id TEXT NOT NULL,
  external_product_url TEXT,
  -- Sync status
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'synced' CHECK (
    sync_status IN ('synced', 'pending', 'error', 'deleted_external')
  ),
  -- Price tracking
  external_price NUMERIC(10, 2),
  external_currency TEXT,
  -- Raw data snapshot
  raw_data JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source, external_product_id)
);

-- Indexes
CREATE INDEX idx_tp_mapping_internal ON third_party_product_mapping(internal_product_id);
CREATE INDEX idx_tp_mapping_source ON third_party_product_mapping(source);
CREATE INDEX idx_tp_mapping_external ON third_party_product_mapping(external_product_id);
CREATE INDEX idx_tp_mapping_sync_status ON third_party_product_mapping(sync_status);

-- Trigger for updated_at
CREATE TRIGGER update_tp_mapping_updated_at
  BEFORE UPDATE ON third_party_product_mapping
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Webhook endpoints for third-party notifications
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  secret TEXT, -- webhook signing secret
  is_active BOOLEAN DEFAULT true,
  events TEXT[] DEFAULT '{}', -- events to listen to
  last_triggered_at TIMESTAMPTZ,
  last_response_status INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook event log
CREATE TABLE IF NOT EXISTS webhook_events (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  webhook_id UUID REFERENCES webhook_endpoints(id) ON DELETE SET NULL,
  source TEXT NOT NULL,
  event_type TEXT NOT NULL,
  -- Payload
  payload JSONB NOT NULL,
  headers JSONB,
  -- Processing
  status TEXT NOT NULL DEFAULT 'received' CHECK (
    status IN ('received', 'processing', 'processed', 'failed', 'ignored')
  ),
  processing_error TEXT,
  processed_at TIMESTAMPTZ,
  -- Idempotency
  idempotency_key TEXT UNIQUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_webhook_events_source ON webhook_events(source);
CREATE INDEX idx_webhook_events_status ON webhook_events(status);
CREATE INDEX idx_webhook_events_created_at ON webhook_events(created_at DESC);
CREATE INDEX idx_webhook_events_idempotency ON webhook_events(idempotency_key);

-- Trigger for updated_at
CREATE TRIGGER update_webhook_endpoints_updated_at
  BEFORE UPDATE ON webhook_endpoints
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
