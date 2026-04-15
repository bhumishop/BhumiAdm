-- Fix RPC function signatures to match actual table columns
-- Drop ALL old overloads first, then create the new ones

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT oid::regprocedure AS proc FROM pg_proc WHERE proname = 'insert_webhook_event' AND pronamespace = 'public'::regnamespace LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.proc || ' CASCADE';
  END LOOP;
  FOR r IN SELECT oid::regprocedure AS proc FROM pg_proc WHERE proname = 'insert_third_party_sync_log' AND pronamespace = 'public'::regnamespace LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.proc || ' CASCADE';
  END LOOP;
  FOR r IN SELECT oid::regprocedure AS proc FROM pg_proc WHERE proname = 'insert_rate_limit_entry' AND pronamespace = 'public'::regnamespace LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.proc || ' CASCADE';
  END LOOP;
END $$;

CREATE FUNCTION insert_webhook_event(
  p_source TEXT, p_event_type TEXT, p_payload JSONB,
  p_headers JSONB DEFAULT NULL, p_status TEXT DEFAULT 'received',
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE v_event_id BIGINT;
BEGIN
  INSERT INTO webhook_events (source, event_type, payload, headers, status, idempotency_key)
  VALUES (p_source, p_event_type, p_payload, p_headers, p_status, p_idempotency_key)
  RETURNING id INTO v_event_id;
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE FUNCTION insert_third_party_sync_log(
  p_source TEXT, p_sync_type TEXT, p_status TEXT DEFAULT 'running',
  p_items_processed INTEGER DEFAULT 0, p_items_failed INTEGER DEFAULT 0,
  p_errors JSONB DEFAULT NULL, p_triggered_by TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS BIGINT AS $$
DECLARE v_log_id BIGINT;
BEGIN
  INSERT INTO third_party_sync_log (source, sync_type, status, items_processed, items_failed, errors, triggered_by, metadata)
  VALUES (p_source, p_sync_type, p_status, p_items_processed, p_items_failed, p_errors, p_triggered_by, p_metadata)
  RETURNING id INTO v_log_id;
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE FUNCTION insert_rate_limit_entry(
  p_key TEXT, p_count INTEGER DEFAULT 1, p_window_start TIMESTAMPTZ DEFAULT NOW(),
  p_window_duration_seconds INTEGER DEFAULT 60, p_max_count INTEGER DEFAULT 100,
  p_is_blocked BOOLEAN DEFAULT false, p_updated_at TIMESTAMPTZ DEFAULT NOW()
) RETURNS BIGINT AS $$
DECLARE v_id BIGINT;
BEGIN
  IF char_length(p_key) > 512 THEN RAISE EXCEPTION 'Rate limit key too long'; END IF;
  INSERT INTO rate_limits (key, count, window_start, window_duration_seconds, max_count, is_blocked, updated_at)
  VALUES (p_key, p_count, p_window_start, p_window_duration_seconds, p_max_count, p_is_blocked, p_updated_at)
  ON CONFLICT (key) DO UPDATE SET count = rate_limits.count + p_count, updated_at = p_updated_at
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION insert_webhook_event(text,text,jsonb,jsonb,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION insert_third_party_sync_log(text,text,text,integer,integer,jsonb,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION insert_rate_limit_entry(text,integer,timestamptz,integer,integer,boolean,timestamptz) TO service_role;
