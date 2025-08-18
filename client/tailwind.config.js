/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@pipecat-ai/voice-ui-kit/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        // Samantha companion theme colors - warm and easy on eyes
        'primary': '#ff8a65',       // Warm coral/orange
        'secondary': '#ffab91',     // Lighter coral
        'companion': '#e57373',     // Soft red for companion voice
        'background': '#fdf6f0',    // Warm cream - much softer than white
        'foreground': '#3e2723',    // Dark brown
        'card': '#fefaf7',          // Very light warm cream
        'card-foreground': '#3e2723',
        'border': '#f0e6d6',        // Warm beige borders
        'input': '#f8f2eb',         // Light warm input background
        'accent': '#fef2ee',        // Very light peach accent
        'accent-foreground': '#3e2723',
        'muted': '#f5f0e8',         // Warm muted background
        'muted-foreground': '#8d7053', // Warm brown muted text
        'popover': '#fefaf7',
        'popover-foreground': '#3e2723',
      },
      fontFamily: {
        'sans': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        'mono': ['SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', 'Consolas', 'monospace'],
      },
      borderRadius: {
        'lg': '16px',
        'md': '12px',
        'sm': '8px',
      },
      transitionProperty: {
        'theme': 'background-color, border-color, color, fill, stroke, opacity, box-shadow, transform',
      },
    },
  },
  plugins: [],
};