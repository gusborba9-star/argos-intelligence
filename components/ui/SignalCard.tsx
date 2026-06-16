"use client";

import React from "react";

interface SignalCardProps {
  teams: string;
  league: string;
  prediction: string;
  tier: "free" | "vip";
}

const SignalCard: React.FC<SignalCardProps> = ({ teams, league, prediction, tier }) => {
  return (
    <div className="bg-gradient-nexus border border-nexus-border rounded-[25px] p-6 relative group hover:border-nexus-gold/30 transition-all duration-500 hover:shadow-[0_15px_40px_rgba(212,175,55,0.1)]">
      <div className="flex justify-between items-center mb-5">
        <span className={`px-3 py-1 rounded-full text-[0.7rem] font-bold uppercase tracking-wider ${
          tier === "vip" ? "bg-nexus-gold text-black" : "bg-[#555] text-white"
        }`}>
          {tier === "vip" ? "VIP Alpha" : "Standard"}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[0.65rem] text-green-500 font-bold uppercase tracking-tighter">Live</span>
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
        </div>
      </div>

      <div className="text-center mb-5">
        <div className="text-lg font-semibold text-white mb-1 group-hover:text-nexus-gold transition-colors duration-300">
          {teams}
        </div>
        <div className="text-xs text-text-secondary uppercase tracking-widest font-medium">
          {league}
        </div>
      </div>

      <div className="bg-white/5 p-4 rounded-2xl text-center border border-dashed border-nexus-border group-hover:border-nexus-gold/20 transition-all duration-300">
        <div className="text-[0.75rem] text-text-secondary mb-1 font-medium">PREDIÇÃO ARGOS</div>
        <div className="text-nexus-gold font-bold text-lg tracking-wide">
          {prediction}
        </div>
      </div>
    </div>
  );
};

export default SignalCard;
