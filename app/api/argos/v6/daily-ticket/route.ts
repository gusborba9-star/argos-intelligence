import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/core/SupabaseClient";
import { telegramDispatcher } from "@/lib/argos/notifications/TelegramDispatcher";

/**
 * ARGOS v6 — BILHETE DO DIA
 * Roda 1x por dia (manhã). Combina os sinais de MAIOR probabilidade do dia
 * (um por partida, sem repetir jogo) até atingir uma odd combinada entre
 * 5.00 e 15.00, maximizando a probabilidade conjunta.
 *
 * Só usa sinais que já passaram pelas travas de precisão do Orchestrator
 * (amostra real mínima, odd >= 1.35, EV+ pra VIP) — nunca monta o bilhete
 * com sinal fraco só pra "encher" a odd.
 */

const MIN_COMBINED_ODD = 5.0;
const MAX_COMBINED_ODD = 15.0;

export async function GET(req: Request) {
  const key = req.headers.get("x-api-key") || new URL(req.url).searchParams.get("key");
  if (key !== process.env.ARGOS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseClient();
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    // Só sinais VIP (EV+ real) de hoje, com jogo ainda não começado.
    const { data: candidates, error } = await supabase
      .from("argos_signal_ledger")
      .select("*")
      .eq("tier", "VIP")
      .gte("kickoff_at", new Date().toISOString())
      .lt("kickoff_at", todayEnd.toISOString())
      .gte("created_at", todayStart.toISOString())
      .order("probability", { ascending: false });

    if (error) throw error;
    if (!candidates || candidates.length === 0) {
      return NextResponse.json({ status: "NO_SIGNALS", message: "Sem sinais VIP suficientes hoje pra montar bilhete." });
    }

    // Um leg por partida — o de maior probabilidade daquele jogo.
    const seenMatches = new Set<string>();
    const perMatchBest = candidates.filter((c: any) => {
      if (seenMatches.has(c.match_id)) return false;
      seenMatches.add(c.match_id);
      return true;
    });

    const legs: any[] = [];
    let combinedOdd = 1;
    let combinedProb = 1;

    for (const c of perMatchBest) {
      if (!c.odd || c.odd < 1.01) continue;
      const projectedOdd = combinedOdd * c.odd;
      if (projectedOdd > MAX_COMBINED_ODD) continue; // estouraria o teto, pula esse leg
      legs.push(c);
      combinedOdd = projectedOdd;
      combinedProb *= c.probability;
      if (combinedOdd >= MIN_COMBINED_ODD) break; // já atingiu a faixa alvo
    }

    if (legs.length < 2 || combinedOdd < MIN_COMBINED_ODD) {
      return NextResponse.json({
        status: "INSUFFICIENT",
        message: `Não foi possível montar um bilhete dentro de 5.00–15.00 com sinais reais hoje (melhor combinação: ${combinedOdd.toFixed(2)}).`
      });
    }

    const ticketDate = todayStart.toISOString().split("T")[0];
    await supabase.from("argos_daily_ticket").upsert({
      ticket_date: ticketDate,
      tier: "VIP",
      legs,
      combined_odd: combinedOdd,
      combined_probability: combinedProb,
    }, { onConflict: "ticket_date,tier" });

    await telegramDispatcher.dispatchDailyTicket(legs, combinedOdd, combinedProb);

    return NextResponse.json({ status: "SUCCESS", legs: legs.length, combinedOdd, combinedProb });
  } catch (error: any) {
    console.error("[DailyTicket] Erro:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
