# 📚 Argos Intelligence v4.1: Guia de Uso Expandido

Este documento detalha as novas capacidades do motor Argos v4.1, que agora suporta uma gama mais ampla de mercados e integra fatores externos complexos para uma auditoria de mercado mais precisa.

---

## 🚀 Novas Verticais de Mercado

O Argos v4.1 expande sua capacidade de análise para além dos gols, incluindo agora:

*   **Escanteios (Corners)**: Análise da probabilidade de Over/Under escanteios, considerando o estilo de jogo das equipes (ataque vs. defesa) e o regime de mercado.
*   **Cartões (Cards)**: Previsão de Over/Under cartões, com forte influência da rigidez do árbitro e da intensidade do jogo (ex: Derby).
*   **Finalizações (Shots)**: Avaliação da tendência de finalizações a gol, refletindo a pressão ofensiva das equipes.

### Como Funciona a Modelagem (ModelFactory.ts)

O `ModelFactory` foi aprimorado para aplicar distribuições estatísticas apropriadas para cada vertical:

*   **Gols**: Continua utilizando a distribuição de Poisson, ajustada pelo `variance_multiplier` do `RegimeEngine`.
*   **Escanteios**: Utiliza uma variação da distribuição de Poisson, ponderando o poder de ataque e defesa das equipes, e a dispersão do regime.
*   **Cartões**: Similarmente, usa Poisson, mas com um peso significativo para a `refereeStrictness` e a agressividade das equipes.

**Exemplo de Uso no Orchestrator (Conceitual):**

```typescript
// Exemplo de como o Orchestrator pode interagir com o ModelFactory
const goalsSimulation = ModelFactory.runMonteCarlo({ homeMean: 1.5, awayMean: 1.0 }, regimeProfile, 1500, 'GOALS');
const cornersSimulation = ModelFactory.modelCorners(homeAttackPower, awayDefensePower, regimeProfile);
const cardsSimulation = ModelFactory.modelCards(homeAggression, awayAggression, externalFactors.refereeStrictness, regimeProfile);

// Em seguida, os resultados são passados para o SignalClassifier
const goalSignals = SignalClassifierV4.classify( /* ... */ );
const cornerSignals = SignalClassifierV4.classify( /* ... */ );
const cardSignals = SignalClassifierV4.classify( /* ... */ );
```

---

## 🌍 Integração de Fatores Externos (RegimeEngineV4.ts)

O `RegimeEngineV4` agora incorpora uma série de fatores externos para refinar a classificação do regime de mercado e ajustar os parâmetros do modelo:

| Fator Externo | Impacto no Regime/Modelo | Exemplo de Uso | Influência |
| :--- | :--- | :--- | :--- |
| **Árbitro (refereeStrictness)** | Ajusta a probabilidade de cartões e a variância em jogos intensos. | `refereeStrictness: 1.2` (árbitro rigoroso) | Aumenta a chance de cartões. |
| **Clima (weatherCondition)** | Modifica o `model_bias` (tendência de gols) e `variance_multiplier` (imprevisibilidade). | `weatherCondition: 'RAIN'` | Reduz gols, aumenta variância. |
| **Motivação (motivationLevel)** | Define o regime (DECISION, COMPRESSED) e ajusta o `model_bias` e `variance_multiplier`. | `motivationLevel: 'HIGH'` (final) | Regime DECISION, menor variância. |
| **Derby (isDerby)** | Pode levar ao regime DERBY, aumentando a variância e o `model_bias` para cartões/escanteios. | `isDerby: true` | Jogo mais intenso, mais cartões/escanteios. |
| **Context Evidence (RAG)** | Informações textuais (lesões, notícias, etc.) são processadas pelo Gemini para influenciar o regime. | "Jogador chave lesionado" | Pode levar a `COMPRESSED` ou `VOLATILE`. |

### Como os Fatores Externos São Usados

O `RegimeEngineV4` recebe um objeto `ExternalFactors` (que deve ser alimentado pelo seu sistema de coleta de dados) e o `context_evidence` do RAG. O Gemini Flash processa essas informações para gerar um `RegimeProfile` detalhado, que inclui:

*   `regime`: O estado de mercado detectado (NORMAL, VOLATILE, DECISION, etc.).
*   `model_bias`: Um ajuste fino nas médias de gols/eventos.
*   `variance_multiplier`: Um fator que aumenta ou diminui a dispersão das simulações de Monte Carlo, refletindo a imprevisibilidade do jogo.
*   `reasoning_tags`: Tags que explicam por que um determinado regime foi escolhido.

**Atenção**: O `RegimeEngine` **NÃO** altera as probabilidades base do motor matemático (Poisson/Elo). Ele apenas ajusta a **dispersão** da simulação de Monte Carlo e o **viés** do modelo, garantindo a pureza estatística do core.

---

## 🎯 Otimização para Assertividade e Lucratividade

Com a expansão para múltiplas verticais e a integração robusta de fatores externos, o Argos agora tem uma visão muito mais holística de cada evento. Isso permite:

*   **Detecção de Oportunidades Mais Ricas**: Não apenas gols, mas também cenários de escanteios ou cartões que o mercado pode estar subestimando.
*   **Sinais Mais Confiáveis**: O `RegimeEngine` e o `RAG Context Engine` garantem que cada sinal seja contextualizado, reduzindo o "ruído" e aumentando a confiança.
*   **Adaptação Dinâmica**: O motor se adapta à natureza do jogo (truncado, decisivo, morno) ajustando a dispersão e o viés, o que é crucial para a assertividade.

---

### 📝 Próximos Passos Sugeridos para o Uso:

1.  **Coleta de Dados de Fatores Externos**: Implemente a coleta de dados para `refereeStrictness`, `weatherCondition`, `motivationLevel` e `isDerby` para cada jogo.
2.  **Alimentação do RAG**: Continue a alimentar o `argos_context_facts` com informações relevantes para enriquecer o contexto do Gemini.
3.  **Testes e Validação**: Realize testes extensivos com dados históricos para validar a performance das novas verticais e a influência dos fatores externos.

Com estas melhorias, o Argos está ainda mais preparado para ser o seu Auditor de Mercado de alta precisão. 

---
*Autor: Manus AI (CTO Engenheiro Sênior de Software)*
*Versão: v4.1*
*Data: 09/06/2026*
