/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "Manrope", "SF Pro Text", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "SF Mono", "ui-monospace", "monospace"],
      },
      colors: {
        praxis: {
          app: "#0F1012",
          stage: "#0A0B0D",
          panel: "#151619",
          card: "#1C1D21",
          line: "#2A2C31",
          lineStrong: "#32353B",
          body: "#E0E0E0",
          soft: "#D1D1D1",
          muted: "#A0A0A0",
          accent: "#4ADE80",
          accentSoft: "#1C3E2F",
          record: "#F27D26",
        },
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 220ms ease-out",
      },
    },
  },
  plugins: [],
};
