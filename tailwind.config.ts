import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        cloud: "#f8fafc",
        accent: "#0f766e",
        warning: "#b45309",
        danger: "#b91c1c"
      }
    }
  },
  plugins: []
};

export default config;
