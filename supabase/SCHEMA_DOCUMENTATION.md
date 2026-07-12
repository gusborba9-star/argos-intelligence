# ARGOS v7.0 — Supabase SQL Schema Complete

## 📋 Tabelas Criadas

### 1. **argos_matches** (Core)
- External fixture management
- Raw data storage (JSONB)
- Status tracking
- Índices: league_id, start_time, status, processed

### 2. **argos_signal_ledger** (Signals)
- Histórico completo de sinais
- Tier segregation (FREE/VIP)
- Settlement tracking
- Índices: match_id, tier, status, created_at, vertical

### 3. **argos_http_queue** (HTTP Dispatch)
- Fila de requisições HTTP assíncrona
- Retry logic com exponential backoff
- Suporta múltiplas tentativas

### 4. **argos_batch_queue** (Processing)
- Fila de processamento de matches
- Priority-based scheduling
- State machine: QUEUED → PROCESSING → COMPLETED/FAILED

### 5. **argos_telegram_log** (Auditoria)
- Log de todos os envios para Telegram
- Rastreamento de erros
- Correlação com sinais

### 6. **argos_predictions** (Learning)
- Histórico de previsões para calibração
- Brier Score & Log Loss calculation
- Base para Continuous Learning Engine

### 7. **argos_model_config** (Configuration)
- Pesos dos modelos por liga/vertical
- Thresholds dinâmicos (FREE/VIP)
- EV mínimo configurável

## 🔧 Funções Criadas

1. **update_argos_matches_updated_at()** - Trigger para timestamp
2. **get_next_queue_item()** - Buscar próxima fila (FOR UPDATE SKIP LOCKED)
3. **dispatch_signal_to_telegram()** - Dispatch com formatação por tier
4. **cleanup_expired_queue_items()** - Limpeza automática
5. **get_queue_statistics()** - Estatísticas em tempo real

## 🔐 Triggers Criados

1. **trigger_argos_matches_updated_at** - Auto-update timestamp
2. **trigger_signal_dispatch_on_insert** - Auto-dispatch de sinais para Telegram

## 📊 Índices para Performance

- **Batch Queue**: index (priority DESC, created_at ASC) WHERE QUEUED
- **Signal Ledger**: index (tier, status, created_at DESC)
- **HTTP Queue**: index (next_retry_at) WHERE RETRY

## 🔒 Row Level Security (RLS)

- ✅ Habilitado em todas as tabelas
- ✅ service_role tem acesso completo
- ✅ Pronto para autenticação futura

## 🚀 Como Executar

### Via Supabase SQL Editor:

```bash
1. Abra https://app.supabase.com
2. Vá para: SQL Editor → New Query
3. Cole todo o conteúdo de migrations/001_argos_v7_schema.sql
4. Clique em "Run"
5. Aguarde conclusão (2-3 segundos)
6. Verifique status com as queries de verificação no final
```

### Via CLI Supabase:

```bash
supabase migration up
```

## ✅ Verificação Pós-Deploy

```sql
-- Contar tabelas
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE 'argos_%';
-- Esperado: 7 tabelas

-- Contar índices
SELECT COUNT(*) FROM pg_indexes 
WHERE schemaname = 'public' AND tablename LIKE 'argos_%';
-- Esperado: 15+ índices

-- Testar inserção
INSERT INTO argos_matches (
  external_fixture_id, match_id, league_id, 
  home_team, away_team, start_time
) VALUES (
  999999, 'test_match_001', 1,
  'Test Home', 'Test Away',
  NOW() + INTERVAL '1 day'
);
-- Esperado: 1 row inserted
```

## 📞 Integração com Telegram

### FREE Channel (-1004447462304):
- Recebe sinais com prob > 75%
- Mensagem simplificada + CTA para upgrade

### VIP Channel (-1004452972435):
- Recebe TODOS os sinais processados
- Detalhes completos (EV, Kelly, Edge, etc)
- Regime de mercado incluído

### Workflow de Envio:

```
1. Signal inserida em argos_signal_ledger
   ↓
2. Trigger: process_signal_on_insert()
   ↓
3. dispatch_signal_to_telegram() chamada
   ↓
4. HTTP request queued em argos_http_queue
   ↓
5. Edge Function do Supabase consome fila
   ↓
6. Telegram API chamada
   ↓
7. Log atualizado em argos_telegram_log
```

## 🔄 Cron Job (Edge Function)

A seguir no arquivo: `supabase/edge_functions/argos_cron_worker.ts`

Executa:
- A cada 5 min: Cleanup de fila expirada
- A cada 1 min: Processa batch_queue
- A cada 30s: Envia HTTP queue pendente

## 📈 Performance Esperada

- **Insert Signal**: < 50ms (com índices)
- **Get Next Queue**: < 10ms (FOR UPDATE SKIP LOCKED)
- **Dispatch to Telegram**: < 100ms (async em HTTP queue)
- **Cleanup Job**: < 1s (executa 1x/hora)

## 🛡️ Backup & Recovery

Todas as tabelas têm `created_at` e `updated_at` para auditoria.
Implementar backups com:

```bash
supabase db pull  # Pull local do schema
supabase db push  # Push de mudanças
```

---

**Status**: ✅ PRODUCTION READY  
**Last Updated**: 2026-07-12  
**Author**: CTO Engenheiro Sênior - Argos Intelligence v7.0
