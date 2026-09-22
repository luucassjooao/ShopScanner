import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

/**
 * Tokens do design system do ShopScanner (CLAUDE.md → "Design system").
 * Os valores ficam em variáveis CSS em src/index.css; aqui só damos nome a eles.
 * Só tema claro no MVP.
 */
const hsl = (v: string) => `hsl(var(--${v}) / <alpha-value>)`;

/** Fundo suave de um status, derivado da própria cor — nunca um hex inventado. */
const suave = (v: string) => `color-mix(in srgb, hsl(var(--${v})) 8%, #FFFFFF)`;

export default {
  darkMode: [],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // --- tokens do CLAUDE.md ---
        fundo: hsl('background'),
        superficie: hsl('surface'),
        borda: hsl('border'),
        texto: hsl('foreground'),
        'texto-secundario': hsl('muted-foreground'),
        acao: hsl('acao'),
        apoio: hsl('apoio'),
        coral: hsl('coral'),
        pessego: hsl('pessego'),

        // rampa sequencial de coral
        'coral-100': hsl('coral-100'),
        'coral-200': hsl('coral-200'),
        'coral-300': hsl('coral-300'),
        'coral-400': hsl('coral-400'),
        'coral-500': hsl('coral-500'),

        // status de comissão — sempre acompanhados do rótulo escrito
        status: {
          liquidado: hsl('st-settled'),
          'liquidado-suave': suave('st-settled'),
          'a-liquidar': hsl('st-to-settle'),
          'a-liquidar-suave': suave('st-to-settle'),
          aguardando: hsl('st-awaiting'),
          'aguardando-suave': suave('st-awaiting'),
          reembolsado: hsl('st-refunded'),
          'reembolsado-suave': suave('st-refunded'),
          retido: hsl('st-frozen'),
          'retido-suave': suave('st-frozen'),
        },

        // ordem categórica fixa dos gráficos — nunca reciclar fora desta ordem
        grafico: {
          1: hsl('chart-1'),
          2: hsl('chart-2'),
          3: hsl('chart-3'),
          4: hsl('chart-4'),
          5: hsl('chart-5'),
          6: hsl('chart-6'),
          comparacao: hsl('chart-comparison'),
        },

        // --- nomes que o shadcn/ui espera, apontando para os mesmos tokens ---
        background: hsl('background'),
        foreground: hsl('foreground'),
        card: { DEFAULT: hsl('surface'), foreground: hsl('foreground') },
        popover: { DEFAULT: hsl('surface'), foreground: hsl('foreground') },
        primary: { DEFAULT: hsl('coral'), foreground: hsl('foreground') },
        secondary: { DEFAULT: hsl('pessego'), foreground: hsl('foreground') },
        muted: { DEFAULT: hsl('background'), foreground: hsl('muted-foreground') },
        accent: { DEFAULT: hsl('background'), foreground: hsl('acao') },
        destructive: { DEFAULT: hsl('st-refunded'), foreground: hsl('surface') },
        border: hsl('border'),
        input: hsl('border'),
        ring: hsl('acao'),
      },
      borderRadius: {
        card: 'var(--radius-card)', // 12px
        campo: 'var(--radius-campo)', // 8px
        lg: 'var(--radius-card)',
        md: 'var(--radius-campo)',
        sm: 'calc(var(--radius-campo) - 2px)',
      },
      boxShadow: {
        suave: '0 1px 2px hsl(var(--foreground) / 0.04), 0 8px 24px hsl(var(--foreground) / 0.05)',
        'suave-lg':
          '0 1px 2px hsl(var(--foreground) / 0.04), 0 16px 40px hsl(var(--foreground) / 0.08)',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        'titulo-lg': ['2rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '800' }], // 32
        titulo: ['1.75rem', { lineHeight: '1.22', letterSpacing: '-0.02em', fontWeight: '800' }], // 28
        'titulo-sm': [
          '1.5rem',
          { lineHeight: '1.25', letterSpacing: '-0.02em', fontWeight: '700' },
        ], // 24
        corpo: ['1rem', { lineHeight: '1.6' }], // 16
        'corpo-sm': ['0.9375rem', { lineHeight: '1.6' }], // 15
        legenda: ['0.8125rem', { lineHeight: '1.5' }], // 13
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
    },
  },
  plugins: [animate],
} satisfies Config;
