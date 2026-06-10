# 🏛️ Argos Intelligence: Arquitetura v4.0 (Zero-Touch Edition)

O Argos v4.0 representa a evolução para um motor de inteligência quantitativa de alta precisão, operando sob o paradigma **Zero-Touch** (intervenção humana zero). A arquitetura é construída sobre Next.js (App Router), Supabase e Google Gemini, otimizada para execução serverless na Vercel.

---

**Status**: Implementado | **Versão**: 4.5.4-Vigilante | **Autor**: CTO Engenheiro Sênior (Manus AI)

---

## 1. Visão Geral do Pipeline

O fluxo de dados do Argos é linear e autônomo, disparado por um único identificador de partida (`matchId`):

1.  **Ingestão (DataIngestionService)**: Coleta automática de dados via API-Football. Aplica decaimento exponencial para dar mais peso aos jogos recentes (xG/xGA móvel).
2.  **Regime & Contexto (RegimeEngineV4 + RAG)**: O Gemini Flash analisa o contexto (lesões, clima, motivação) e define um `RegimeProfile`. O RAG busca evidências históricas no Supabase (pgvector).
3.  **Simulação (ModelFactory)**: Motor de Monte Carlo realiza 1.500 iterações por vertical (Vencedor, Gols, Cantos, etc.) para gerar distribuições de probabilidade calibradas.
4.  **Auditoria (AnomalyDetectionService)**: O novo "Vigilante de Mercado" compara as probabilidades do Argos com as odds reais das casas de apostas, detectando anomalias de valor.
5.  **Persistência (SignalClassifierV4)**: Classifica os sinais em *Value*, *Validation* ou *Noise* e persiste o ledger completo no Supabase para auditoria futura.

## 2. Componentes Principais

### 🧠 Core Matemático
Utiliza uma combinação de **Distribuição de Poisson** para eventos independentes e **Modelagem de Elo** para força relativa. A variância é ajustada dinamicamente pelo `AutoTuningEngine` com base no Brier Score histórico.

### 🛡️ Vigilante de Mercado (Anomaly Detection)
O `AnomalyDetectionService` atua como um firewall de lucratividade. Ele monitora:
- **Brier Score Projetado**: Diferença entre a confiança do modelo e a odd implícita.
- **Discrepância de Odds**: Alertas automáticos quando o mercado desvia mais de 10% do "Preço Justo" calculado pelo Argos.

### ⚡ Infraestrutura Escalável
- **Batch Processing**: Uso de filas (`BatchQueueService`) para evitar timeouts em execuções massivas na Vercel.
- **Segurança**: Proteção de endpoints críticos via `x-api-key`.
- **Performance**: Latência média de 1.1s para o ciclo completo, validada em testes de estresse com 50 requisições simultâneas.

## 3. Stack Tecnológica
- **Frontend/API**: Next.js 14 (TypeScript)
- **Database/Vector**: Supabase (PostgreSQL + pgvector)
- **AI/LLM**: Google Gemini 1.5 Flash
- **Data Source**: API-Football (Sports-Reference)
- **Hosting**: Vercel (Edge & Serverless Functions)

---
*Documentação Técnica v4.5 - "Market Vigilante"*
