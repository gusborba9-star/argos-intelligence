# Argos Intelligence — CTO Progress Ledger

> **Fonte operacional de progresso.** Este arquivo registra ciclos executados, validações e decisões do CTO. O código só é considerado concluído após deployment **Ready**.

## Operating Doctrine

- **Prediction Integrity:** toda probabilidade deve representar uma estimativa estatística do evento e possuir método, versão, dados e janela temporal rastreáveis.
- **Independent Probability:** probabilidade do modelo nunca pode ser substituída silenciosamente por uma referência de mercado.
- **Market as Evidence:** preços de mercado podem ser usados como feature/benchmark, mas não são ground truth do modelo.
- **Temporal Integrity:** nenhum dado futuro pode contaminar uma previsão pré-jogo.
- **Provenance:** cada previsão deve permitir reconstruir dados, versão do motor, features, seed, simulação e transformação de calibração.
- **Deterministic Replay:** uma previsão histórica deve poder ser reproduzida com o mesmo snapshot e seed.
- **Calibration Before Claims:** assertividade só pode ser alegada depois de validação out-of-sample por Brier, Log Loss e reliability analysis.
- **Adaptive Precision:** o objetivo é maximizar qualidade preditiva quando houver evidência e medir explicitamente incerteza, desacordo e condições de baixa confiabilidade; incerteza não deve ser convertida artificialmente em confiança.
- **API Contract Protection:** alterações em PropLine/API-Football exigem preservação explícita dos contratos de request/response e respeito às quotas antes de qualquer refatoração.
- **Validation Gate:** ciclo = analisar → implementar → testar/build → deployment Ready → registrar progresso.

## Completed Cycles

### C-001 — Blueprint Foundation
- [x] Blueprint/roadmap definidos como fonte estrutural de verdade.
- [x] Execução por ciclos, não por correções isoladas.

### C-002 — Type/Build Integrity: Handicap
- [x] Corrigido contrato de seleção de handicap em `ArgosMasterOrchestrator`.
- [x] Introduzido discriminador `kind` para separar seleção padrão de handicap.
- [x] Preservados `side` e `point` para settlement asiático.
- [x] Deployment `fe818bd` validado como **Ready**.

### C-003 — Fair Price / EV Integrity — ✓ CONCLUÍDO
- [x] Separados `modelProbability`, `marketConsensusProbability` e `fairProbability`.
- [x] Removida semântica de `confidence` como substituta de probabilidade.
- [x] Preservada a direção matemática de `realValue`.
- [x] Evidência de mercado separada semanticamente do resultado do modelo.
- [x] Contrato de handicap `point`, `side`, linha e settlement preservado.
- [x] Invariantes quantitativos para EV, fair odds, probability e Kelly adicionados.
- [x] Provenance/replay estrutural reforçado.
- [x] `ArgosMasterOrchestrator` alinhado ao contrato canônico de evidência de mercado.
- [x] Deployment `0f17362` validado como **Ready**.

## Current Quantitative Integrity Cycle — C-004

### Status: IN PROGRESS — CALIBRATION + ASSERTIVENESS OBSERVABILITY

### Objective
Maximizar assertividade mensurável sem permitir inflação probabilística. O Argos deverá produzir simultaneamente uma estimativa probabilística e uma leitura objetiva de **quando essa estimativa merece maior confiança estatística e quando a incerteza é elevada**.

### Current baseline already present
- [x] Observações binárias com contrato `0 | 1`.
- [x] Separação temporal treino/validação.
- [x] Amostra mínima de treino e validação.
- [x] Fit logístico de calibração.
- [x] Limites conservadores para transformação de calibração.
- [x] Promoção condicionada ao desempenho Brier out-of-sample.

### Required implementation
- [ ] Separação explícita `rawProbability → calibratedProbability → publishedProbability` em toda a cadeia.
- [ ] Calibração específica por liga.
- [ ] Calibração específica por vertical/mercado.
- [ ] Brier Score e Log Loss como métricas de promoção.
- [ ] Reliability analysis por faixa de probabilidade.
- [ ] Shrinkage condicionado ao tamanho efetivo e à qualidade da amostra.
- [ ] Validação temporal/out-of-sample obrigatória.
- [ ] Medição de incerteza e desacordo entre modelos sem convertê-los em probabilidade artificial.
- [ ] Gate para impedir publicação de precisão falsa quando a evidência estatística for insuficiente.
- [ ] Métricas de assertividade separadas de valor de mercado.
- [ ] Testes de invariantes para garantir monotonicidade, limites [0,1] e estabilidade da calibração.

### Definition of Done C-004
1. implementação integral da cadeia de calibração;
2. testes/invariantes quantitativos;
3. build/deployment;
4. deployment **Ready**;
5. replay de casos anteriormente inflados;
6. atualização deste ledger e do roadmap com `✓`;
7. nenhum mecanismo de calibração pode aumentar probabilidade apenas para produzir mais sinais.

## Next Cycles

### C-005 — Market Microstructure / Benchmarking
- Consenso multi-book.
- Movimento de preço.
- Divergência entre fontes.
- Registro de snapshots para avaliação retrospectiva.
- Detecção de stale data.
- CLV observado após fechamento.

### C-006 — Historical Learning Loop
- Registro de previsão + snapshot + resultado oficial.
- Atualização incremental por time/liga/mercado.
- Feedback somente após o evento.
- Proteção contra leakage.
- Versionamento de modelos.
- Drift monitoring.

### C-007 — Model Ensemble
- Poisson/Skellam para gols.
- Monte Carlo para distribuição conjunta.
- Modelos específicos para eventos com dados suficientes.
- Ensemble ponderado por performance out-of-sample.
- RAG/IA exclusivamente para contexto externo e interpretação; probabilidades permanecem quantitativas.

### C-008 — Prediction Distribution & Audit
- Ranking por qualidade estatística.
- Idempotência.
- Provenance.
- Snapshot completo da previsão.
- Separação entre núcleo quantitativo e aplicações de distribuição.

### C-009 — API Efficiency
- PropLine como fonte primária onde coberta pelo contrato.
- API-Football como complemento seletivo.
- Budget accounting diário.
- Cache e deduplicação.
- Nenhuma alteração de contrato sem validação do fornecedor.

### C-010 — Production Quant Audit
- Replay determinístico.
- Backtest walk-forward.
- Paper ledger.
- Brier/Log Loss por mercado/liga.
- Stress tests.
- Drift detection.
- Champion/challenger.
- Só então considerar claims de assertividade.

## Definition of Done

Um ciclo só pode ser marcado como concluído quando:

1. implementação feita;
2. testes/invariantes executados;
3. build/deployment concluído;
4. deployment reportado como **Ready**;
5. progresso registrado aqui;
6. nenhuma regressão conhecida ficou pendente sem registro.
