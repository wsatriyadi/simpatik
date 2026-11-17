/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff7f5",
          100: "#d8ece7",
          200: "#b3d9d1",
          300: "#83bfb4",
          400: "#4f9f92",
          500: "#2f8477",
          600: "#226a60",
          700: "#1e554e",
          800: "#1c4540",
          900: "#1a3a36",
          950: "#0a2421",
        },
        gold: {
          50: "#fbf7ec",
          100: "#f5ecd0",
          200: "#ead6a0",
          300: "#dcb968",
          400: "#d1a545",
          500: "#c28f33",
          600: "#a67229",
          700: "#855723",
          800: "#6f4823",
          900: "#5e3c21",
        },
        paper: "#f7f5f0",
        ink: "#15201e",
        line: "#e5e1d8",
      },
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans Variable"',
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(21,32,30,0.04), 0 8px 24px -16px rgba(21,32,30,0.18)",
        lift: "0 2px 4px rgba(21,32,30,0.04), 0 18px 40px -22px rgba(21,32,30,0.30)",
        inset: "inset 0 1px 0 rgba(255,255,255,0.08)",
      },
      borderRadius: {
        "2xl": "1.15rem",
        "3xl": "1.5rem",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-up": "fade-up .35s cubic-bezier(.2,.8,.2,1) both",
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [],
};
