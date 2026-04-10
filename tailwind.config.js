/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        upsaBlue: "#003366",
        upsaGold: "#FFCC00",
        upsaNight: "#041426",
      },
      boxShadow: {
        card: "0 6px 14px rgba(0, 0, 0, 0.12)",
      },
    },
  },
  plugins: [],
};
