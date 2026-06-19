# Relatório de Engenharia de Produção — Argos Intelligence Engine v5.0

## 1. Visão Geral da Refatoração
O Argos foi transformado de um analisador de partidas baseado em ligas fixas para um **Market Opportunity Engine** adaptativo. A arquitetura agora foca em **Densidade Operacional** e **Exaustão de Mercados**, garantindo que nenhuma oportunidade estatística real seja descartada por limitações de curadoria.

## 2. Alterações Realizadas e Motivações Técnicas

| Componente | Alteração Realizada | Motivo Técnico / Regra de Negócio |
| :--- | :--- | :--- |
| **LeagueValueScoreEngine** | Implementação de score determinístico (0-100) com pesos exatos: Quality (20%), Data (25%), Market (20%), Importance (15%), Window (10%), Stability (10%). | Garantir que o motor decida onde gastar CPU com base em viabilidade operacional, não em previsões de EV. |
| **DataIngestionService** | Implementação de **Dynamic League Profiling**. Removido `getPriorityLeagues()` como filtro. | Permitir que o Argos migre automaticamente entre competições sem intervenção manual (ex: fim da Série B, início da Champions). |
| **DataIngestionService** | Regra de **Confidence Score (0.35)** para ligas desconhecidas ou sem dados. | Obedecer à regra fundamental de "não fingir informação" e evitar falsos positivos em ligas sem cobertura. |
| **DailyIngestionScheduler** | Implementação da **Opportunity Priority Queue** com `priorityReason`. | Priorizar jogos com maior densidade operacional na fila de processamento. |
| **DailyIngestionScheduler** | Mudança para **MATCH_ANALYSIS_JOB**. | O sistema agora analisa todas as verticais (Multimercado) antes de descartar uma partida. |
| **ModelFactory (Monte Carlo)** | Remoção do ajuste de `expectedEdge` nas médias de gols. | O Monte Carlo agora gera probabilidades matemáticas puras. O EV é um output da comparação com as odds de mercado. |
| **SignalClassifierV4** | Separação lógica entre **FREE** (Assertividade/Marketing) e **VIP** (Profundidade/EV+). | Unificar o cérebro matemático, diferenciando apenas a camada de entrega para os canais de Telegram. |

## 3. Garantias de Integridade
- **Componentes Intactos**: O Cron, Orchestrator, Telegram Dispatcher, Supabase Schema e estruturação do BatchQueueService foram preservados integralmente.
- **Build Vercel**: Executado `npm run build` com sucesso. Todas as dependências e tipos TypeScript foram validados.
- **Isolamento**: As mudanças foram restritas aos núcleos de lógica e curadoria, mantendo a estabilidade do sistema em produção.

## 4. Novo Fluxo de Processamento
1.  **API Football**: Coleta de fixtures futuros (45min a 48h).
2.  **Pre-Filter**: Remoção imediata de jogos inválidos ou sem tempo hábil.
3.  **LeagueValueScore**: Avaliação da densidade operacional (Vale a CPU?).
4.  **Opportunity Queue**: Enfileiramento por ranking de oportunidade.
5.  **Multimarket Analysis**: Exaustão de todas as verticais (Gols, Cantos, Cartões, etc.).
6.  **Monte Carlo**: Simulação de 10.000 iterações por mercado para probabilidade pura.
7.  **Financial Layer**: Cálculo de EV+ real contra odds de mercado.
8.  **Delivery Layer**: Classificação e despacho para canais Free e VIP.

---
**Status Final: PRODUÇÃO OK | BUILD SUCESSO | REPOSITÓRIO ATUALIZADO**
