'use client';

import React from 'react';

interface SidebarProps {
  isActive: boolean;
  activePage: string;
  onNavigate: (pageId: string) => void;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isActive, activePage, onNavigate, onClose }) => {
  const menuItems = [
    { id: 'home', label: 'Home Dashboard', icon: '🏠' },
    { id: 'oracle', label: 'The Oracle', icon: '👁️' },
    { id: 'track', label: 'Track Record', icon: '📈' },
    { id: 'intel', label: 'Argos Intelligence', icon: '🧠' },
    { id: 'vip', label: 'VIP Lounge', icon: '💎' },
  ];

  return (
    <>
      {/* OVERLAY */}
      {isActive && (
        <div 
          onClick={onClose}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[999] md:hidden"
        />
      )}

      {/* SIDEBAR */}
      <aside className={`fixed top-0 left-0 h-full w-[300px] bg-[#0A0A0A]/98 border-r border-[#D4AF37]/15 z-[1000] p-10 flex flex-col shadow-[10px_0_30px_rgba(0,0,0,0.8)] transition-transform duration-400 ease-[cubic-bezier(0.4,0,0.2,1)] ${isActive ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="mb-12 text-center">
          <h2 className="font-['Playfair_Display'] text-[#D4AF37] text-3xl tracking-widest">ARGOS</h2>
        </div>
        <nav>
          <ul className="list-none p-0">
            {menuItems.map((item) => (
              <li key={item.id} className="mb-4">
                <button 
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center p-4 rounded-xl transition-all duration-400 font-medium border ${activePage === item.id ? 'bg-white/5 text-[#D4AF37] border-[#D4AF37]/15' : 'text-[#B0B0B0] border-transparent hover:bg-white/5 hover:text-[#D4AF37] hover:translate-x-1'}`}
                >
                  <span className="mr-4 text-xl">{item.icon}</span>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-auto pt-5 border-t border-[#D4AF37]/15 text-xs text-[#B0B0B0]">
          <p>Argos é um sistema de inteligência quântica bilateral que utiliza Monte Carlo, RAG e Shock Engines.</p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
