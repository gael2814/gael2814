import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: { DEFAULT: "#1f3d2b", dark: "#142a1d", light: "#2d5a3f" },
        terracotta: { DEFAULT: "#c4562a", dark: "#a2441f", light: "#dc7a4f" },
        mustard: { DEFAULT: "#e3a52b", dark: "#c48a17", light: "#f0c35e" },
        cream: { DEFAULT: "#f7ecd4", dark: "#ecdcb7", light: "#fffaf0" },
        ink: "#2a1f17",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        western: ["var(--font-western)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      boxShadow: { stamp: "4px 4px 0 0 #1f3d2b", "stamp-sm": "2px 2px 0 0 #1f3d2b" },
    },
  },
  plugins: [],
} satisfies Config;
