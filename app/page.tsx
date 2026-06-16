'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/ui/Sidebar';
import SignalCard from '@/components/ui/SignalCard';
import DashboardCard from '@/components/ui/DashboardCard';

export default function Home() {
  const [activePage, setActivePage] = useState('home');
  const [isSidebarActive, setIsSidebarActive] = useState(false);
  const [greeting, setGreeting] = useState('Boa tarde,');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) setGreeting("Bom dia,");
    else if (hour >= 12 && hour < 18) setGreeting("Boa tarde,");
    else setGreeting("Boa noite,");
  }, []);

  const signals = [
    { teams: "Argentina vs Algeria", league: "World Cup", market: "Home Win", prob: "85.1%", tier: "free" as const },
    { teams: "Austria vs Jordan", league: "World Cup", market: "Over 2.5 Goals", prob: "63.8%", tier: "free" as const },
    { teams: "Portugal vs Congo DR", league: "World Cup", market: "Most Corners Home", prob: "78.0%", tier: "vip" as const },
    { teams: "Argentina vs Algeria", league: "World Cup", market: "Over 9.5 Corners", prob: "68.0%", tier: "vip" as const }
  ];

  const history = [
    { date: "16/06", match: "Criciúma vs Ceará", market: "Under 9.5 Corners", res: "✅ Green" },
    { date: "16/06", match: "Iran vs NZ", market: "Under 2.5 Goals", res: "✅ Green" },
    { date: "15/06", match: "Londrina vs Avaí", market: "Over 2.5 Goals", res: "✅ Green" }
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <Sidebar 
        isActive={isSidebarActive} 
        activePage={activePage} 
        onNavigate={setActivePage} 
        onClose={() => setIsSidebarActive(false)} 
      />

      <main className={`transition-all duration-400 max-w-[1200px] mx-auto p-5 md:p-10 ${isSidebarActive ? 'md:ml-[300px]' : 'md:ml-[300px]'}`}>
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-lg font-light text-[#B0B0B0]">{greeting}</h1>
            <h2 className="text-4xl font-playfair text-[#D4AF37] mt-1">Apostador de Elite</h2>
          </div>
          <button 
            onClick={() => setIsSidebarActive(!isSidebarActive)}
            className="md:hidden bg-white/5 border border-[#D4AF37]/15 color-[#D4AF37] w-[50px] h-[50px] rounded-xl flex items-center justify-center text-2xl shadow-lg transition-all hover:scale-110"
          >
            ☰
          </button>
        </header>

        {/* PAGE: HOME */}
        {activePage === 'home' && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <DashboardCard label="Sinais Hoje" value="42" trend="↑ 12% vs ontem" />
              <DashboardCard label="Taxa de Acerto" value="87.4%" trend="Média 30 dias" />
              <DashboardCard label="ROI Médio" value="+24.2%" trend="Tier VIP Alpha" />
            </div>

            <div className="flex items-center gap-4 mb-8">
              <h2 className="font-playfair text-3xl text-[#D4AF37] whitespace-nowrap">Oportunidades em Destaque</h2>
              <div className="h-px bg-[#D4AF37]/15 w-full" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {signals.filter(s => s.tier === 'free').map((s, i) => (
                <SignalCard key={i} {...s} />
              ))}
            </div>
          </section>
        )}

        {/* PAGE: ORACLE */}
        {activePage === 'oracle' && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center gap-4 mb-8">
              <h2 className="font-playfair text-3xl text-[#D4AF37] whitespace-nowrap">The Oracle | Live Analysis</h2>
              <div className="h-px bg-[#D4AF37]/15 w-full" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {signals.map((s, i) => (
                <SignalCard key={i} {...s} />
              ))}
            </div>
          </section>
        )}

        {/* PAGE: TRACK RECORD */}
        {activePage === 'track' && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center gap-4 mb-8">
              <h2 className="font-playfair text-3xl text-[#D4AF37] whitespace-nowrap">Track Record | Transparência</h2>
              <div className="h-px bg-[#D4AF37]/15 w-full" />
            </div>
            <div className="bg-white/5 border border-[#D4AF37]/15 p-8 rounded-[25px] overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#D4AF37]/15 text-[#D4AF37]">
                    <th className="p-4">Data</th>
                    <th className="p-4">Evento</th>
                    <th className="p-4">Mercado</th>
                    <th className="p-4">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-4 text-[#B0B0B0]">{h.date}</td>
                      <td className="p-4 font-semibold">{h.match}</td>
                      <td className="p-4 text-[#B0B0B0]">{h.market}</td>
                      <td className="p-4 text-[#4CAF50] font-bold">{h.res}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* PAGE: INTELLIGENCE */}
        {activePage === 'intel' && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center gap-4 mb-8">
              <h2 className="font-playfair text-3xl text-[#D4AF37] whitespace-nowrap">Argos Intelligence | Tech Stack</h2>
              <div className="h-px bg-[#D4AF37]/15 w-full" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <DashboardCard label="Monte Carlo" value="1.5k" trend="Simulações/Vertical" />
              <DashboardCard label="Shock Engine" value="Live" trend="Volatilidade Real" />
              <DashboardCard label="Chameleon" value="Bilateral" trend="Inércia Tática" />
            </div>
            <div className="mt-10 p-8 bg-white/5 border border-[#D4AF37]/15 rounded-[25px]">
              <p className="text-[#B0B0B0] leading-relaxed">
                O Argos Intelligence não é apenas um software de predição; é um organismo analítico que unifica RAG, Poison, MCP e simulações quânticas para extrair o Alpha de qualquer mercado esportivo.
              </p>
            </div>
          </section>
        )}

        {/* PAGE: VIP */}
        {activePage === 'vip' && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center gap-4 mb-8">
              <h2 className="font-playfair text-3xl text-[#D4AF37] whitespace-nowrap">VIP Lounge | Alpha Strategy</h2>
              <div className="h-px bg-[#D4AF37]/15 w-full" />
            </div>
            <div className="bg-white/5 border border-[#D4AF37]/15 p-16 rounded-[25px] text-center">
              <h2 className="font-playfair text-[#D4AF37] text-5xl mb-6">Torne-se um Whale</h2>
              <p className="text-[#B0B0B0] text-xl mb-10 max-w-2xl mx-auto">
                Acesse Kelly Criterion, Mercados de Nicho e Sinais Exclusivos de Sindicato com o motor de maior assertividade do mercado mundial.
              </p>
              <button className="bg-[#D4AF37] text-black px-12 py-4 rounded-full font-bold text-lg transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(212,175,55,0.4)]">
                FALAR COM CONSULTOR
              </button>
            </div>
          </section>
        )}
      </main>

      {/* FLOATING ACTION BUTTON */}
      <button className="fixed bottom-8 right-8 w-16 h-16 bg-[#D4AF37] text-black rounded-full flex items-center justify-center text-3xl shadow-[0_10px_30px_rgba(212,175,55,0.3)] transition-all hover:scale-110 hover:rotate-12 z-[900]">
        💎
      </button>
    </div>
  );
}
