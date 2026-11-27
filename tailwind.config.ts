import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#17365D",
          50: "#EEF2F8",
          100: "#D8E1EE",
          200: "#B3C4DC",
          300: "#8299BE",
          400: "#4E6C97",
          500: "#244A73",
          600: "#1E3F63",
          700: "#17365D",
          800: "#122B4A",
          900: "#0D2138",
          950: "#081626",
        },
        gold: {
          DEFAULT: "#C5A253",
          50: "#FBF7EC",
          100: "#F5EBD1",
          200: "#EBD8A5",
          300: "#DFC077",
          400: "#D1AE63",
          500: "#C5A253",
          600: "#A9873F",
          700: "#856A32",
          800: "#5F4C25",
          900: "#3D3118",
        },
        ink: "#202B3C",
        mist: "#F3F5F8",
        line: "#E2E7EF",
        success: "#1B7A55",
        warning: "#B7791F",
        danger: "#B42318",
        canvas: "rgb(var(--canvas-rgb) / <alpha-value>)",
        panel: "rgb(var(--panel-rgb) / <alpha-value>)",
        panel2: "rgb(var(--panel-2-rgb) / <alpha-value>)",
        hairline: "rgb(var(--hairline-rgb) / <alpha-value>)",
        content: "rgb(var(--content-rgb) / <alpha-value>)",
        muted: "rgb(var(--muted-rgb) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(23,54,93,0.04), 0 8px 24px -12px rgba(23,54,93,0.12)",
        lift: "0 18px 40px -18px rgba(23,54,93,0.35)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateX(-8px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both",
        "fade-in": "fade-in 0.35s ease both",
        "slide-in": "slide-in 0.3s ease both",
      },
    },
  },
  plugins: [],
};

export default config;
