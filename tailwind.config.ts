import type { Config } from "tailwindcss"

/**
 * Brand tokens — Luca Ramseyer Brand Guidelines v1.0
 * https://luca-ramseyer.github.io/brand/style-guide.html
 */
const brand = {
  paper: "#F4EFE4",
  surface: "#FBF8F1",
  ink: "#211F1C",
  graphite: "#423D37",
  stone: "#857E72",
  red: "#C0473A",
  "red-deep": "#A63B30",
  line: "#DAD2C4",
  moss: "#5B7A52",
} as const

const config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
	],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        ...brand,

        // Semantic aliases so the shadcn primitives speak brand.
        border: brand.line,
        input: brand.line,
        ring: brand.ink,
        background: brand.paper,
        foreground: brand.graphite,
        primary: {
          DEFAULT: brand.ink,
          foreground: brand.paper,
        },
        secondary: {
          DEFAULT: brand.surface,
          foreground: brand.ink,
        },
        destructive: {
          DEFAULT: brand.red,
          foreground: "#FFFFFF",
        },
        muted: {
          DEFAULT: brand.surface,
          foreground: brand.stone,
        },
        accent: {
          DEFAULT: brand.red,
          foreground: "#FFFFFF",
        },
        popover: {
          DEFAULT: brand.surface,
          foreground: brand.ink,
        },
        card: {
          DEFAULT: brand.surface,
          foreground: brand.graphite,
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Cormorant Garamond", "Georgia", "Times New Roman", "serif"],
        sans: ["var(--font-sans)", "Montserrat", "Helvetica Neue", "Arial", "sans-serif"],
      },
      fontSize: {
        // Type scale from the brand guide.
        eyebrow: ["11.5px", { lineHeight: "1.4", letterSpacing: "0.22em" }],
        small: ["13px", { lineHeight: "1.6" }],
        body: ["16px", { lineHeight: "1.75" }],
        h3: ["21px", { lineHeight: "1.3" }],
        h2: ["30px", { lineHeight: "1.15" }],
        h1: ["40px", { lineHeight: "1.15" }],
        display: ["56px", { lineHeight: "1.05" }],
      },
      letterSpacing: {
        label: "0.14em",
        eyebrow: "0.22em",
        wordmark: "0.24em",
      },
      spacing: {
        // 8-point scale.
        s1: "8px",
        s2: "16px",
        s3: "24px",
        s4: "32px",
        s5: "48px",
        s6: "64px",
        s7: "96px",
      },
      maxWidth: {
        column: "920px",
      },
      borderRadius: {
        lg: "3px",
        md: "3px",
        sm: "2px",
      },
      transitionDuration: {
        DEFAULT: "200ms",
      },
      keyframes: {
        rise: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "none" },
        },
      },
      animation: {
        rise: "rise 0.6s ease forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
