import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        bg: '#F7F7F0',
        ink: '#101418',
        primary: '#0B6E4F',
        accent: '#C44536',
        muted: '#6C7A86'
      },
      boxShadow: {
        card: '0 8px 28px rgba(16, 20, 24, 0.08)'
      },
      borderRadius: {
        xl: '1rem'
      }
    }
  },
  plugins: []
};

export default config;
