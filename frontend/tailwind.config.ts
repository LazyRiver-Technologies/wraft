/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-primary': 'var(--bg-primary)',
        'bg-secondary': 'var(--bg-secondary)',
        'bg-tertiary': 'var(--bg-tertiary)',
        'bg-elevated': 'var(--bg-elevated)',
        'border-default': 'var(--border-default)',
        'border-hover': 'var(--border-hover)',
        'border-active': 'var(--border-active)',
        'brand': 'var(--brand)',
        'brand-hover': 'var(--brand-hover)',
        'brand-muted': 'var(--brand-muted)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-tertiary': 'var(--text-tertiary)',
        'success': 'var(--success)',
        'warning': 'var(--warning)',
        'danger': 'var(--danger)',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)'],
        mono: ['var(--font-geist-mono)'],
      },
      borderRadius: {
        sm: '6px', md: '8px', lg: '12px', xl: '16px',
      },
      boxShadow: {
        'brand': '0 0 0 1px var(--brand)',
        'brand-glow': '0 0 20px var(--brand-glow)',
        'elevated': '0 4px 24px rgba(0,0,0,0.4)',
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease',
        'slide-up': 'slideUp 0.2s ease',
        'pulse-brand': 'pulseBrand 2s infinite',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: { 
          from: { opacity: "0", transform: 'translateY(8px)' }, 
          to: { opacity: "1", transform: 'translateY(0)' } 
        },
        pulseBrand: {
          '0%, 100%': { boxShadow: '0 0 0 0 var(--brand-glow)' },
          '50%': { boxShadow: '0 0 0 6px transparent' },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
}
