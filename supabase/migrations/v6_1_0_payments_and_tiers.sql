-- ============================================================
-- ARGOS v6.1.0 — PAYMENTS & TIERS SYNC
-- Configura a tabela de pagamentos EFI e sincroniza tiers VIP.
-- ============================================================

-- 1. Tabela: argos_payments (Gestão de Cobranças Efí)
CREATE TABLE IF NOT EXISTS argos_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tx_id TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_type TEXT NOT NULL, -- 'VIP', 'WHALE'
    amount DECIMAL(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PAID', 'EXPIRED', 'FAILED'
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_argos_payments_user_id ON argos_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_argos_payments_tx_id ON argos_payments(tx_id);
CREATE INDEX IF NOT EXISTS idx_argos_payments_status ON argos_payments(status);

-- 2. Atualização da tabela users (adicionar campos de controle VIP)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='vip_access_until') THEN
        ALTER TABLE users ADD COLUMN vip_access_until TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='payment_status') THEN
        ALTER TABLE users ADD COLUMN payment_status TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='pix_tx_id') THEN
        ALTER TABLE users ADD COLUMN pix_tx_id TEXT;
    END IF;
END $$;

-- 3. Habilitar RLS para argos_payments
ALTER TABLE argos_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payments" 
ON argos_payments FOR SELECT 
USING (auth.uid() = user_id);

-- Fim da migration v6.1.0
