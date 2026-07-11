/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Century Gothic"', "CenturyGothic", "AppleGothic", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#f0f7ff",
          100: "#e0effe",
          500: "#2563eb",
          600: "#1d4ed8",
          700: "#1e40af",
          900: "#1e3a5f",
        },
        risk: {
          low: "#16a34a",
          medium: "#ca8a04",
          high: "#dc2626",
          unrated: "#6b7280",
        },
      },
    },
  },
  plugins: [],
};
