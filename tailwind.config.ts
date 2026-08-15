import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './styles/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Core Neutral Palette (Dark Luxury Industrial)
        sara: {
          canvas: 'var(--sara-canvas)',
          surface: 'var(--sara-surface)',
          elevated: 'var(--sara-elevated)',
          hover: 'var(--sara-hover)',
          border: 'var(--sara-border)',
          'border-highlight': 'var(--sara-border-highlight)',
        },
        // Typography Colors
        content: {
          primary: 'var(--content-primary)',
          secondary: 'var(--content-secondary)',
          tertiary: 'var(--content-tertiary)',
        },
        // Primary Brand Accent (Industrial Amber - Construction & Quotes)
        brand: {
          DEFAULT: 'var(--brand-primary)',
          hover: 'var(--brand-primary-hover)',
          light: 'var(--brand-primary-light)',
          glow: 'var(--brand-primary-glow)',
        },
        // Secondary Operational Accents
        accent: {
          cyan: 'var(--accent-cyan)',       // Tech, Hydraulics & Electrical
          emerald: 'var(--accent-emerald)',   // Margins, Success & Approvals
          amber: 'var(--accent-amber)',     // Warnings & Fast Quotes
          rose: 'var(--accent-rose)',       // Alerts & Stock Deficits
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Outfit', 'Inter', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        floating: 'var(--shadow-floating)',
        glow: 'var(--shadow-glow)',
        'glow-cyan': 'var(--shadow-glow-cyan)',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        fast: '150ms',
        normal: '250ms',
        slow: '350ms',
      },
    },
  },
  plugins: [],
};

export default config;
