import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#172B42",
          900: "#0F1E2E",
          800: "#172B42",
          700: "#20374F",
          600: "#2A4560",
        },
        paper: {
          DEFAULT: "#FAF9F6",
          warm: "#F4F1EA",
          deep: "#ECE7DC",
        },
        gold: {
          DEFAULT: "#C5A15B",
          dark: "#A9863F",
          light: "#E3D2AC",
        },
        ink: {
          DEFAULT: "#252525",
          soft: "#4A4A4A",
          muted: "#777777",
        },
        rule: {
          DEFAULT: "#DFDCD4",
          strong: "#C9C4B8",
        },
        verdict: {
          true: "#1F6F4A",
          false: "#A32B2B",
          misleading: "#A8690E",
          unverified: "#5A6472",
          outdated: "#6B4C8A",
          disputed: "#8A4A1F",
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "var(--font-serif-hi)", "Georgia", "Times New Roman", "serif"],
        sans: ["var(--font-sans)", "var(--font-sans-hi)", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        "serif-hi": ["var(--font-serif-hi)", "Noto Serif Devanagari", "serif"],
        "sans-hi": ["var(--font-sans-hi)", "Noto Sans Devanagari", "sans-serif"],
      },
      fontSize: {
        kicker: ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.14em" }],
        meta: ["0.75rem", { lineHeight: "1.1rem" }],
        "display-xl": ["clamp(2.6rem, 6vw, 4.75rem)", { lineHeight: "1.02", letterSpacing: "-0.02em" }],
        "display-lg": ["clamp(2.1rem, 4.4vw, 3.4rem)", { lineHeight: "1.06", letterSpacing: "-0.015em" }],
        "display-md": ["clamp(1.6rem, 2.6vw, 2.25rem)", { lineHeight: "1.12", letterSpacing: "-0.01em" }],
        "headline": ["1.375rem", { lineHeight: "1.24", letterSpacing: "-0.006em" }],
        "standfirst": ["1.0625rem", { lineHeight: "1.6" }],
      },
      maxWidth: {
        editorial: "1240px",
        measure: "68ch",
      },
      boxShadow: {
        paper: "0 1px 2px rgba(23,43,66,0.04), 0 12px 28px -18px rgba(23,43,66,0.18)",
        lift: "0 2px 4px rgba(23,43,66,0.05), 0 24px 48px -24px rgba(23,43,66,0.25)",
      },
      transitionTimingFunction: {
        editorial: "cubic-bezier(0.22, 0.61, 0.36, 1)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22,0.61,0.36,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
