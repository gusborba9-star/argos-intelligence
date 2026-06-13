-- Cria a tabela para rastrear a performance dos sinais (Track Record do Argos)
CREATE TABLE IF NOT EXISTS argos_performance_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_delivery_id UUID REFERENCES signal_delivery_log(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    signal_id UUID REFERENCES argos_signal_ledger(id) ON DELETE CASCADE NOT NULL,
    -- Informações do sinal no momento da entrega
    market TEXT NOT NULL, -- Ex: 'HOME_WIN', 'OVER_2_5_GOALS'
    vertical TEXT NOT NULL, -- Ex: 'WINNER', 'GOALS'
    probability DECIMAL(5, 4) NOT NULL, -- Probabilidade do modelo (0.0000 - 1.0000)
    implied_odds DECIMAL(6, 2) NOT NULL, -- Odd implícita do modelo
    kelly_stake DECIMAL(5, 4) DEFAULT 0, -- Stake calculado por Kelly (apenas WHALE/VIP)
    -- Resultado final
    settled_status TEXT, -- 'WIN', 'LOSS', 'VOID', 'PENDING'
    settled_at TIMESTAMP WITH TIME ZONE,
    -- Cálculo de Brier Score (para avaliar a calibração do modelo)
    brier_score DECIMAL(6, 4), -- (probabilidade - resultado_real)^2
    -- Rastreamento de CLV (Closing Line Value)
    market_opening_odds DECIMAL(6, 2), -- Odd no momento da entrega
    market_closing_odds DECIMAL(6, 2), -- Odd no momento do fechamento
    clv_percentage DECIMAL(6, 2), -- ((closing_odds - opening_odds) / opening_odds) * 100
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_performance_tracking_user_id ON argos_performance_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_performance_tracking_settled_at ON argos_performance_tracking(settled_at);
CREATE INDEX IF NOT EXISTS idx_performance_tracking_vertical ON argos_performance_tracking(vertical);

-- Habilita RLS
ALTER TABLE argos_performance_tracking ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
-- Usuários podem ver seu próprio track record
CREATE POLICY "Users can view their own performance tracking" ON argos_performance_tracking FOR SELECT USING (auth.uid() = user_id);

-- Função para calcular estatísticas agregadas (para o dashboard público)
CREATE OR REPLACE FUNCTION get_argos_public_statistics()
RETURNS TABLE (
    total_signals_delivered BIGINT,
    total_signals_won BIGINT,
    total_signals_lost BIGINT,
    win_rate DECIMAL,
    average_brier_score DECIMAL,
    average_clv_percentage DECIMAL,
    roi_percentage DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_signals_delivered,
        COUNT(CASE WHEN settled_status = 'WIN' THEN 1 END)::BIGINT as total_signals_won,
        COUNT(CASE WHEN settled_status = 'LOSS' THEN 1 END)::BIGINT as total_signals_lost,
        ROUND(COUNT(CASE WHEN settled_status = 'WIN' THEN 1 END)::DECIMAL / NULLIF(COUNT(*), 0) * 100, 2) as win_rate,
        ROUND(AVG(brier_score), 4) as average_brier_score,
        ROUND(AVG(clv_percentage), 2) as average_clv_percentage,
        ROUND(SUM(CASE WHEN settled_status = 'WIN' THEN kelly_stake ELSE -kelly_stake END) / NULLIF(COUNT(*), 0) * 100, 2) as roi_percentage
    FROM argos_performance_tracking
    WHERE settled_status IS NOT NULL;
END;
$$ LANGUAGE plpgsql;
