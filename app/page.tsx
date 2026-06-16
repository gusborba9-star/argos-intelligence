'use client';

import React, { useState, useEffect } from 'react';

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

  const toggleMenu = () => {
    setIsSidebarActive(!isSidebarActive);
  };

  const showPage = (pageId: string) => {
    setActivePage(pageId);
    if (window.innerWidth < 768) setIsSidebarActive(false);
  };

  const signals = [
    { teams: "Argentina vs Algeria", league: "World Cup", market: "Home Win", prob: "85.1%", tier: "free" },
    { teams: "Austria vs Jordan", league: "World Cup", market: "Over 2.5 Goals", prob: "63.8%", tier: "free" },
    { teams: "Portugal vs Congo DR", league: "World Cup", market: "Most Corners Home", prob: "78.0%", tier: "vip" },
    { teams: "Argentina vs Algeria", league: "World Cup", market: "Over 9.5 Corners", prob: "68.0%", tier: "vip" }
  ];

  const history = [
    { date: "16/06", match: "Criciúma vs Ceará", market: "Under 9.5 Corners", res: "✅ Green" },
    { date: "16/06", match: "Iran vs NZ", market: "Under 2.5 Goals", res: "✅ Green" },
    { date: "15/06", match: "Londrina vs Avaí", market: "Over 2.5 Goals", res: "✅ Green" }
  ];

  return (
    <div style={{ backgroundColor: '#0A0A0A', color: '#FFFFFF', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=Playfair+Display:wght@700&display=swap');
        
        body { margin: 0; padding: 0; background: #0A0A0A; }
        .sidebar { transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
        .nav-link:hover { background: rgba(255, 255, 255, 0.03); color: #D4AF37; transform: translateX(5px); }
        .card:hover { transform: translateY(-10px); border-color: #D4AF37; box-shadow: 0 15px 40px rgba(212, 175, 55, 0.1); }
      `}</style>

      {/* OVERLAY */}
      {isSidebarActive && (
        <div 
          onClick={toggleMenu}
          style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(5px)', zIndex: 999 }}
        />
      )}

      {/* SIDEBAR */}
      <aside className="sidebar" style={{ 
        position: 'fixed', top: 0, left: isSidebarActive ? 0 : '-300px', width: '300px', height: '100%', 
        background: 'rgba(10, 10, 10, 0.98)', borderRight: '1px solid rgba(212, 175, 55, 0.15)', 
        zIndex: 1000, padding: '40px 20px', display: 'flex', flexDirection: 'column', boxShadow: '10px 0 30px rgba(0,0,0,0.8)'
      }}>
        <div style={{ marginBottom: '50px', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', color: '#D4AF37', fontSize: '2rem', letterSpacing: '2px' }}>ARGOS</h2>
        </div>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {['home', 'oracle', 'track', 'intel', 'vip'].map((page) => (
            <li key={page} style={{ marginBottom: '15px' }}>
              <a 
                href="#" 
                onClick={(e) => { e.preventDefault(); showPage(page); }}
                style={{ 
                  display: 'flex', alignItems: 'center', padding: '15px 20px', color: activePage === page ? '#D4AF37' : '#B0B0B0', 
                  textDecoration: 'none', borderRadius: '12px', background: activePage === page ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                  border: activePage === page ? '1px solid rgba(212, 175, 55, 0.15)' : '1px solid transparent',
                  fontWeight: 500, transition: 'all 0.4s ease'
                }}
              >
                <span style={{ marginRight: '15px' }}>
                  {page === 'home' ? '🏠' : page === 'oracle' ? '👁️' : page === 'track' ? '📈' : page === 'intel' ? '🧠' : '💎'}
                </span> 
                {page.charAt(0).toUpperCase() + page.slice(1)} {page === 'intel' ? 'Intelligence' : page === 'vip' ? 'Lounge' : page === 'track' ? 'Record' : ''}
              </a>
            </li>
          ))}
        </ul>
        <div style={{ marginTop: 'auto', padding: '20px', borderTop: '1px solid rgba(212, 175, 55, 0.15)', fontSize: '0.85rem', color: '#B0B0B0' }}>
          <p>Argos é um sistema de inteligência quântica bilateral que utiliza Monte Carlo (1.5k simulações), RAG e Shock Engines.</p>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main style={{ padding: '40px 20px', maxWidth: '1200px', margin: '0 auto', transition: 'all 0.4s ease' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
          <div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 400, color: '#B0B0B0', margin: 0 }}>{greeting}</h1>
            <h2 style={{ fontSize: '2.5rem', fontFamily: 'Playfair Display, serif', color: '#D4AF37', marginTop: '5px', margin: 0 }}>Apostador de Elite</h2>
          </div>
          <button 
            onClick={toggleMenu}
            style={{ 
              background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(212, 175, 55, 0.15)', color: '#D4AF37', 
              width: '50px', height: '50px', borderRadius: '15px', cursor: 'pointer', fontSize: '1.5rem', 
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)', transition: 'all 0.4s ease'
            }}
          >☰</button>
        </header>

        {/* PAGE: HOME */}
        {activePage === 'home' && (
          <section className="page active">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '25px', marginBottom: '40px' }}>
              {[
                { label: 'Sinais Hoje', value: '42', trend: '↑ 12% vs ontem' },
                { label: 'Taxa de Acerto', value: '87.4%', trend: 'Média 30 dias' },
                { label: 'ROI Médio', value: '+24.2%', trend: 'Tier VIP Alpha' }
              ].map((card, i) => (
                <div key={i} className="card" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(212, 175, 55, 0.15)', padding: '30px', borderRadius: '25px', backdropFilter: 'blur(10px)', transition: 'all 0.4s ease' }}>
                  <h3 style={{ color: '#D4AF37', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '15px', margin: 0 }}>{card.label}</h3>
                  <div style={{ fontSize: '2.5rem', fontWeight: 700 }}>{card.value}</div>
                  <div style={{ fontSize: '0.9rem', color: '#4CAF50', marginTop: '10px' }}>{card.trend}</div>
                </div>
              ))}
            </div>

            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.8rem', color: '#D4AF37', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '15px' }}>
              Oportunidades em Destaque
              <div style={{ flex: 1, height: '1px', background: 'rgba(212, 175, 55, 0.15)' }} />
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
              {signals.filter(s => s.tier === 'free').map((s, i) => (
                <div key={i} style={{ background: 'linear-gradient(145deg, #121212, #0A0A0A)', border: '1px solid rgba(212, 175, 55, 0.15)', borderRadius: '25px', padding: '25px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <span style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', background: s.tier === 'free' ? '#555' : '#D4AF37', color: s.tier === 'free' ? 'white' : 'black' }}>{s.tier}</span>
                    <span style={{ color: '#4CAF50', fontSize: '0.8rem' }}>● Live</span>
                  </div>
                  <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '5px' }}>{s.teams}</div>
                    <div style={{ fontSize: '0.8rem', color: '#B0B0B0' }}>{s.league}</div>
                  </div>
                  <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '15px', borderRadius: '15px', textAlign: 'center', border: '1px dashed rgba(212, 175, 55, 0.15)' }}>
                    <div style={{ fontSize: '0.75rem', color: '#B0B0B0', marginBottom: '5px' }}>{s.market}</div>
                    <div style={{ color: '#D4AF37', fontWeight: 700, fontSize: '1.1rem' }}>{s.prob} de Probabilidade</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* PAGE: ORACLE */}
        {activePage === 'oracle' && (
          <section className="page active">
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.8rem', color: '#D4AF37', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '15px' }}>
              The Oracle | Live Analysis
              <div style={{ flex: 1, height: '1px', background: 'rgba(212, 175, 55, 0.15)' }} />
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
              {signals.map((s, i) => (
                <div key={i} style={{ background: 'linear-gradient(145deg, #121212, #0A0A0A)', border: '1px solid rgba(212, 175, 55, 0.15)', borderRadius: '25px', padding: '25px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <span style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', background: s.tier === 'free' ? '#555' : '#D4AF37', color: s.tier === 'free' ? 'white' : 'black' }}>{s.tier}</span>
                    <span style={{ color: '#4CAF50', fontSize: '0.8rem' }}>● Live</span>
                  </div>
                  <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '5px' }}>{s.teams}</div>
                    <div style={{ fontSize: '0.8rem', color: '#B0B0B0' }}>{s.league}</div>
                  </div>
                  <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '15px', borderRadius: '15px', textAlign: 'center', border: '1px dashed rgba(212, 175, 55, 0.15)' }}>
                    <div style={{ fontSize: '0.75rem', color: '#B0B0B0', marginBottom: '5px' }}>{s.market}</div>
                    <div style={{ color: '#D4AF37', fontWeight: 700, fontSize: '1.1rem' }}>{s.prob} de Probabilidade</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* PAGE: TRACK RECORD */}
        {activePage === 'track' && (
          <section className="page active">
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.8rem', color: '#D4AF37', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '15px' }}>
              Track Record | Transparência
              <div style={{ flex: 1, height: '1px', background: 'rgba(212, 175, 55, 0.15)' }} />
            </h2>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(212, 175, 55, 0.15)', padding: '30px', borderRadius: '25px', width: '100%', marginBottom: '30px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: '#D4AF37' }}>
                    <th style={{ padding: '15px' }}>Data</th>
                    <th style={{ padding: '15px' }}>Evento</th>
                    <th style={{ padding: '15px' }}>Mercado</th>
                    <th style={{ padding: '15px' }}>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '15px' }}>{h.date}</td>
                      <td style={{ padding: '15px' }}>{h.match}</td>
                      <td style={{ padding: '15px' }}>{h.market}</td>
                      <td style={{ padding: '15px', color: '#4CAF50' }}>{h.res}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* PAGE: INTELLIGENCE */}
        {activePage === 'intel' && (
          <section className="page active">
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.8rem', color: '#D4AF37', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '15px' }}>
              Argos Intelligence | Tech Stack
              <div style={{ flex: 1, height: '1px', background: 'rgba(212, 175, 55, 0.15)' }} />
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '25px' }}>
              {[
                { title: 'Monte Carlo', desc: '1.500 simulações por vertical para garantir precisão quântica.' },
                { title: 'Shock Engine', desc: 'Detecção de volatilidade em tempo real para mudanças bruscas de placar.' },
                { title: 'Chameleon Logic', desc: 'Sistema bilateral que inverte sinais para lucrar na inércia tática.' }
              ].map((item, i) => (
                <div key={i} className="card" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(212, 175, 55, 0.15)', padding: '30px', borderRadius: '25px', transition: 'all 0.4s ease' }}>
                  <h3 style={{ color: '#D4AF37', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '15px', margin: 0 }}>{item.title}</h3>
                  <p style={{ color: '#B0B0B0', fontSize: '0.9rem', margin: 0 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* PAGE: VIP */}
        {activePage === 'vip' && (
          <section className="page active">
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.8rem', color: '#D4AF37', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '15px' }}>
              VIP Lounge | Alpha Strategy
              <div style={{ flex: 1, height: '1px', background: 'rgba(212, 175, 55, 0.15)' }} />
            </h2>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(212, 175, 55, 0.15)', padding: '60px', borderRadius: '25px', textAlign: 'center' }}>
              <h2 style={{ fontFamily: 'Playfair Display, serif', color: '#D4AF37', fontSize: '2.5rem', marginBottom: '20px', margin: 0 }}>Torne-se um Whale</h2>
              <p style={{ marginBottom: '30px', color: '#B0B0B0' }}>Acesse Kelly Criterion, Mercados de Nicho e Sinais Exclusivos de Sindicato.</p>
              <button style={{ background: '#D4AF37', color: 'black', padding: '15px 40px', borderRadius: '30px', border: 'none', fontWeight: 700, cursor: 'pointer' }}>FALAR COM CONSULTOR</button>
            </div>
          </section>
        )}
      </main>

      <button style={{ 
        position: 'fixed', bottom: '30px', right: '30px', width: '65px', height: '65px', background: '#D4AF37', 
        color: 'black', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', 
        fontSize: '1.8rem', boxShadow: '0 10px 30px rgba(212, 175, 55, 0.3)', cursor: 'pointer', zIndex: 900, 
        transition: 'all 0.4s ease', border: 'none' 
      }}>💎</button>
    </div>
  );
}
