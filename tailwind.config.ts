import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "nexus-gold": "#D4AF37",
        "nexus-gold-dark": "#996515",
        "nexus-bg": "#0A0A0A",
        "nexus-glass": "rgba(255, 255, 255, 0.03)",
        "nexus-border": "rgba(212, 175, 55, 0.15)",
        "text-primary": "#FFFFFF",
        "text-secondary": "#B0B0B0",
      },
      fontFamily: {
        playfair: ["var(--font-playfair)", "serif"],
        inter: ["var(--font-inter)", "serif"],
      },
      backgroundImage: {
        "gradient-nexus": "linear-gradient(145deg, #121212, #0A0A0A)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
export default config;
