import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

// Otimização de fontes via next/font para evitar CLS e melhorar performance
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Argos Intelligence | The Oracle",
  description: "Sistema de inteligência quântica bilateral para o mercado esportivo.",
  keywords: ["apostas", "inteligência artificial", "esportes", "analítica", "syndicate"],
  authors: [{ name: "Argos Intelligence" }],
  openGraph: {
    title: "Argos Intelligence | The Oracle",
    description: "Sistema de inteligência quântica bilateral para o mercado esportivo.",
    type: "website",
    locale: "pt_BR",
    siteName: "Argos Intelligence",
  },
  twitter: {
    card: "summary_large_image",
    title: "Argos Intelligence | The Oracle",
    description: "Sistema de inteligência quântica bilateral para o mercado esportivo.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${playfair.variable}`}>
      <body className="antialiased bg-nexus-bg text-white font-sans">
        {children}
      </body>
    </html>
  );
}
