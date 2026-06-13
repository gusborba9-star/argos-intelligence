'use client';

import { useEffect, useState } from 'react';
import { PerformanceTrackingService, PerformanceMetrics } from '@/lib/argos/analytics/PerformanceTrackingService';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const service = new PerformanceTrackingService();
        const data = await service.getPublicStatistics();
        setMetrics(data);
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar métricas');
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-white text-2xl">Carregando Track Record do Argos...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-red-500 text-2xl">Erro: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-5xl font-bold mb-2">🎯 Argos Intelligence</h1>
          <p className="text-xl text-gray-400">Market Vigilante | Track Record Público</p>
          <p className="text-sm text-gray-500 mt-2">Transparência Total • Auditoria Matemática • Dominância Estatística</p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {/* Total Signals */}
          <div className="bg-gradient-to-br from-blue-900 to-blue-700 rounded-lg p-6 shadow-lg">
            <div className="text-sm text-blue-200 mb-2">Total de Sinais Entregues</div>
            <div className="text-4xl font-bold">{metrics?.total_signals_delivered || 0}</div>
            <div className="text-xs text-blue-300 mt-2">Auditorias Completadas</div>
          </div>

          {/* Win Rate */}
          <div className="bg-gradient-to-br from-green-900 to-green-700 rounded-lg p-6 shadow-lg">
            <div className="text-sm text-green-200 mb-2">Taxa de Acerto</div>
            <div className="text-4xl font-bold">{metrics?.win_rate?.toFixed(2) || 0}%</div>
            <div className="text-xs text-green-300 mt-2">
              {metrics?.total_signals_won || 0} Vitórias / {metrics?.total_signals_lost || 0} Derrotas
            </div>
          </div>

          {/* ROI */}
          <div className="bg-gradient-to-br from-purple-900 to-purple-700 rounded-lg p-6 shadow-lg">
            <div className="text-sm text-purple-200 mb-2">Retorno sobre Investimento</div>
            <div className="text-4xl font-bold">{metrics?.roi_percentage?.toFixed(2) || 0}%</div>
            <div className="text-xs text-purple-300 mt-2">ROI Agregado (Kelly Criterion)</div>
          </div>

          {/* Brier Score */}
          <div className="bg-gradient-to-br from-orange-900 to-orange-700 rounded-lg p-6 shadow-lg">
            <div className="text-sm text-orange-200 mb-2">Brier Score Médio</div>
            <div className="text-4xl font-bold">{metrics?.average_brier_score?.toFixed(4) || 0}</div>
            <div className="text-xs text-orange-300 mt-2">Calibração do Modelo (Menor é Melhor)</div>
          </div>

          {/* CLV */}
          <div className="bg-gradient-to-br from-cyan-900 to-cyan-700 rounded-lg p-6 shadow-lg">
            <div className="text-sm text-cyan-200 mb-2">CLV Médio (Closing Line Value)</div>
            <div className="text-4xl font-bold">{metrics?.average_clv_percentage?.toFixed(2) || 0}%</div>
            <div className="text-xs text-cyan-300 mt-2">Vantagem Média vs. Mercado</div>
          </div>

          {/* Signals Won */}
          <div className="bg-gradient-to-br from-indigo-900 to-indigo-700 rounded-lg p-6 shadow-lg">
            <div className="text-sm text-indigo-200 mb-2">Sinais Vencedores</div>
            <div className="text-4xl font-bold">{metrics?.total_signals_won || 0}</div>
            <div className="text-xs text-indigo-300 mt-2">Oportunidades Capturadas com Sucesso</div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold mb-3">⚠️ Aviso Importante</h3>
          <p className="text-sm text-gray-400">
            O Argos Intelligence é um sistema de análise quantitativa de mercado. O histórico de performance não garante resultados futuros. 
            Apostas envolvem risco. Sempre consulte um profissional antes de tomar decisões financeiras. 
            Todos os sinais são fornecidos apenas para fins informativos e educacionais.
          </p>
        </div>

        {/* Footer */}
        <div className="text-center text-gray-500 text-xs">
          <p>Argos v4.5 | Market Vigilante | Última Atualização: {new Date().toLocaleString('pt-BR')}</p>
        </div>
      </div>
    </div>
  );
}
