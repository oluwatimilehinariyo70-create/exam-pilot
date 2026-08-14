import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        paper: "#f7f8fb",
        navy: "#10243e",
        teal: "#167c80",
        amber: "#c8871a",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 36, 62, 0.04), 0 8px 24px rgba(16, 36, 62, 0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
