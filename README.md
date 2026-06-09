# Argos Intelligence v4.0 — Auditor de Mercado

O Argos v4.0 é um motor matemático quantitativo de alta precisão projetado para atuar como um Auditor de Mercado, integrando inteligência contextual (RAG) e simulações estocásticas (Monte Carlo).

## 🚀 Estrutura de Diretórios

```text
argos-intelligence/
├── app/
│   └── api/
│       └── argos/
│           └── v4/
│               └── route.ts        <-- Endpoint Único (Vercel)
├── lib/
│   ├── argos/
│   │   ├── orchestrator/
│   │   │   └── ArgosOrchestratorV4.ts
│   │   └── regime/
│   │       ├── RAGContextEngine.ts
│   │       ├── RegimeEngineV4.ts
│   │       └── RegimeSchema.ts
│   └── core/
│       ├── contracts/
│       │   └── SignalContract.ts
│       ├── ModelFactory.ts
│       ├── SignalClassifierV4.ts
│       └── ArgosUnifiedEngine.ts
└── docs/
    └── ARCHITECTURE_V4.md
```

## 🛠️ Deploy na Vercel

1.  Conecte seu repositório GitHub à Vercel.
2.  Configure as seguintes Variáveis de Ambiente (Environment Variables):
    *   `NEXT_PUBLIC_SUPABASE_URL`: Sua URL do Supabase.
    *   `SUPABASE_SERVICE_ROLE_KEY`: Sua chave de serviço do Supabase.
    *   `GOOGLE_API_KEY`: Sua chave da API do Google Gemini.
3.  O deploy será automático. O endpoint da API será `https://seu-dominio.vercel.app/api/argos/v4`.

## 🎯 Pilares da v4.0

*   **Pureza Matemática**: Motores Poisson/Elo inalterados.
*   **Inteligência Contextual**: RAG com pgvector e Gemini Flash para rotulagem de regimes.
*   **Simulação de Dispersão**: Monte Carlo com 1.500 iterações por jogo.
*   **Tripla Classificação**: VALUE, VALIDATION e NOISE para máxima assertividade.
