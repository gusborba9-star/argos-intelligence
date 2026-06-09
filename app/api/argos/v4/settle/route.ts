import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { FeedbackEngine } from '@/lib/core/FeedbackEngine';

// ============================================================
// SETTLE API ROUTE v4.0
// Liquidação de sinais e fechamento do Feedback Loop
// ============================================================

export async function POST(req: Request) {
  try {
    const { matchId, actualHomeGoals, actualAwayGoals } = await req.json();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Buscar a previsão original no Ledger
    const { data: signal, error: fetchError } = await supabase
      .from('argos_signal_ledger')
      .select('*')
      .eq('match_id', matchId)
      .single();

    if (fetchError || !signal) {
      return NextResponse.json({ error: 'Sinal original não encontrado no Ledger' }, { status: 404 });
    }

    // 2. Calcular métricas de feedback
    const feedback = FeedbackEngine.analyze({
      matchId,
      actualHomeGoals,
      actualAwayGoals,
      predictedProbabilities: {
        home: signal.probability, // Simplificado: assumindo que o ledger guarda a prob do sinal
        draw: 1 - signal.probability, // Exemplo simplificado
        away: 0 // Exemplo simplificado
      }
    });

    // 3. Atualizar o Ledger com o resultado real e as métricas de erro
    const { error: updateError } = await supabase
      .from('argos_signal_ledger')
      .update({
        actual_home_goals: actualHomeGoals,
        actual_away_goals: actualAwayGoals,
        is_correct: feedback.isCorrect,
        brier_score: feedback.brierScore,
        prediction_error: feedback.predictionError,
        settled_at: new Date().toISOString()
      })
      .eq('match_id', matchId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      status: 'settled',
      matchId,
      metrics: feedback
    });

  } catch (error: any) {
    console.error('Settle API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
