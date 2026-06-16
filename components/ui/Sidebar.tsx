"use client";

import React from "react";

interface SidebarProps {
  isOpen: boolean;
  activePage: string;
  onPageChange: (page: string) => void;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, activePage, onPageChange, onClose }) => {
  const navItems = [
    { id: "home", label: "Home Dashboard", icon: "🏠" },
    { id: "oracle", label: "The Oracle", icon: "👁️" },
    { id: "track", label: "Track Record", icon: "📈" },
    { id: "intel", label: "Argos Intelligence", icon: "🧠" },
    { id: "vip", label: "VIP Lounge", icon: "💎" },
  ];

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/70 backdrop-blur-sm z-[999] transition-opacity duration-500 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-[300px] bg-nexus-bg/98 border-r border-nexus-border z-[1000] transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] flex flex-col p-10 shadow-[10px_0_30px_rgba(0,0,0,0.8)] ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-12 text-center">
          <h2 className="font-playfair text-nexus-gold text-3xl tracking-[2px]">ARGOS</h2>
        </div>

        <nav className="flex-1">
          <ul className="list-none space-y-4">
            {navItems.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => {
                    onPageChange(item.id);
                    onClose();
                  }}
                  className={`w-full nav-link ${activePage === item.id ? "active" : ""}`}
                >
                  <span className="mr-4 text-xl">{item.icon}</span>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-auto pt-5 border-t border-nexus-border text-[0.85rem] text-text-secondary leading-relaxed">
          <p>
            Argos é um sistema de inteligência quântica bilateral que utiliza Monte Carlo (1.5k simulações), RAG e Shock Engines para dominar o mercado esportivo.
          </p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
