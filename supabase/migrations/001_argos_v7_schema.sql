-- ============================================================
-- ARGOS v7.0 — SUPABASE SQL SCHEMA (COMPLETE)
-- Production-Ready Database Setup for Telegram Integration
-- Execute na ordem apresentada: TABLES → INDEXES → FUNCTIONS → TRIGGERS
-- ============================================================

-- ============================================================
-- PHASE 1: CREATE TABLES (FOUNDATIONAL)
-- ============================================================

-- 1.1 CORE MATCHES TABLE
CREATE TABLE IF NOT EXISTS public.argos_matches (
  id BIGSERIAL PRIMARY KEY,
  external_fixture_id INTEGER UNIQUE NOT NULL,
  external_provider VARCHAR(50) NOT NULL DEFAULT 'PROPLINE',
  match_id VARCHAR(50) NOT NULL UNIQUE,
  league_id INTEGER NOT NULL,
  sport_key VARCHAR(100) NOT NULL DEFAULT 'soccer',
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(20) DEFAULT 'NS',
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  processed BOOLEAN DEFAULT FALSE,
  CONSTRAINT status_valid CHECK (status IN ('NS', 'Live', 'Finished', 'Cancelled', 'Suspended'))
);

-- 1.2 SIGNAL LEDGER (Histórico de Todos os Sinais)
CREATE TABLE IF NOT EXISTS public.argos_signal_ledger (
  id BIGSERIAL PRIMARY KEY,
  match_id VARCHAR(50) NOT NULL REFERENCES public.argos_matches(match_id) ON DELETE CASCADE,
  signal_id VARCHAR(100) NOT NULL,
  vertical VARCHAR(50) NOT NULL,
  selection VARCHAR(255) NOT NULL,
  probability NUMERIC(5,4) CHECK (probability >= 0 AND probability <= 1),
  implied_odds NUMERIC(10,2),
  expected_value NUMERIC(10,4),
  kelly_criterion NUMERIC(10,4),
  tier VARCHAR(10) NOT NULL CHECK (tier IN ('FREE', 'VIP')),
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'SETTLED')),
  regime VARCHAR(50),
  confidence_score NUMERIC(5,4),
  rating_label VARCHAR(20),
  analysis_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP WITH TIME ZONE,
  settled_at TIMESTAMP WITH TIME ZONE,
  result_status VARCHAR(20) CHECK (result_status IN ('WIN', 'LOSS', 'VOID')),
  CONSTRAINT unique_signal_per_match UNIQUE(match_id, signal_id, vertical)
);

-- 1.3 TELEGRAM QUEUE (HTTP Queue for Async Dispatch)
CREATE TABLE IF NOT EXISTS public.argos_http_queue (
  id BIGSERIAL PRIMARY KEY,
  url VARCHAR(255) NOT NULL,
  headers JSONB NOT NULL DEFAULT '{"Content-Type": "application/json"}'::jsonb,
  body JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'RETRY')),
  retry_count INTEGER DEFAULT 0 CHECK (retry_count >= 0),
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP WITH TIME ZONE,
  next_retry_at TIMESTAMP WITH TIME ZONE
);

-- 1.4 BATCH PROCESSING QUEUE
CREATE TABLE IF NOT EXISTS public.argos_batch_queue (
  id BIGSERIAL PRIMARY KEY,
  match_id VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED', 'EXPIRED')),
  requested_verticals TEXT[] DEFAULT ARRAY[]::TEXT[],
  market_family VARCHAR(50) DEFAULT 'ALL_MARKETS',
  raw_data JSONB,
  processing_result JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  priority INTEGER DEFAULT 0,
  CONSTRAINT match_queue_unique UNIQUE(match_id, created_at)
);

-- 1.5 TELEGRAM DELIVERY LOG (Auditoria)
CREATE TABLE IF NOT EXISTS public.argos_telegram_log (
  id BIGSERIAL PRIMARY KEY,
  signal_id VARCHAR(100) NOT NULL,
  channel_id VARCHAR(50) NOT NULL,
  tier VARCHAR(10) NOT NULL CHECK (tier IN ('FREE', 'VIP')),
  message_text TEXT NOT NULL,
  telegram_message_id BIGINT,
  http_status_code INTEGER,
  response_body JSONB,
  delivery_status VARCHAR(20) DEFAULT 'PENDING' CHECK (delivery_status IN ('PENDING', 'DELIVERED', 'FAILED', 'BLOCKED')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  delivered_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT log_unique UNIQUE(signal_id, channel_id)
);

-- 1.6 PREDICTION HISTORY (Para Continuous Learning)
CREATE TABLE IF NOT EXISTS public.argos_predictions (
  id BIGSERIAL PRIMARY KEY,
  match_id VARCHAR(50) NOT NULL REFERENCES public.argos_matches(match_id) ON DELETE CASCADE,
  league_id INTEGER NOT NULL,
  vertical VARCHAR(50) NOT NULL,
  predicted_outcome VARCHAR(255) NOT NULL,
  predicted_probability NUMERIC(5,4),
  actual_outcome VARCHAR(255),
  brier_score NUMERIC(10,6),
  log_loss NUMERIC(10,6),
  accuracy BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  settled_at TIMESTAMP WITH TIME ZONE
);

-- 1.7 MODEL CONFIGURATIONS
CREATE TABLE IF NOT EXISTS public.argos_model_config (
  id BIGSERIAL PRIMARY KEY,
  league_id INTEGER NOT NULL,
  league_name VARCHAR(255) NOT NULL,
  vertical VARCHAR(50) NOT NULL,
  weights JSONB NOT NULL DEFAULT '{"poisson": 0.2, "elo": 0.15, "monte_carlo": 0.4, "rag": 0.15, "regressor": 0.1}'::jsonb,
  threshold_free NUMERIC(5,4) DEFAULT 0.75,
  threshold_vip NUMERIC(5,4) DEFAULT 0.55,
  min_ev_threshold NUMERIC(10,4) DEFAULT 0.01,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT config_unique UNIQUE(league_id, vertical)
);

-- ============================================================
-- PHASE 2: CREATE INDEXES (PERFORMANCE OPTIMIZATION)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_argos_matches_league_id ON public.argos_matches(league_id);
CREATE INDEX IF NOT EXISTS idx_argos_matches_start_time ON public.argos_matches(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_argos_matches_status ON public.argos_matches(status);
CREATE INDEX IF NOT EXISTS idx_argos_matches_processed ON public.argos_matches(processed);

CREATE INDEX IF NOT EXISTS idx_argos_signal_ledger_match_id ON public.argos_signal_ledger(match_id);
CREATE INDEX IF NOT EXISTS idx_argos_signal_ledger_tier ON public.argos_signal_ledger(tier);
CREATE INDEX IF NOT EXISTS idx_argos_signal_ledger_status ON public.argos_signal_ledger(status);
CREATE INDEX IF NOT EXISTS idx_argos_signal_ledger_created_at ON public.argos_signal_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_argos_signal_ledger_vertical ON public.argos_signal_ledger(vertical);

CREATE INDEX IF NOT EXISTS idx_argos_http_queue_status ON public.argos_http_queue(status);
CREATE INDEX IF NOT EXISTS idx_argos_http_queue_created_at ON public.argos_http_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_argos_http_queue_retry ON public.argos_http_queue(next_retry_at) WHERE status = 'RETRY';

CREATE INDEX IF NOT EXISTS idx_argos_batch_queue_status ON public.argos_batch_queue(status);
CREATE INDEX IF NOT EXISTS idx_argos_batch_queue_match_id ON public.argos_batch_queue(match_id);
CREATE INDEX IF NOT EXISTS idx_argos_batch_queue_created_at ON public.argos_batch_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_argos_batch_queue_priority ON public.argos_batch_queue(priority DESC, created_at ASC) WHERE status = 'QUEUED';

CREATE INDEX IF NOT EXISTS idx_argos_telegram_log_signal_id ON public.argos_telegram_log(signal_id);
CREATE INDEX IF NOT EXISTS idx_argos_telegram_log_tier ON public.argos_telegram_log(tier);
CREATE INDEX IF NOT EXISTS idx_argos_telegram_log_delivery_status ON public.argos_telegram_log(delivery_status);

CREATE INDEX IF NOT EXISTS idx_argos_predictions_match_id ON public.argos_predictions(match_id);
CREATE INDEX IF NOT EXISTS idx_argos_predictions_league_id ON public.argos_predictions(league_id);
CREATE INDEX IF NOT EXISTS idx_argos_predictions_created_at ON public.argos_predictions(created_at DESC);

-- ============================================================
-- PHASE 3: CREATE FUNCTIONS (BUSINESS LOGIC)
-- ============================================================

-- 3.1 ATUALIZAR TIMESTAMP DE UPDATE
CREATE OR REPLACE FUNCTION update_argos_matches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3.2 FUNÇÃO PARA BUSCAR PRÓXIMA FILA
CREATE OR REPLACE FUNCTION get_next_queue_item()
RETURNS TABLE(
  id BIGINT,
  match_id VARCHAR,
  status VARCHAR,
  raw_data JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    bq.id,
    bq.match_id,
    bq.status,
    bq.raw_data
  FROM public.argos_batch_queue bq
  WHERE bq.status = 'QUEUED'
  ORDER BY bq.priority DESC, bq.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
END;
$$ LANGUAGE plpgsql;

-- 3.3 FUNÇÃO PARA DISPATCH DE SINAIS PARA TELEGRAM
CREATE OR REPLACE FUNCTION dispatch_signal_to_telegram(signal_data JSONB)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_signal_id VARCHAR;
  v_tier VARCHAR;
  v_channel_id VARCHAR;
  v_message_text TEXT;
BEGIN
  v_signal_id := signal_data->>'signal_id';
  v_tier := signal_data->>'tier';
  v_channel_id := CASE 
    WHEN v_tier = 'FREE' THEN '-1004447462304'
    WHEN v_tier = 'VIP' THEN '-1004452972435'
    ELSE NULL
  END;

  IF v_channel_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Invalid tier or missing channel'::TEXT;
    RETURN;
  END IF;

  -- Construir mensagem baseada no tier
  v_message_text := CASE
    WHEN v_tier = 'FREE' THEN 
      FORMAT('🔥 <b>SINAL FREE | ALTA ASSERTIVIDADE</b>\n──────────────────────\n'
             '🏟️ <b>JOGO:</b> <code>%s</code>\n'
             '🎯 <b>ENTRADA:</b> <code>%s</code>\n'
             '📊 <b>CONFIANÇA:</b> <code>%s%%</code>\n'
             '──────────────────────\n'
             '👉 <b>VIP:</b> <a href="https://t.me/+T_gr8u0lKTpjMmMx">CLIQUE AQUI</a>',
        signal_data->>'matchName',
        signal_data->>'vertical',
        signal_data->>'probability'
      )
    WHEN v_tier = 'VIP' THEN
      FORMAT('💎 <b>ARGOS VIP | SYNDICATE MASTER</b>\n'
             '──────────────────────\n'
             '⚽️ <b>%s</b>\n'
             '🏆 %s\n'
             '🎯 <b>Entrada:</b> %s %s\n'
             '📝 <b>Seleção:</b> <code>%s</code>\n'
             '📈 <b>Odd Atual:</b> <code>%s</code> (Fair: <code>%s</code>)\n'
             '📊 <b>Edge:</b> <code>%s%%</code>\n'
             '🧠 <b>Confiança:</b> <code>%s%%</code>\n'
             '📏 <b>Kelly (1/4):</b> <code>%s%%</code>\n'
             '──────────────────────\n'
             '🤖 <b>Análise:</b> %s',
        signal_data->>'matchName',
        signal_data->>'leagueName',
        signal_data->>'vertical',
        COALESCE(signal_data->>'line', ''),
        signal_data->>'selection',
        signal_data->>'odd',
        signal_data->>'fairOdd',
        signal_data->>'expectedValue',
        signal_data->>'probability',
        COALESCE(signal_data->>'kellyCriterion', 'N/A'),
        COALESCE(signal_data->>'analysisSummary', 'Alta confiança')
      )
  END;

  -- Inserir na fila HTTP
  INSERT INTO public.argos_http_queue (
    url,
    headers,
    body,
    status
  ) VALUES (
    'https://api.telegram.org/bot8700765166:AAGE2K_inKiWKdj5vIaZm8SmsQuiY7Byi1M/sendMessage',
    '{"Content-Type": "application/json"}'::jsonb,
    jsonb_build_object(
      'chat_id', v_channel_id,
      'text', v_message_text,
      'parse_mode', 'HTML',
      'disable_web_page_preview', true
    ),
    'PENDING'
  );

  -- Registrar no log
  INSERT INTO public.argos_telegram_log (
    signal_id,
    channel_id,
    tier,
    message_text,
    delivery_status
  ) VALUES (
    v_signal_id,
    v_channel_id,
    v_tier,
    v_message_text,
    'PENDING'
  );

  RETURN QUERY SELECT TRUE, 'Signal queued for dispatch'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 3.4 FUNÇÃO PARA LIMPAR FILA EXPIRADA
CREATE OR REPLACE FUNCTION cleanup_expired_queue_items()
RETURNS TABLE(
  expired_count INTEGER,
  deleted_count INTEGER
) AS $$
DECLARE
  v_expired_count INTEGER;
  v_deleted_count INTEGER;
BEGIN
  -- Marcar como EXPIRED itens com mais de 12h na fila
  UPDATE public.argos_batch_queue
  SET status = 'EXPIRED'
  WHERE status = 'QUEUED'
    AND created_at < (CURRENT_TIMESTAMP - INTERVAL '12 hours');

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;

  -- Deletar logs de auditoria com mais de 7 dias
  DELETE FROM public.argos_signal_ledger
  WHERE created_at < (CURRENT_TIMESTAMP - INTERVAL '7 days')
    AND status = 'SETTLED';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN QUERY SELECT v_expired_count, v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 3.5 FUNÇÃO PARA CALCULAR ESTATÍSTICAS DA FILA
CREATE OR REPLACE FUNCTION get_queue_statistics()
RETURNS TABLE(
  total_queued INTEGER,
  total_processing INTEGER,
  total_completed INTEGER,
  total_failed INTEGER,
  pending_http INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INTEGER FROM public.argos_batch_queue WHERE status = 'QUEUED'),
    (SELECT COUNT(*)::INTEGER FROM public.argos_batch_queue WHERE status = 'PROCESSING'),
    (SELECT COUNT(*)::INTEGER FROM public.argos_batch_queue WHERE status = 'COMPLETED'),
    (SELECT COUNT(*)::INTEGER FROM public.argos_batch_queue WHERE status = 'FAILED'),
    (SELECT COUNT(*)::INTEGER FROM public.argos_http_queue WHERE status IN ('PENDING', 'RETRY'));
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- PHASE 4: CREATE TRIGGERS (AUTOMATED WORKFLOWS)
-- ============================================================

-- 4.1 ATUALIZAR TIMESTAMP EM MATCHES
CREATE TRIGGER trigger_argos_matches_updated_at
BEFORE UPDATE ON public.argos_matches
FOR EACH ROW
EXECUTE FUNCTION update_argos_matches_updated_at();

-- 4.2 AUTOMATICAMENTE PROCESSAR SINAIS QUANDO INSERIR NA FILA
CREATE OR REPLACE FUNCTION process_signal_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o sinal foi marcado para envio imediato, dispatch para Telegram
  IF NEW.tier IS NOT NULL THEN
    PERFORM dispatch_signal_to_telegram(
      jsonb_build_object(
        'signal_id', NEW.signal_id,
        'tier', NEW.tier,
        'matchName', (SELECT CONCAT(home_team, ' vs ', away_team) FROM public.argos_matches WHERE match_id = NEW.match_id),
        'leagueName', 'Elite League',
        'vertical', NEW.vertical,
        'selection', NEW.selection,
        'odd', NEW.implied_odds,
        'fairOdd', NEW.implied_odds * 0.95,
        'expectedValue', NEW.expected_value,
        'probability', NEW.probability,
        'kellyCriterion', NEW.kelly_criterion,
        'analysisSummary', NEW.analysis_summary
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_signal_dispatch_on_insert ON public.argos_signal_ledger;
CREATE TRIGGER trigger_signal_dispatch_on_insert
AFTER INSERT ON public.argos_signal_ledger
FOR EACH ROW
EXECUTE FUNCTION process_signal_on_insert();

-- ============================================================
-- PHASE 5: ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.argos_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.argos_signal_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.argos_batch_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.argos_http_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.argos_telegram_log ENABLE ROW LEVEL SECURITY;

-- Política: service_role pode ler/escrever tudo
DROP POLICY IF EXISTS "service_role_full_access" ON public.argos_matches;
CREATE POLICY "service_role_full_access"
  ON public.argos_matches
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_full_access_signals" ON public.argos_signal_ledger;
CREATE POLICY "service_role_full_access_signals"
  ON public.argos_signal_ledger
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_full_access_queue" ON public.argos_batch_queue;
CREATE POLICY "service_role_full_access_queue"
  ON public.argos_batch_queue
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_full_access_http" ON public.argos_http_queue;
CREATE POLICY "service_role_full_access_http"
  ON public.argos_http_queue
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_full_access_telegram" ON public.argos_telegram_log;
CREATE POLICY "service_role_full_access_telegram"
  ON public.argos_telegram_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- PHASE 6: SEED INITIAL DATA (MODEL CONFIGS)
-- ============================================================

INSERT INTO public.argos_model_config (
  league_id,
  league_name,
  vertical,
  weights,
  threshold_free,
  threshold_vip,
  min_ev_threshold
) VALUES
  (1, 'FIFA World Cup', 'WINNER', '{"poisson": 0.2, "elo": 0.15, "monte_carlo": 0.4, "rag": 0.15, "regressor": 0.1}'::jsonb, 0.75, 0.55, 0.01),
  (2, 'UEFA Champions League', 'GOALS', '{"poisson": 0.25, "elo": 0.1, "monte_carlo": 0.35, "rag": 0.2, "regressor": 0.1}'::jsonb, 0.70, 0.50, 0.015),
  (3, 'Premier League', 'CORNERS', '{"poisson": 0.15, "elo": 0.2, "monte_carlo": 0.45, "rag": 0.1, "regressor": 0.1}'::jsonb, 0.65, 0.45, 0.020),
  (4, 'La Liga', 'CARDS', '{"poisson": 0.2, "elo": 0.15, "monte_carlo": 0.4, "rag": 0.15, "regressor": 0.1}'::jsonb, 0.70, 0.50, 0.015),
  (5, 'Serie A', 'BTTS', '{"poisson": 0.2, "elo": 0.15, "monte_carlo": 0.4, "rag": 0.15, "regressor": 0.1}'::jsonb, 0.75, 0.55, 0.010)
ON CONFLICT (league_id, vertical) DO UPDATE SET
  updated_at = CURRENT_TIMESTAMP;

SELECT 'ARGOS v7.0 SQL SCHEMA - DEPLOYMENT COMPLETE' AS status;
