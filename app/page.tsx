"use client";

import React from "react";

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-black flex items-center justify-center p-20">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-4">DIAGNÓSTICO ARGOS</h1>
        <p className="text-2xl">Se você está vendo esta mensagem em branco e preto, a renderização básica está funcionando.</p>
        <div className="mt-10 p-10 bg-red-500 text-white rounded-xl">
          TESTE DE RENDERIZAÇÃO ATIVO
        </div>
      </div>
    </div>
  );
}
