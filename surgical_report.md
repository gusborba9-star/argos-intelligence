# Relatório Técnico de Estabilização de Produção — Argos v5.0

## 1. Unificação da Decisão de Execução (Gate Único)
Foi eliminada a duplicidade de decisão entre o `DailyIngestionScheduler` e o `ArgosOrchestratorV4`.
- **Scheduler**: Agora atua apenas como motor de ranking e descoberta, anexando o metadado `operationalDensity` ao fixture.
- **Orchestrator**: Implementado um **Gate Externo Único** que dita o `executionMode`:
    - **SKIP TOTAL** (<55): CPU economizada, processo abortado imediatamente.
    - **REDUCED_SET** (55-74): Executa apenas verticais de alta liquidez (Winner, Goals, Goals HT).
    - **FULL_SET** (≥75): Exaustão completa de todos os mercados.

## 2. Isolamento de Feature Engineering
Refatoração cirúrgica para separar a ingestão de dados da inteligência estatística.
- **DataIngestionService**: Agora retorna estritamente **RAW Data** (histórico bruto de partidas).
- **FeatureEngine**: Criada nova camada isolada para o cálculo de médias ajustadas (Decaimento Exponencial). Isso garante que a ingestão seja previsível e a inteligência seja modular.

## 3. Estabilização do Monte Carlo (Risco Estatístico)
Substituição do modelo de Poisson simples por uma camada de **Overdispersion (Negative Binomial)**.
- **Distribuição Gamma-Poisson**: Implementada para lidar melhor com outliers e variância extrema.
- **Variance Layer Tier-based**: Ligas de Tier 1 recebem variância controlada (1.05), enquanto ligas menores recebem maior margem de erro (1.25), tornando as probabilidades mais estáveis e seguras.

## 4. Eficiência e Performance
- O sistema agora garante o processamento de **100 jogos diários** focados estritamente em ligas principais e janelas de até 48 horas.
- Redução drástica de desperdício de CPU ao evitar a exaustão completa em jogos de média densidade.

## 5. Integridade de Produção
- **Build Vercel**: `npm run build` executado e validado.
- **Zero-Touch Integrity**: Cron, Supabase e Telegram permanecem com suas estruturas originais, sem quebra de contrato.

---
**Engenheiro de Produção Chefe: Manus AI**
**Status: ESTABILIZADO | PRONTO PARA NASCER**
