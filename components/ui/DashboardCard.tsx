'use client';

import React from 'react';

interface DashboardCardProps {
  label: string;
  value: string;
  trend: string;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ label, value, trend }) => {
  return (
    <div className="bg-white/5 border border-[#D4AF37]/15 p-8 rounded-[25px] backdrop-blur-md transition-all duration-400 hover:-translate-y-2 hover:border-[#D4AF37] hover:shadow-[0_15px_40px_rgba(212,175,55,0.1)]">
      <h3 className="text-[#D4AF37] text-[0.9rem] uppercase tracking-wider mb-4">{label}</h3>
      <div className="text-4xl font-bold text-white">{value}</div>
      <div className="text-sm text-[#4CAF50] mt-2">{trend}</div>
    </div>
  );
};

export default DashboardCard;
