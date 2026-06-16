"use client";

import React, { useState } from "react";
import Sidebar from "@/components/ui/Sidebar";
import DashboardCard from "@/components/ui/DashboardCard";
import SignalCard from "@/components/ui/SignalCard";
import NavigationOverlay from "@/components/ui/NavigationOverlay";

export default function Home() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activePage, setActivePage] = useState("home");

  const renderContent = () => {
    switch (activePage) {
      case "home":
        return (
          <div className="animate-fade-in space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <DashboardCard title="Sinais Hoje" value="42" trend="↑ 12% vs ontem" />
              <DashboardCard title="Taxa de Acerto" value="87.4%" trend="Média 30 dias" />
              <DashboardCard title="ROI Médio" value="+24.2%" trend="Tier VIP Alpha" />
            </div>

            <div>
              <div className="flex items-center gap-4 mb-8">
                <h2 className="font-playfair text-3xl text-[#D4AF37]">Oportunidades em Destaque</h2>
                <div className="flex-1 h-[1px] bg-[#D4AF37]/15" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <SignalCard 
                  teams="Real Madrid vs Man City" 
                  league="Champions League" 
                  prediction="Over 2.5 Goals" 
                  tier="vip" 
                />
                <SignalCard 
                  teams="Lakers vs Warriors" 
                  league="NBA" 
                  prediction="Warriors ML" 
                  tier="free" 
                />
                <SignalCard 
                  teams="Alcaraz vs Sinner" 
                  league="ATP Roland Garros" 
                  prediction="Sinner +1.5 Sets" 
                  tier="vip" 
                />
              </div>
            </div>
          </div>
        );
      case "oracle":
        return (
          <div className="animate-fade-in text-center py-20">
            <h2 className="font-playfair text-4xl text-[#D4AF37] mb-4">The Oracle</h2>
            <p className="text-[#B0B0B0]">Análise em tempo real alimentada por 1.5k simulações Monte Carlo.</p>
            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
               <div className="glass-card p-10">Live Feed coming soon...</div>
               <div className="glass-card p-10">Shock Engine active...</div>
            </div>
          </div>
        );
      case "track":
        return (
          <div className="animate-fade-in">
            <h2 className="font-playfair text-3xl text-[#D4AF37] mb-8">Track Record | Transparência</h2>
            <div className="glass-card overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#D4AF37]/15 text-[#D4AF37]">
                    <th className="p-5 font-semibold">Data</th>
                    <th className="p-5 font-semibold">Evento</th>
                    <th className="p-5 font-semibold">Mercado</th>
                    <th className="p-5 font-semibold">Resultado</th>
                  </tr>
                </thead>
                <tbody className="text-[#B0B0B0]">
                  <tr className="border-b border-[#D4AF37]/10 hover:bg-white/5 transition-colors">
                    <td className="p-5">15/06/2026</td>
                    <td className="p-5">Celtics vs Mavericks</td>
                    <td className="p-5">Under 210.5</td>
                    <td className="p-5 text-green-500 font-bold">WIN</td>
                  </tr>
                  <tr className="border-b border-[#D4AF37]/10 hover:bg-white/5 transition-colors">
                    <td className="p-5">15/06/2026</td>
                    <td className="p-5">Brazil vs Argentina</td>
                    <td className="p-5">BTTS - Yes</td>
                    <td className="p-5 text-green-500 font-bold">WIN</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      case "intel":
        return (
          <div className="animate-fade-in space-y-10">
            <h2 className="font-playfair text-3xl text-[#D4AF37]">Argos Intelligence | Tech Stack</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-card p-8">
                <h3 className="text-[#D4AF37] mb-4 font-bold">Monte Carlo</h3>
                <p className="text-sm text-[#B0B0B0]">1.500 simulações por vertical para garantir precisão quântica.</p>
              </div>
              <div className="glass-card p-8">
                <h3 className="text-[#D4AF37] mb-4 font-bold">Shock Engine</h3>
                <p className="text-sm text-[#B0B0B0]">Detecção de volatilidade em tempo real para mudanças bruscas de placar.</p>
              </div>
              <div className="glass-card p-8">
                <h3 className="text-[#D4AF37] mb-4 font-bold">Chameleon Logic</h3>
                <p className="text-sm text-[#B0B0B0]">Sistema bilateral que inverte sinais para lucrar na inércia tática.</p>
              </div>
            </div>
          </div>
        );
      case "vip":
        return (
          <div className="animate-fade-in flex flex-col items-center justify-center py-20">
            <div className="text-6xl mb-6">💎</div>
            <h2 className="font-playfair text-4xl text-[#D4AF37] mb-4">VIP Lounge</h2>
            <p className="text-[#B0B0B0] mb-10 text-center max-w-lg">
              Acesso restrito aos sinais Alpha com maior confiança e ROI projetado superior a 20% ao mês.
            </p>
            <button className="bg-[#D4AF37] text-black px-10 py-4 rounded-full font-bold hover:scale-105 transition-transform shadow-[0_0_30px_rgba(212,175,55,0.3)]">
              UPGRADE PARA VIP
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white selection:bg-[#D4AF37]/30">
      <Sidebar 
        isOpen={isSidebarOpen} 
        activePage={activePage} 
        onPageChange={setActivePage} 
        onClose={() => setIsSidebarOpen(false)} 
      />

      <main className="max-w-7xl mx-auto px-6 py-10 md:py-16 transition-all duration-500">
        <NavigationOverlay 
          onToggle={() => setIsSidebarOpen(true)} 
          userName="Apostador de Elite" 
        />

        <div className="mt-8">
          {renderContent()}
        </div>
      </main>

      {/* FAB - Floating Action Button */}
      <button 
        className="fixed bottom-8 right-8 w-16 h-16 bg-[#D4AF37] text-black rounded-full flex items-center justify-center text-3xl shadow-[0_10px_30px_rgba(212,175,55,0.3)] z-[900] transition-all duration-500 hover:scale-110 hover:rotate-90 active:scale-95"
        onClick={() => setIsSidebarOpen(true)}
      >
        +
      </button>
    </div>
  );
}
