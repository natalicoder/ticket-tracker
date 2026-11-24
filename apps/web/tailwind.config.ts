import type { Config } from 'tailwindcss';

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        sunken: token('sunken'),
        line: token('line'),
        'line-strong': token('line-strong'),
        ink: token('ink'),
        'ink-2': token('ink-2'),
        muted: token('muted'),
        accent: token('accent'),
        'accent-ink': token('accent-ink'),
        'accent-soft': token('accent-soft'),
        brand: token('brand'),
        'brand-ink': token('brand-ink'),
        danger: token('danger'),
        'danger-soft': token('danger-soft'),
        success: token('success'),
        warn: token('warn'),
        'warn-soft': token('warn-soft'),
        'st-new': token('st-new'),
        'st-ready': token('st-ready'),
        'st-progress': token('st-progress'),
        'st-accept': token('st-accept'),
        'st-done': token('st-done'),
        'col-new': token('col-new'),
        'col-ready': token('col-ready'),
        'col-progress': token('col-progress'),
        'col-accept': token('col-accept'),
        'col-done': token('col-done'),
        'ty-bug': token('ty-bug'),
        'ty-feature': token('ty-feature'),
        'ty-fix': token('ty-fix'),
      },
      borderRadius: {
        sm: '8px',
        DEFAULT: '10px',
        md: '14px',
        lg: '22px',
        xl: '28px',
      },
      boxShadow: {
        card: '0 1px 2px rgb(var(--shadow) / 0.05)',
        lift: '0 12px 28px -8px rgb(var(--shadow) / 0.28), 0 4px 10px -4px rgb(var(--shadow) / 0.18)',
        pop: '0 16px 48px -12px rgb(var(--shadow) / 0.35), 0 0 0 1px rgb(var(--line) / 1)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'sheet-in': { from: { transform: 'translateX(24px)', opacity: '0' }, to: { transform: 'translateX(0)', opacity: '1' } },
        'pop-in': { from: { transform: 'scale(0.97)', opacity: '0' }, to: { transform: 'scale(1)', opacity: '1' } },
      },
      animation: {
        'fade-in': 'fade-in 120ms ease-out',
        'sheet-in': 'sheet-in 180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'pop-in': 'pop-in 140ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config;
