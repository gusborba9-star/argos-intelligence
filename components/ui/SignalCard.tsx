'use client';

import React from 'react';

interface SignalProps {
  teams: string;
  league: string;
  market: string;
  prob: string;
  tier: 'free' | 'vip';
}

const SignalCard: React.FC<SignalProps> = ({ teams, league, market, prob, tier }) => {
  return (
    <div className="bg-gradient-to-br from-[#121212] to-[#0A0A0A] border border-[#D4AF37]/15 rounded-[25px] p-6 transition-all duration-400 hover:border-[#D4AF37] hover:shadow-[0_15px_40px_rgba(212,175,55,0.1)]">
      <div className="flex justify-between items-center mb-5">
        <span className={`px-3 py-1 rounded-full text-[0.7rem] font-bold uppercase ${tier === 'free' ? 'bg-[#555] text-white' : 'bg-[#D4AF37] text-black'}`}>
          {tier}
        </span>
        <span className="text-[#4CAF50] text-xs flex items-center gap-1">
          <span className="w-2 h-2 bg-[#4CAF50] rounded-full animate-pulse"></span> Live
        </span>
      </div>
      <div className="text-center mb-5">
        <div className="text-lg font-semibold mb-1 text-white">{teams}</div>
        <div className="text-xs text-[#B0B0B0]">{league}</div>
      </div>
      <div className="bg-white/5 p-4 rounded-2xl text-center border border-dashed border-[#D4AF37]/15">
        <div className="text-[0.75rem] text-[#B0B0B0] mb-1">{market}</div>
        <div className="text-[#D4AF37] font-bold text-lg">{prob} de Probabilidade</div>
      </div>
    </div>
  );
};

export default SignalCard;
