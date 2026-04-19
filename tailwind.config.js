/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gray: {
          850: '#1f2937',
          900: '#111827',
          950: '#0B0F19',
        },
        primary: {
          DEFAULT: '#f26e1d', // Fullerton Go Orange
          dim: '#d65a12',
        },
        niantic: {
          DEFAULT: '#3ddc84', // Specific green for redeem button
          dim: '#2ea863',
        },
        accent: {
          DEFAULT: '#e94560',
          dim: '#b52b41'
        }
      },
      borderWidth: {
        DEFAULT: '2px',
        '0': '0',
        '2': '2px',
        '4': '4px',
        '8': '8px',
      },
      borderRadius: {
        'none': '0',
        'sm': '0',
        DEFAULT: '0',
        'md': '0',
        'lg': '0',
        'xl': '0',
        '2xl': '0',
        '3xl': '0',
        'full': '9999px', // Keep full for circles
      },
      boxShadow: {
        'sm': '2px 2px 0px 0px var(--tw-shadow-color, rgba(0, 0, 0, 1))',
        DEFAULT: '3px 3px 0px 0px var(--tw-shadow-color, rgba(0, 0, 0, 1))',
        'md': '4px 4px 0px 0px var(--tw-shadow-color, rgba(0, 0, 0, 1))',
        'lg': '5px 5px 0px 0px var(--tw-shadow-color, rgba(0, 0, 0, 1))',
        'xl': '6px 6px 0px 0px var(--tw-shadow-color, rgba(0, 0, 0, 1))',
        '2xl': '8px 8px 0px 0px var(--tw-shadow-color, rgba(0, 0, 0, 1))',
        'inner': 'inset 3px 3px 0px 0px var(--tw-shadow-color, rgba(0, 0, 0, 0.5))',
        'none': '0 0 #0000',
        'brutal': '3px 3px 0px 0px var(--tw-shadow-color, rgba(0, 0, 0, 1))',
        'brutal-sm': '2px 2px 0px 0px var(--tw-shadow-color, rgba(0, 0, 0, 1))',
        'brutal-white': '3px 3px 0px 0px var(--tw-shadow-color, rgba(255, 255, 255, 0.15))',
        'brutal-black': '3px 3px 0px 0px var(--tw-shadow-color, rgba(0, 0, 0, 1))',
        'brutal-green': '3px 3px 0px 0px var(--tw-shadow-color, rgba(61, 220, 132, 0.2))',
      },
      fontFamily: {
        sans: ['"JetBrains Mono"', 'monospace'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}