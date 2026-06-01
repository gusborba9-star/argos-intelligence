import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

type PriorityTier = 'TIER_0_CRITICAL' | 'TIER_1_PREMIUM' | 'TIER_2_FILLER';

const TIER_ORDER: Record<PriorityTier, number> = {
  'TIER_0_CRITICAL': 0,
  'TIER_1_PREMIUM': 1,
  'TIER_2_FILLER': 2
};

export async function GET(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({
      success: false,
      error: 'Infraestrutura corrompida: Variáveis ausentes.'
    }, { status: 500 });
  }

  // Otimização: Forçamos a autorização via cabeçalho para garantir bypass total do RLS
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: {
      headers: { 'Authorization': `Bearer ${supabaseServiceKey}` }
    }
  });

  try {
    const { data: activeLeagues, error: govError } = await supabase
      .from('argos_league_governance')
      .select('id, priority_tier, name')
      .eq('is_active', true);

    if (govError) {
      throw new Error(govError.message);
    }

    const leaguePriorityMap = new Map<number, PriorityTier>();
    activeLeagues?.forEach(l => leaguePriorityMap.set(Number(l.id), l.priority_tier as PriorityTier));

    const mockExternalFixtures = [
      { fixtureId: 101, leagueId: 1, name: "Final da Copa do Mundo" },
      { fixtureId: 202, leagueId: 71, name: "Cruzeiro vs Fluminense" },
      { fixtureId: 203, leagueId: 71, name: "Flamengo vs Palmeiras" },
      { fixtureId: 304, leagueId: 140, name: "Real Madrid vs Barcelona" },
      { fixtureId: 405, leagueId: 999, name: "Liga Amadora Desconhecida" }
    ];

    const approvedQueue = mockExternalFixtures
      .filter(match => leaguePriorityMap.has(match.leagueId))
      .map(match => ({
        ...match,
        tier: leaguePriorityMap.get(match.leagueId)!
      }))
      .sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      queue: approvedQueue.slice(0, 100)
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: `Falha no barramento de governança: ${error.message}`
    }, { status: 500 });
  }
}
