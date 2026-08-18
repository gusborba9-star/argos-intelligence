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

## Current Quantitative Integrity Cycle — C-003

### Status: IN PROGRESS

### Findings confirmed
- [x] `ModelFactory` atual usa RNG não determinístico via `Math.random()`.
- [x] A geração Gamma atual é uma aproximação aditiva e não uma amostragem Gamma estatisticamente adequada.
- [x] O Monte Carlo atual mistura dispersão de forma genérica com o parâmetro de gols.
- [x] Handicap perde informação de sinal ao armazenar contagens por `Math.abs(point)`.
- [x] Probabilidade bruta, calibração e referência de mercado precisam permanecer semanticamente separadas.

### Execution boundary
O núcleo preditivo será tratado como componente estatístico independente, auditável e reproduzível. Não será considerado concluído apenas porque o build passa.

### Required implementation
- [ ] RNG determinístico com seed e replay.
- [ ] Distribuições estatísticas explícitas e testáveis.
- [ ] Poisson/Skellam para modelagem de gols quando as hipóteses forem válidas.
- [ ] Distribuição conjunta do placar.
- [ ] Monte Carlo reproduzível sobre parâmetros versionados.
- [ ] Contrato de handicap preservando `side` + `point` assinados.
- [ ] Snapshot de features e provenance da fonte.
- [ ] Metadados de modelo/feature version.
- [ ] Testes de invariantes probabilísticos.

### Not Yet Done
- [ ] C-003 não concluído.
- [ ] Nenhum claim de assertividade será tratado como comprovado.
- [ ] Adaptadores PropLine/API-Football permanecem fora deste ciclo até auditoria específica dos contratos.

## Next Cycles

### C-004 — Probability Calibration
- Calibração por liga/mercado.
- Brier score, log loss e reliability curves.
- Shrinkage por tamanho de amostra.
- Separação entre probabilidade bruta, calibrada e publicada.

### C-005 — Market Microstructure / Benchmarking
- Consenso multi-book.
- Movimento de preço.
- Divergência entre fontes.
- Registro de snapshots para avaliação retrospectiva.
- Detecção de stale data.

### C-006 — Historical Learning Loop
- Registro de previsão + snapshot + resultado oficial.
- Atualização incremental por time/liga/mercado.
- Feedback somente após o evento.
- Proteção contra leakage.
- Versionamento de modelos.

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
