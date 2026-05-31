import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/store/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#101418",
        cloud: "#f3efe6",
        accent: "#ff6b35",
        tide: "#0f766e",
        sand: "#d8c3a5",
      },
      boxShadow: {
        panel: "0 20px 60px rgba(16, 20, 24, 0.12)",
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(16,20,24,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(16,20,24,0.08) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};

export default config;
