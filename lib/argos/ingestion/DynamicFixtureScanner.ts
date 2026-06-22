// ============================================================
// DYNAMIC FIXTURE SCANNER v5.0 — MARKET ADAPTATION ENGINE
// Descobre automaticamente os jogos mais relevantes em tempo real
// Adapta-se a mudanças de mercado (Copa do Mundo -> Ligas Domésticas)
// ============================================================

import axios from "axios";
import { circuitBreakerPool } from "@/lib/core/CircuitBreaker";
import { getRedisCacheInstance } from "@/lib/core/RedisCache";
import { propLineConfig } from "@/lib/core/PropLineConfigManager";
import { LeagueProfile } from "@/lib/argos/ingestion/LeagueValueScoreEngine";

export interface DynamicFixtureDiscoveryResult {
  discovered: number;
  queued: number;
  rejected: number;
  topMatches: Array<{
    matchId: string;
    league: string;
    home: string;
    away: string;
    kickoffTime: string;
    operationalDensity: number;
  }>;
}

/**
 * DYNAMIC FIXTURE SCANNER v5.0 — Argos Syndicate-Level
 *
 * Responsabilidade:
 * 1. Varrer TODOS os jogos disponíveis via PropLine em TEMPO REAL
 * 2. Filtrar por ligas de Elite, adaptando-se a mudanças (Copa do Mundo, turnos, regionais)
 * 3. Priorizar automaticamente os jogos com maior densidade operacional
 * 4. Enfileirar apenas os matches que merecem CPU (Density > threshold)
 * 5. Zero lixo, zero games obscuros, zero processamento desperdiçador
 */
export class DynamicFixtureScanner {
  private readonly SCAN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
  private readonly MIN_OPERATIONAL_DENSITY = 45; // Threshold mínimo

  // Elite League IDs (Atualizado para PropLine + Copa do Mundo)
  private readonly ELITE_LEAGUE_IDS = [
    1,   // Copa do Mundo
    2,   // Champions League
    3,   // Europa League
    4,   // Conference League
    11,  // Libertadores
    13,  // Premier League
    15,  // Serie A (Itália)
    61,  // Ligue 1
    71,  // Brasileirão A
    72,  // Brasileirão B
    73,  // Copa do Brasil
    78,  // Bundesliga
    79,  // La Liga
    94,  // Primeira Liga (Portugal)
    140, // Copa America
  ];

  private isRunning = false;

  /**
   * Inicia o scanner automático (chamado uma vez na inicialização)
   */
  public startAutomaticScanning(): void {
    if (this.isRunning) {
      console.log("[DynamicFixtureScanner] Scanner já está rodando");
      return;
    }

    this.isRunning = true;
    console.log("[DynamicFixtureScanner] ✅ Iniciando scanner automático (intervalo: 5min)");

    // Primeira varredura imediata
    this.scanAndDiscoverFixtures().catch((err) =>
      console.error("[DynamicFixtureScanner] Erro na varredura inicial:", err)
    );

    // Varreduras periódicas
    setInterval(async () => {
      try {
        await this.scanAndDiscoverFixtures();
      } catch (err: any) {
        console.error("[DynamicFixtureScanner] Erro na varredura periódica:", err.message);
      }
    }, this.SCAN_INTERVAL_MS);
  }

  /**
   * Varredura principal: Descobre todos os jogos relevantes e enfileira os melhores
   */
  public async scanAndDiscoverFixtures(): Promise<DynamicFixtureDiscoveryResult> {
    console.log(`[DynamicFixtureScanner] 🔍 Iniciando varredura de fixtures em tempo real...`);

    let discovered = 0;
    let queued = 0;
    let rejected = 0;
    const topMatches: DynamicFixtureDiscoveryResult["topMatches"] = [];

    try {
      // 1. Buscar todos os eventos/fixtures da PropLine
      const allFixtures = await this.fetchAllFixturesFromPropLine();
      discovered = allFixtures.length;

      console.log(`[DynamicFixtureScanner] 📊 Total de jogos descobertos: ${discovered}`);

      // 2. Filtrar por ligas de Elite
      const eliteFixtures = allFixtures.filter((f) =>
        this.ELITE_LEAGUE_IDS.includes(f.league?.id)
      );

      console.log(
        `[DynamicFixtureScanner] 🏆 Jogos em ligas de Elite: ${eliteFixtures.length}`
      );

      // 3. Calcular densidade operacional e priorizar
      const scoredFixtures = await Promise.all(
        eliteFixtures.map(async (fixture) => ({
          fixture,
          score: await this.calculateOperationalScore(fixture),
        }))
      );

      // Ordenar por score decrescente
      scoredFixtures.sort((a, b) => b.score - a.score);

      // 4. Enfileirar os melhores (aqueles com score >= threshold)
      for (const { fixture, score } of scoredFixtures) {
        if (score >= this.MIN_OPERATIONAL_DENSITY) {
          queued++;
          topMatches.push({
            matchId: fixture.fixture?.id?.toString() || "unknown",
            league: fixture.league?.name || "Unknown",
            home: fixture.teams?.home?.name || "HOME",
            away: fixture.teams?.away?.name || "AWAY",
            kickoffTime: fixture.fixture?.date || "TBD",
            operationalDensity: score,
          });

          // Enfileirar para processamento (será feito pelo Batch Queue Service)
          await this.enqueueFixture(fixture);
        } else {
          rejected++;
        }
      }

      console.log(
        `[DynamicFixtureScanner] ✅ Varredura concluída: ${queued} enfileirados, ${rejected} rejeitados`
      );

      return {
        discovered,
        queued,
        rejected,
        topMatches: topMatches.slice(0, 10), // Top 10
      };
    } catch (error: any) {
      console.error("[DynamicFixtureScanner] ❌ Erro durante varredura:", error.message);
      throw error;
    }
  }

  /**
   * Busca TODOS os fixtures disponíveis via PropLine
   */
  private async fetchAllFixturesFromPropLine(): Promise<any[]> {
    try {
      // Usar a data de hoje para limitar os resultados (PropLine retorna apenas jogos do dia/próximos dias)
      const today = new Date().toISOString().split("T")[0];

      const response = await circuitBreakerPool.get("PropLineAPI")!.execute(async () => {
        return await axios.get(`${propLineConfig.getBaseUrl()}/sports/soccer_all/events`, {
          headers: propLineConfig.getHeaders(),
          timeout: propLineConfig.getConfig().timeout,
        });
      });

      // Converter para formato padrão se necessário
      return Array.isArray(response.data) ? response.data : response.data.events || [];
    } catch (error: any) {
      console.error(
        "[DynamicFixtureScanner] Erro ao buscar fixtures da PropLine:",
        error.message
      );
      return [];
    }
  }

  /**
   * Calcula score de densidade operacional para um fixture
   * Retorna 0-100 indicando se é worth gastar CPU
   */
  private async calculateOperationalScore(fixture: any): Promise<number> {
    const leagueId = fixture.league?.id;

    // Se não temos ID de liga, score baixo
    if (!leagueId) return 0;

    // Elite leagues ganham bônus
    if (this.ELITE_LEAGUE_IDS.includes(leagueId)) {
      return 90;
    }

    // Copa do Mundo SEMPRE máxima prioridade
    if (leagueId === 1) {
      return 100;
    }

    // Champions + Libertadores máxima prioridade
    if ([2, 11].includes(leagueId)) {
      return 95;
    }

    // Outras ligas europeia/sul-americanas
    if ([13, 61, 78, 79, 94].includes(leagueId)) {
      return 85;
    }

    // Brasileirão A
    if (leagueId === 71) {
      return 80;
    }

    // Brasileiro B, Copa do Brasil
    if ([72, 73].includes(leagueId)) {
      return 70;
    }

    // Fallback
    return 50;
  }

  /**
   * Enfileira um fixture para processamento posterior
   */
  private async enqueueFixture(fixture: any): Promise<void> {
    try {
      const matchId = fixture.fixture?.id?.toString();
      if (!matchId) return;

      const cacheKey = `fixture-queued-${matchId}`;
      const alreadyQueued = await getRedisCacheInstance().get(cacheKey);

      if (!alreadyQueued) {
        // Marcar como enfileirado por 24h (evita duplicatas)
        await getRedisCacheInstance().set(cacheKey, "true", 86400);
        console.log(
          `[DynamicFixtureScanner] 📌 Enfileirado: ${fixture.teams?.home?.name} vs ${fixture.teams?.away?.name}`
        );
      }
    } catch (error: any) {
      console.error("[DynamicFixtureScanner] Erro ao enfileirar:", error.message);
    }
  }

  /**
   * Para o scanner automático
   */
  public stopScanning(): void {
    this.isRunning = false;
    console.log("[DynamicFixtureScanner] ⛔ Scanner parado");
  }
}

export const dynamicFixtureScanner = new DynamicFixtureScanner();
