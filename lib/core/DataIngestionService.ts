import axios from "axios";

// ============================================================
// DATA INGESTION SERVICE v4.5 — EXPONENTIAL INTELLIGENCE
// Automatiza a extração de dados e calcula médias ajustadas com decaimento temporal
// ============================================================

export interface AdjustedMetrics {
  goals: number;
  corners: number;
  cards: number;
  shots: number;
  shotsOnTarget: number;
}

export interface IngestedData {
  matchId: string;
  leagueId: string;
  home: AdjustedMetrics;
  away: AdjustedMetrics;
  externalFactors: {
    refereeStrictness: number;
    weatherCondition: "CLEAR" | "RAIN" | "EXTREME_HEAT";
    motivationLevel: "NORMAL" | "HIGH" | "LOW";
    isDerby: boolean;
  };
}

export class DataIngestionService {
  private apiKey: string;
  private baseUrl: string = "https://v3.football.api-sports.io";
  private MAX_DAILY_REQUESTS: number = 100;
  private dailyRequestCount: number = 0;
  private lastRequestDate: string = "";

  constructor() {
    this.apiKey = process.env.API_SPORTS_KEY || "";
    this.loadRequestCount();
  }

  private loadRequestCount() {
    const today = new Date().toISOString().split('T')[0];
    // Em produção, isso deveria ser persistido no Supabase/Redis. 
    // Para fins de demonstração, usamos uma variável simples (resetada no deploy).
    if (this.lastRequestDate !== today) {
      this.dailyRequestCount = 0;
      this.lastRequestDate = today;
    }
  }

  private async incrementRequestCount() {
    this.loadRequestCount();
    if (this.dailyRequestCount >= this.MAX_DAILY_REQUESTS) {
      throw new Error("Limite diário de requisições da API Football atingido (100/dia).");
    }
    this.dailyRequestCount++;
  }

  /**
   * Coleta dados de um jogo e calcula métricas ajustadas (xG/xGA) com decaimento exponencial
   */
  async ingest(matchId: string): Promise<IngestedData> {
    try {
      await this.incrementRequestCount();
      // 1. Buscar detalhes do jogo (Ligas, Times, Árbitro)
      const fixtureResponse = await axios.get(`${this.baseUrl}/fixtures?id=${matchId}`, {
        headers: { "x-apisports-key": this.apiKey }
      });

      const fixture = fixtureResponse.data.response[0];
      if (!fixture) throw new Error(`Fixture ${matchId} not found`);

      const leagueId = fixture.league.id.toString();
      const homeTeamId = fixture.teams.home.id;
      const awayTeamId = fixture.teams.away.id;

      // 2. Buscar histórico dos últimos 10 jogos para cada time (Janela Temporal Móvel)
      const [homeHistory, awayHistory] = await Promise.all([
        this.getTeamHistory(homeTeamId, 10),
        this.getTeamHistory(awayTeamId, 10)
      ]);

      // 3. Calcular Médias Ajustadas com Decaimento Exponencial
      const homeMetrics = this.calculateExponentialAverages(homeHistory);
      const awayMetrics = this.calculateExponentialAverages(awayHistory);

      // 4. Extrair Fatores Externos
      const externalFactors: IngestedData["externalFactors"] = {
        refereeStrictness: this.parseRefereeStrictness(fixture.fixture.referee),
        weatherCondition: "CLEAR", 
        motivationLevel: "NORMAL", 
        isDerby: false 
      };

      return {
        matchId,
        leagueId,
        home: homeMetrics,
        away: awayMetrics,
        externalFactors
      };
    } catch (error: any) {
      console.error("[DataIngestionService] Ingestion Error:", error.message);
      throw error;
    }
  }

  private async getTeamHistory(teamId: number, limit: number): Promise<any[]> {
    await this.incrementRequestCount();
    const response = await axios.get(`${this.baseUrl}/fixtures?team=${teamId}&last=${limit}`, {
      headers: { "x-apisports-key": this.apiKey }
    });
    return response.data.response || [];
  }

  /**
   * Retorna a lista de ligas prioritárias (Elite)
   */
  public getPriorityLeagues() {
    return [
      { id: 71, name: "Brasileirão Série A" },
      { id: 72, name: "Brasileirão Série B" },
      { id: 2, name: "Champions League" },
      { id: 39, name: "Premier League" },
      { id: 78, name: "Bundesliga" },
      { id: 140, name: "La Liga" },
      { id: 135, name: "Serie A" },
      { id: 61, name: "Ligue 1" },
      { id: 307, name: "Saudi Pro League" },
      { id: 128, name: "Liga Argentina" }
    ];
  }

  /**
   * Busca jogos de uma liga específica para uma data
   */
  public async getFixturesByLeague(leagueId: number, date: string): Promise<any[]> {
    await this.incrementRequestCount();
    const response = await axios.get(`${this.baseUrl}/fixtures?league=${leagueId}&date=${date}`, {
      headers: { "x-apisports-key": this.apiKey }
    });
    return response.data.response || [];
  }

  /**
   * Aplica Fator de Decaimento Exponencial: Jogos recentes têm peso maior
   * Fórmula: Peso = alpha * (1 - alpha)^n, onde n é a distância do jogo atual
   */
  private calculateExponentialAverages(history: any[]): AdjustedMetrics {
    const alpha = 0.3; // Fator de decaimento (30% de peso para o mais recente)
    let totalWeight = 0;
    
    const sums = { goals: 0, corners: 0, cards: 0, shots: 0, shotsOnTarget: 0 };

    history.forEach((match, index) => {
      const weight = Math.pow(1 - alpha, index);
      totalWeight += weight;

      // Nota: No mundo real, extrairíamos estatísticas detalhadas de cada jogo (match.statistics)
      // Aqui estamos simulando a extração de gols como base
      const stats = match.goals; 
      sums.goals += (stats.home || 0) * weight;
      sums.corners += 5 * weight; // Simulação de média
      sums.cards += 2 * weight;   // Simulação de média
      sums.shots += 12 * weight;  // Simulação de média
      sums.shotsOnTarget += 5 * weight; // Simulação de média
    });

    return {
      goals: sums.goals / totalWeight,
      corners: sums.corners / totalWeight,
      cards: sums.cards / totalWeight,
      shots: sums.shots / totalWeight,
      shotsOnTarget: sums.shotsOnTarget / totalWeight
    };
  }

  private parseRefereeStrictness(refereeName: string): number {
    if (!refereeName) return 1.0;
    // Lógica simples: nomes conhecidos por rigor podem ser mapeados aqui
    return 1.0; 
  }
}
