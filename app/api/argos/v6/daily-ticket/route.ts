import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/core/SupabaseClient";
import { telegramDispatcher } from "@/lib/argos/notifications/TelegramDispatcher";

export const maxDuration = 30;

/**
 * ARGOS v6 — BILHETE DO DIA
 * Roda 1x por dia (manhã). Dois bilhetes DIFERENTES, um por canal:
 *  - FREE: odd combinada menor (2.00–5.00), só probabilidade alta, sem
 *    exigir EV+ (mesma filosofia do canal free normal).
 *  - VIP: odd combinada maior (5.00–15.00), só pernas com EV+ real.
 * Nunca usa sinal fraco só pra "encher" a odd — se não achar pernas
 * suficientes de verdade, não manda bilhete naquele dia.
 */

function buildTicket(candidates: any[], minOdd: number, maxOdd: number) {
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
    if (projectedOdd > maxOdd) continue;
    legs.push(c);
    combinedOdd = projectedOdd;
    combinedProb *= c.probability;
    if (combinedOdd >= minOdd) break;
  }

  if (legs.length < 2 || combinedOdd < minOdd) return null;
  return { legs, combinedOdd, combinedProb };
}

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
    const ticketDate = todayStart.toISOString().split("T")[0];

    const { data: allSignals, error } = await supabase
      .from("argos_signal_ledger")
      .select("*")
      .gte("kickoff_at", new Date().toISOString())
      .lt("kickoff_at", todayEnd.toISOString())
      .gte("created_at", todayStart.toISOString())
      .order("probability", { ascending: false });

    if (error) throw error;
    if (!allSignals || allSignals.length === 0) {
      return NextResponse.json({ status: "NO_SIGNALS" });
    }

    const results: any = {};

    // VIP: só EV+ real, odd combinada 5.00–15.00
    const vipCandidates = allSignals.filter((s: any) => s.tier === "VIP");
    const vipTicket = buildTicket(vipCandidates, 5.0, 15.0);
    if (vipTicket) {
      await supabase.from("argos_daily_ticket").upsert({
        ticket_date: ticketDate, tier: "VIP", legs: vipTicket.legs,
        combined_odd: vipTicket.combinedOdd, combined_probability: vipTicket.combinedProb,
      }, { onConflict: "ticket_date,tier" });
      await telegramDispatcher.dispatchDailyTicket(vipTicket.legs, vipTicket.combinedOdd, vipTicket.combinedProb, "VIP");
      results.vip = { legs: vipTicket.legs.length, odd: vipTicket.combinedOdd };
    }

    // FREE: qualquer sinal de alta probabilidade (>=70%), com ou sem EV+,
    // odd combinada bem mais modesta (2.00–5.00) — vitrine de assertividade.
    const freeCandidates = allSignals.filter((s: any) => s.probability >= 0.70);
    const freeTicket = buildTicket(freeCandidates, 2.0, 5.0);
    if (freeTicket) {
      await supabase.from("argos_daily_ticket").upsert({
        ticket_date: ticketDate, tier: "FREE", legs: freeTicket.legs,
        combined_odd: freeTicket.combinedOdd, combined_probability: freeTicket.combinedProb,
      }, { onConflict: "ticket_date,tier" });
      await telegramDispatcher.dispatchDailyTicket(freeTicket.legs, freeTicket.combinedOdd, freeTicket.combinedProb, "FREE");
      results.free = { legs: freeTicket.legs.length, odd: freeTicket.combinedOdd };
    }

    if (!vipTicket && !freeTicket) {
      return NextResponse.json({ status: "INSUFFICIENT", message: "Sem pernas reais suficientes hoje pra nenhum dos dois bilhetes." });
    }

    return NextResponse.json({ status: "SUCCESS", ...results });
  } catch (error: any) {
    console.error("[DailyTicket] Erro:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
