import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Força a execução na camada Edge da Vercel para latência zero e custo mínimo
export const runtime = 'edge';

// Inicialização do cliente Supabase usando a chave de privilégios totais do sistema
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: Request) {
  try {
    // 1. Busca as regras de Governança das Ligas configuradas no Supabase
    const { data: activeLeagues, error: govError } = await supabase
      .from('argos_league_governance')
      .select('id, priority_tier, name')
      .eq('is_active', true)
      .order('priority_tier', { ascending: true });

    if (govError) throw new Error(`Falha na governança: ${govError.message}`);

    // Mapeamento rápido em memória O(1) para verificar as prioridades das ligas
    const leaguePriorityMap = new Map<number, string>();
    activeLeagues.forEach(league => {
      leaguePriorityMap.set(Number(league.id), league.priority_tier);
    });

    // 2. Simulação dos dados brutos recebidos da API de futebol
    const mockExternalFixtures = [
      { fixtureId: 101, leagueId: 1, name: "Final da Copa do Mundo" },
      { fixtureId: 202, leagueId: 71, name: "Cruzeiro vs Fluminense" },
      { fixtureId: 203, leagueId: 71, name: "Flamengo vs Palmeiras" },
      { fixtureId: 304, leagueId: 140, name: "Real Madrid vs Barcelona" },
      { fixtureId: 405, leagueId: 999, name: "Liga Amadora Desconhecida" }
    ];

    // 3. Filtragem e Classificação com base no peso da Bet365
    const approvedQueue = mockExternalFixtures
      .filter(match => leaguePriorityMap.has(match.leagueId))
      .map(match => ({
        ...match,
        tier: leaguePriorityMap.get(match.leagueId)!
      }))
      .sort((a, b) => {
        const tierOrder = { 'TIER_0_CRITICAL': 0, 'TIER_1_PREMIUM': 1, 'TIER_2_FILLER': 2 };
        return tierOrder[a.tier as keyof typeof tierOrder] - tierOrder[b.tier as keyof typeof tierOrder];
      });

    // 4. Aplicação do Teto Absoluto de 100 jogos diários
    const MAX_DAILY_CEILING = 100;
    const finalCeilingQueue = approvedQueue.slice(0, MAX_DAILY_CEILING);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      governed_leagues_loaded: activeLeagues.length,
      total_fixtures_found: mockExternalFixtures.length,
      fixtures_after_governance_filter: approvedQueue.length,
      final_queue_sent_to_engine: finalCeilingQueue.length,
      queue: finalCeilingQueue
    }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
