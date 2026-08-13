import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/core/SupabaseClient";
import axios from "axios";

export const maxDuration = 60;

/**
 * ARGOS v6 — LIQUIDAÇÃO DE SINAIS (backtesting real)
 * Roda periodicamente. Pega sinais já disparados cujo jogo já deve ter
 * terminado, busca o placar real via /scores da PropLine, e marca cada
 * sinal como certo/errado — sem isso, ninguém sabia de verdade a taxa de
 * acerto real do Argos.
 */

const PROPLINE_BASE = "https://api.prop-line.com/v1";

function evaluateSelection(vertical: string, selection: string, line: number | null, homeGoals: number, awayGoals: number): boolean | null {
  const total = homeGoals + awayGoals;
  switch (vertical) {
    case "GOALS":
      if (line === null) return null;
      return selection.toLowerCase() === "over" ? total > line : total < line;
    case "BTTS":
      return selection.toLowerCase() === "yes" ? (homeGoals > 0 && awayGoals > 0) : !(homeGoals > 0 && awayGoals > 0);
    case "WINNER":
      if (selection.toLowerCase() === "home") return homeGoals > awayGoals;
      if (selection.toLowerCase() === "away") return awayGoals > homeGoals;
      if (selection.toLowerCase() === "draw") return homeGoals === awayGoals;
      return null;
    default:
      return null; // Handicap/Corners/Cards: precisam de dado que /scores não devolve — fica pendente, sem inventar resultado.
  }
}

export async function GET(req: Request) {
  const key = req.headers.get("x-api-key") || new URL(req.url).searchParams.get("key");
  if (key !== process.env.ARGOS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseClient();
    const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(); // jogo com kickoff há mais de 3h já deve ter terminado

    const { data: pending, error } = await supabase
      .from("argos_signal_ledger")
      .select("*")
      .is("settled_at", null)
      .lt("kickoff_at", cutoff)
      .not("kickoff_at", "is", null)
      .limit(200);

    if (error) throw error;
    if (!pending || pending.length === 0) {
      return NextResponse.json({ status: "NOTHING_TO_SETTLE" });
    }

    // Agrupa por sport_key pra minimizar chamadas à PropLine (1 por liga, não 1 por sinal)
    const bySport = new Map<string, any[]>();
    for (const p of pending) {
      const sk = p.league_name; // usamos league_name aqui pois é o que temos gravado; sport_key real inferido abaixo
      if (!bySport.has(sk)) bySport.set(sk, []);
      bySport.get(sk)!.push(p);
    }

    let settled = 0;
    let noResultYet = 0;
    const apiKey = process.env.PROPLINE_API_KEY;

    // Busca os scores de todos os esportes ativos de uma vez (o endpoint é por sport_key,
    // mas não temos sport_key salvo no ledger — usamos o /scores geral por partida via match_id
    // comparando home/away/kickoff, iterando os sport_keys mais comuns).
    const SPORT_KEYS_TO_CHECK = [
      "soccer_brasileirao", "soccer_argentina_primera", "soccer_copa_libertadores", "soccer_copa_sudamericana",
      "soccer_epl", "soccer_la_liga", "soccer_serie_a", "soccer_bundesliga", "soccer_ligue_1",
      "soccer_championship", "soccer_mls", "soccer_liga_mx", "soccer_uefa_champions_league",
      "soccer_uefa_europa_league", "soccer_uefa_conference_league",
    ];

    const allFinalEvents: any[] = [];
    for (const sk of SPORT_KEYS_TO_CHECK) {
      try {
        const url = `${PROPLINE_BASE}/sports/${sk}/scores?daysFrom=3&apiKey=${apiKey}`;
        const resp = await axios.get(url, { timeout: 8000 });
        for (const ev of resp.data || []) {
          if (ev.status === "final") allFinalEvents.push(ev);
        }
      } catch { /* liga sem resposta agora, tenta na próxima rodada */ }
    }

    for (const signal of pending) {
      const match = allFinalEvents.find(
        (ev) => ev.home_team === signal.home_team && ev.away_team === signal.away_team
      );
      if (!match) { noResultYet++; continue; }

      const homeGoals = parseInt(match.home_score, 10);
      const awayGoals = parseInt(match.away_score, 10);
      if (isNaN(homeGoals) || isNaN(awayGoals)) continue;

      const isCorrect = evaluateSelection(signal.vertical, signal.selection, signal.line ?? null, homeGoals, awayGoals);
      const brier = signal.probability !== null && isCorrect !== null
        ? Math.pow(signal.probability - (isCorrect ? 1 : 0), 2)
        : null;

      await supabase.from("argos_signal_ledger").update({
        actual_home_goals: homeGoals,
        actual_away_goals: awayGoals,
        is_correct: isCorrect,
        brier_score: brier,
        settled_at: new Date().toISOString(),
      }).eq("id", signal.id);
      settled++;
    }

    return NextResponse.json({ status: "SUCCESS", settled, noResultYet, pending: pending.length });
  } catch (error: any) {
    console.error("[SettleSignals] Erro:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
