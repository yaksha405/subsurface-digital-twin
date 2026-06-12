/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: "#0A0A0F",
          secondary: "#121218",
          tertiary: "#1A1D2A",
          panel: "#2A2D3A",
        },
        primary: {
          yellow: "#FFE600",
          red: "#FF3333",
          blue: "#1E3A5F",
          orange: "#FF8800",
        },
        text: {
          DEFAULT: "#E0E0E8",
          muted: "#A0A0B0",
          yellow: "#FFE600",
        },
        accent: {
          safe: "#2D6A4F",
          danger: "#FF3333",
          warn: "#FF8800",
        },
      },
      fontFamily: {
        sans: ['Oswald', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      animation: {
        "breathe-red": "breatheRed 1.5s ease-in-out infinite",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "scan-line": "scanLine 3s linear infinite",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
      },
      keyframes: {
        breatheRed: {
          "0%, 100%": { opacity: "0.3" },
          "50%": { opacity: "0.8" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 5px rgba(255,230,0,0.3)" },
          "50%": { boxShadow: "0 0 20px rgba(255,230,0,0.6)" },
        },
        scanLine: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
