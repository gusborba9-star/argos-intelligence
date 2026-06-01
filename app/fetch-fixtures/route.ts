import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Força a execução na camada Edge da Vercel para latência zero e custo mínimo
export const runtime = 'edge';

// Definição de tipos estritos para garantir previsibilidade e performance O(1)
type PriorityTier = 'TIER_0_CRITICAL' | 'TIER_1_PREMIUM' | 'TIER_2_FILLER';

interface LeagueGovernance {
  id: number;
  priority_tier: PriorityTier;
  name: string;
}

const TIER_ORDER: Record<PriorityTier, number> = {
  'TIER_0_CRITICAL': 0,
  'TIER_1_PREMIUM': 1,
  'TIER_2_FILLER': 2
};

export async function GET(request: Request) {
  // Captura dinâmica das variáveis de ambiente protegendo a etapa de 'Collecting page data' no build da Vercel
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({
      success: false,
      error: 'Infraestrutura corrompida: Variáveis de ambiente do Supabase não foram injetadas.'
    }, { status: 500 });
  }

  try {
    // Inicialização isolada por Request (bypasses RLS com Service Role)
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false } // Otimização extrema para o ambiente Edge (evita overhead de storage)
    });

    // 1. Busca as regras de Governança das Ligas configuradas no Supabase
    const { data: activeLeagues, error: govError } = await supabase
      .from('argos_league_governance')
      .select('id, priority_tier, name')
      .eq('is_active', true)
      .order('priority_tier', { ascending: true });

    if (govError) {
      throw new Error(`Falha no barramento de governança: ${govError.message}`);
    }

    if (!activeLeagues || activeLeagues.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhuma liga ativa registrada no Argos League Governance.',
        queue: []
      }, { status: 200 });
    }

    // Mapeamento em memória O(1) com tipagem forte para busca instantânea
    const leaguePriorityMap = new Map<number, PriorityTier>();
    
    for (let i = 0; i < activeLeagues.length; i++) {
      const league = activeLeagues[i] as unknown as LeagueGovernance;
      leaguePriorityMap.set(Number(league.id), league.priority_tier);
    }

    // 2. Dados brutos recebidos da API de futebol (Mock operacional)
    const mockExternalFixtures = [
      { fixtureId: 101, leagueId: 1, name: "Final da Copa do Mundo" },
      { fixtureId: 202, leagueId: 71, name: "Cruzeiro vs Fluminense" },
      { fixtureId: 203, leagueId: 71, name: "Flamengo vs Palmeiras" },
      { fixtureId: 304, leagueId: 140, name: "Real Madrid vs Barcelona" },
      { fixtureId: 405, leagueId: 999, name: "Liga Amadora Desconhecida" }
    ];

    // 3. Filtragem cirúrgica e Classificação de alta performance
    const approvedQueue = [];

    for (let i = 0; i < mockExternalFixtures.length; i++) {
      const match = mockExternalFixtures[i];
      const tier = leaguePriorityMap.get(match.leagueId);
      
      // Ingestão seletiva: Ignora na hora qualquer partida fora da governança ativa
      if (tier) {
        approvedQueue.push({
          fixtureId: match.fixtureId,
          leagueId: match.leagueId,
          name: match.name,
          tier: tier
        });
      }
    }

    // Ordenação indexada baseada no peso estrito do dicionário TIER_ORDER
    approvedQueue.sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);

    // 4. Aplicação do Teto Absoluto de 100 jogos diários (Prevenção contra estouro de concorrência)
    const MAX_DAILY_CEILING = 100;
    const finalCeilingQueue = approvedQueue.slice(0, MAX_DAILY_CEILING);

    // Retorno limpo e padronizado do Intelligence Lake
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      metrics: {
        governed_leagues_loaded: activeLeagues.length,
        total_fixtures_found: mockExternalFixtures.length,
        fixtures_after_governance_filter: approvedQueue.length,
        final_queue_sent_to_engine: finalCeilingQueue.length
      },
      queue: finalCeilingQueue
    }, { status: 200 });

  } catch (error: any) {
    // Interceptação de falhas interna
    return NextResponse.json({
      success: false,
      error: error.message || 'Erro não tratado no pipeline do Argos.'
    }, { status: 500 });
  }
                       }
