/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        lego: {
          red: "#E3000B",
          yellow: "#FFD700",
          blue: "#006DB7",
          dark: "#1a1a2e",
          card: "#16213e",
          accent: "#0f3460",
        },
      },
      fontFamily: {
        display: ["'Nunito'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
