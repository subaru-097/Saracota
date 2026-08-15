/**
 * Sara Cota - Design System Tokens Reference (TypeScript)
 * Single Source of Truth for visual design tokens.
 */

export const SARA_TOKENS = {
  colors: {
    canvas: 'var(--sara-canvas)',            // #0A0C0E
    surface: 'var(--sara-surface)',          // #111419
    elevated: 'var(--sara-elevated)',        // #181C22
    hover: 'var(--sara-hover)',              // #20252D
    border: 'var(--sara-border)',            // rgba(255, 255, 255, 0.08)
    borderHighlight: 'var(--sara-border-highlight)',
    
    content: {
      primary: 'var(--content-primary)',      // #F8FAFC
      secondary: 'var(--content-secondary)',  // #94A3B8
      tertiary: 'var(--content-tertiary)',    // #64748B
    },

    brand: {
      primary: 'var(--brand-primary)',        // #F59E0B (Laranja Âmbar Industrial)
      hover: 'var(--brand-primary-hover)',    // #D97706
      light: 'var(--brand-primary-light)',
      glow: 'var(--brand-primary-glow)',
    },

    accent: {
      cyan: 'var(--accent-cyan)',             // #0EA5E9 (Tech / Hidráulica / Elétrica)
      emerald: 'var(--accent-emerald)',       // #10B981 (Margem / Sucesso)
      amber: 'var(--accent-amber)',           // #F59E0B (Aviso)
      rose: 'var(--accent-rose)',             // #EF4444 (Erro / Déficit)
    },
  },

  typography: {
    fontSans: 'var(--font-sans)',
    fontMono: 'var(--font-mono)',
    weights: {
      light: '300',
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
    },
  },

  radii: {
    sm: 'var(--radius-sm)',   // 6px
    md: 'var(--radius-md)',   // 10px
    lg: 'var(--radius-lg)',   // 14px
    xl: 'var(--radius-xl)',   // 20px
    full: 'var(--radius-2xl)',// 28px / full
  },

  transitions: {
    durationFast: '150ms',
    durationNormal: '250ms',
    durationSlow: '350ms',
    easingSmooth: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },

  shadows: {
    card: 'var(--shadow-card)',
    floating: 'var(--shadow-floating)',
    glow: 'var(--shadow-glow)',
    glowCyan: 'var(--shadow-glow-cyan)',
  },
} as const;

export type SaraTokens = typeof SARA_TOKENS;
