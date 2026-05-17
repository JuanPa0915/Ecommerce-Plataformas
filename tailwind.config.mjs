/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{astro,html,js,jsx,ts,tsx,vue,svelte,md,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          50: "#F4F6F9",
          100: "#E8EDF2",
          200: "#D5DCE4",
          300: "#B8C4D0",
          400: "#8A9BAD",
          500: "#64778B",
          600: "#4D5E6F",
          700: "#3B4A59",
          800: "#2C3947",
          900: "#1F2833",
          950: "#131A22",
        },
        brand: {
          50: "#EEF4F8",
          100: "#DCEAF2",
          200: "#B9D4E5",
          300: "#8DB9D2",
          400: "#6B9AB8",
          500: "#547A95",
          600: "#46677E",
          700: "#385365",
          800: "#2C404E",
          900: "#1F2D37",
          950: "#131C23",
        },
        accent: {
          50: "#FBF7EF",
          100: "#F5EDDA",
          200: "#E9D8B3",
          300: "#D9C08A",
          400: "#C2A56D",
          500: "#AB8E55",
          600: "#8F7544",
          700: "#715C36",
          800: "#56462A",
          900: "#3B3020",
          950: "#241E14",
        },
      },
      fontFamily: {
        display: ["Inter", "Poppins", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
