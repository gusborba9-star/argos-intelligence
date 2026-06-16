import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Argos Intelligence | The Oracle",
  description: "Sistema de inteligência quântica bilateral para o mercado esportivo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <link 
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=Playfair+Display:wght@700&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body className="antialiased bg-nexus-bg text-white">
        {children}
      </body>
    </html>
  );
}
