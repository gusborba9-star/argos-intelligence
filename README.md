# Argos Intelligence v6.0.0 — Syndicate Master Edition

🏆 **Status**: Production Ready | **Version**: 6.0.0-Master | **Author**: CTO Senior Engineer (Manus AI) | **Email**: gusborba9@gmail.com

O Argos v6.0.0 é a evolução definitiva do sistema, transformando-o em um motor de inteligência de nível **Syndicate Americano**. Esta versão foca em **Single-Pass Ingestion**, **Pinnacle-Heavy Fair Lines** e **Zero Veto Distribution**.

## 🚀 Fluxo Mestre Syndicate (v6.0.0)

O sistema opera em um fluxo linear e otimizado para eliminar redundâncias e garantir EV+ em cada sinal:

1.  **PropLine Mega Call All-In**: Ingestão completa de todos os mercados disponíveis em uma única chamada.
2.  **MarketNormalizer**: Transformação do payload bruto em estrutura estável, capturando TODAS as casas (Pinnacle, Betfair, etc).
3.  **Feature Engine**: Geração de vetores estatísticos com decaimento exponencial (jogos recentes valem mais).
4.  **RAG + Monte Carlo**: Integração de contexto (lesões, clima, motivação via RAG) com simulações estocásticas de 10.000 iterações.
5.  **Odds Value Engine**: Cálculo de EV%, Edge% e Real Value. NUNCA um sinal é enviado sem EV positivo.
6.  **Signal Distribution Engine**: Classificação automática entre canais **FREE** (Alta Probabilidade/Elite) e **VIP** (Full EV+).

## 🏛️ Arquitetura de Pastas (v6.0.0)

```text
argos-intelligence/
├── app/
│   └── api/
│       └── argos/
│           └── v6/
│               └── route.ts              ← Novo Endpoint Master (Single-Pass)
├── lib/
│   ├── argos/
│   │   ├── orchestrator/
│   │   │   └── ArgosMasterOrchestrator.ts ← O Cérebro do Sistema
│   │   ├── regime/
│   │   │   └── RAGContextEngine.ts       ← Recuperação de Contexto Semântico
│   │   └── delivery/
│   │       └── ValueDeliveryService.ts   ← Gestão de Tiers (FREE/VIP)
│   └── core/
│       ├── market-intelligence/
│       │   ├── MarketNormalizer.ts       ← Normalização Universal
│       │   ├── FairOddsCalculator.ts     ← Pinnacle-Heavy Engine
│       │   ├── OddsValueEngine.ts        ← EV & Kelly Calculator
│       │   └── SignalDistributionEngine.ts ← Telegram Dispatcher
│       ├── ModelFactory.ts               ← Monte Carlo & Poisson
│       └── FeatureEngine.ts              ← Estatística Avançada
└── supabase/
    └── migrations/
        └── v6_master_perfect_flow.sql    ← Schema Consolidado
```

## 🛠️ Configuração e Build

### 1. Variáveis de Ambiente (.env)
```bash
PROPLINE_API_KEY=sua_chave
TELEGRAM_BOT_TOKEN=seu_token
TELEGRAM_FREE_CHANNEL_ID=id_canal_free
TELEGRAM_CHAT_ID=id_canal_vip
NEXT_PUBLIC_SUPABASE_URL=url_supabase
SUPABASE_SERVICE_ROLE_KEY=key_service_role
GOOGLE_AI_API_KEY=chave_gemini_rag
```

### 2. Build de Produção
```bash
npm install
npm run build
```

## 🎯 Regras de Ouro do Syndicate Master

- **Pinnacle como Âncora**: A Pinnacle possui o maior peso no cálculo de Fair Odds por ser a referência mundial de mercado sharp.
- **Varredura Total**: O Argos nunca analisa apenas o vencedor. Se o mercado 1X2 não tem valor, ele varre Handicap, Gols, Cantos, Cartões e Props.
- **Single-Pass**: O dado entra uma vez e percorre todo o pipeline sem re-fetch, garantindo velocidade e economia de API.
- **FREE vs VIP**:
    - **FREE**: Vitrine de assertividade. Sinais com Probabilidade > 70% ou Rating ELITE.
    - **VIP**: Inteligência completa. Todos os mercados com EV+ e gestão de banca via Kelly Fractional.

## 🤝 Manutenção
Sistema mantido sob supervisão de **gusborba9@gmail.com**.
Para auditorias técnicas, consulte os relatórios na pasta `docs/`.
