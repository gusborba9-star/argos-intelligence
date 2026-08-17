import axios from "axios";
import { getSupabaseClient } from "./SupabaseClient";
import { normalizeTeamName } from "./normalizeTeamName";

const BASE_URL = "https://v3.football.api-sports.io";

/**
 * ApiFootballService — integração com API-FOOTBALL (H2H, lesões, escalações).
 *
 * REGRA DE OURO: essa API tem só 100 requisições/dia no plano gratuito,
 * contra 1000/dia da PropLine. Cada chamada é preciosa. Por isso:
 *   1. Todo lookup de time é cacheado pra sempre (o ID de um time não muda).
 *   2. Todo H2H é cacheado por 7 dias (o confronto histórico não muda de
 *      um dia pro outro).
 *   3. Um orçamento diário próprio é checado ANTES de qualquer chamada —
 *      se estourar, a função retorna null sem gastar nada, nunca lança erro.
 *   4. Só deve ser chamada para partidas que JÁ são candidatas fortes de
 *      sinal (depois do Monte Carlo inicial) — nunca para os ~150-200
 *      jogos/dia que passam pela descoberta geral.
 */
export class ApiFootballService {
  private apiKey = process.env.API_FOOTBALL_KEY;
  private supabase = getSupabaseClient();

  private async hasBudget(): Promise<boolean> {
    const { data } = await this.supabase
      .from("argos_api_football_budget")
      .select("*")
      .eq("id", true)
      .maybeSingle();
    if (!data) return true; // sem registro ainda, deixa passar (será criado no consumo)

    // Reset diário
    if (new Date(data.reset_at) < new Date()) {
      await this.supabase
        .from("argos_api_football_budget")
        .update({ used: 0, reset_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() })
        .eq("id", true);
      return true;
    }
    return data.used < data.daily_limit;
  }

  private async consumeBudget(): Promise<void> {
    await this.supabase.rpc("increment_api_football_usage");
  }

  private async request(path: string, params: Record<string, any>): Promise<any | null> {
    if (!this.apiKey) return null;
    if (!(await this.hasBudget())) {
      console.warn(`[ApiFootball] ⏭️ Orçamento diário esgotado, pulando chamada a ${path}.`);
      return null;
    }
    try {
      const response = await axios.get(`${BASE_URL}${path}`, {
        params,
        headers: { "x-apisports-key": this.apiKey },
        timeout: 8000,
      });
      await this.consumeBudget();
      return response.data?.response ?? null;
    } catch (error: any) {
      console.error(`[ApiFootball] Erro em ${path}:`, error.message);
      return null;
    }
  }

  /**
   * Resolve o ID interno da API-FOOTBALL pro nome de um time — cacheado
   * pra sempre depois da primeira busca (o ID nunca muda).
   */
  public async getTeamId(teamName: string): Promise<number | null> {
    const canonical = normalizeTeamName(teamName);
    const { data: cached } = await this.supabase
      .from("argos_api_football_teams")
      .select("api_football_id")
      .eq("team_name_normalized", canonical)
      .maybeSingle();
    if (cached) return cached.api_football_id;

    const result = await this.request("/teams", { search: teamName });
    const teamId = result?.[0]?.team?.id ?? null;

    await this.supabase.from("argos_api_football_teams").upsert({
      team_name_normalized: canonical,
      api_football_id: teamId,
      api_football_name: result?.[0]?.team?.name ?? null,
      updated_at: new Date().toISOString(),
    });
    return teamId;
  }

  /**
   * Histórico de confrontos diretos entre 2 times — cacheado por 7 dias.
   * Retorna resumo agregado (não a lista bruta), pra ser fácil de usar
   * como ajuste de probabilidade.
   */
  public async getH2HSummary(homeTeamName: string, awayTeamName: string): Promise<{
    matchesPlayed: number; homeWins: number; draws: number; awayWins: number; avgTotalGoals: number;
  } | null> {
    const homeId = await this.getTeamId(homeTeamName);
    const awayId = await this.getTeamId(awayTeamName);
    if (!homeId || !awayId) return null;

    const [teamA, teamB] = homeId < awayId ? [homeId, awayId] : [awayId, homeId];
    const { data: cached } = await this.supabase
      .from("argos_h2h_cache")
      .select("data, fetched_at")
      .eq("team_a_id", teamA)
      .eq("team_b_id", teamB)
      .maybeSingle();

    if (cached && new Date(cached.fetched_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
      return cached.data;
    }

    const fixtures = await this.request("/fixtures/headtohead", { h2h: `${homeId}-${awayId}`, last: 10 });
    if (!fixtures || fixtures.length === 0) return null;

    let homeWins = 0, draws = 0, awayWins = 0, totalGoals = 0;
    for (const f of fixtures) {
      const hg = f.goals?.home ?? 0;
      const ag = f.goals?.away ?? 0;
      totalGoals += hg + ag;
      const fixtureHomeId = f.teams?.home?.id;
      if (hg === ag) draws++;
      else if ((hg > ag) === (fixtureHomeId === homeId)) homeWins++;
      else awayWins++;
    }

    const summary = {
      matchesPlayed: fixtures.length,
      homeWins, draws, awayWins,
      avgTotalGoals: totalGoals / fixtures.length,
    };

    await this.supabase.from("argos_h2h_cache").upsert({
      team_a_id: teamA, team_b_id: teamB, data: summary, fetched_at: new Date().toISOString(),
    });
    return summary;
  }
}

export const apiFootballService = new ApiFootballService();
