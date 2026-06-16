"use client";

import React from "react";

interface DashboardCardProps {
  title: string;
  value: string | number;
  trend: string;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ title, value, trend }) => {
  return (
    <div className="glass-card p-8 relative overflow-hidden group">
      <h3 className="text-[#D4AF37] text-[0.9rem] uppercase tracking-widest mb-4 opacity-80 group-hover:opacity-100 transition-opacity">
        {title}
      </h3>
      <div className="text-4xl font-bold mb-2 text-white">
        {value}
      </div>
      <div className="text-sm text-[#4CAF50] font-medium">
        {trend}
      </div>
      
      {/* Decorative gradient flare */}
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#D4AF37]/5 rounded-full blur-2xl group-hover:bg-[#D4AF37]/10 transition-colors" />
    </div>
  );
};

export default DashboardCard;
