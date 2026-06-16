"use client";

import React from "react";

interface NavigationOverlayProps {
  onToggle: () => void;
  userName: string;
}

const NavigationOverlay: React.FC<NavigationOverlayProps> = ({ onToggle, userName }) => {
  const [greeting, setGreeting] = React.useState("Boa tarde");

  React.useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Bom dia");
    else if (hour < 18) setGreeting("Boa tarde");
    else setGreeting("Boa noite");
  }, []);

  return (
    <header className="flex justify-between items-center mb-10 animate-fade-in">
      <div className="greeting-section">
        <h1 className="text-lg text-text-secondary font-light">{greeting},</h1>
        <h2 className="text-4xl font-playfair text-nexus-gold mt-1 tracking-tight">
          {userName}
        </h2>
      </div>
      
      <button 
        onClick={onToggle}
        className="bg-nexus-glass border border-nexus-border text-nexus-gold w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-lg transition-all hover:scale-110 hover:bg-nexus-gold/10 active:scale-95 z-[90]"
      >
        ☰
      </button>
    </header>
  );
};

export default NavigationOverlay;
