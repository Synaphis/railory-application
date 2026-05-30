import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ── Brand & Accent ───────────────────── */
        "cohere-black": "#000000",
        "near-black": "#17171c",
        "deep-green": "#003c33",
        "dark-navy": "#071829",
        "action-blue": "#1863dc",
        coral: "#ff7759",
        "soft-coral": "#ffad9b",

        /* ── Surface & Background ─────────────── */
        canvas: "#ffffff",
        stone: "#eeece7",
        "pale-green": "#edfce9",
        "pale-blue": "#f1f5ff",
        "card-border": "#f2f2f2",

        /* ── Text & Rules ─────────────────────── */
        ink: "#212121",
        "muted-slate": "#93939f",
        slate: "#75758a",
        hairline: "#d9d9dd",
        "border-light": "#e5e7eb",

        /* ── Semantic ─────────────────────────── */
        "focus-blue": "#4c6ee6",
        "form-focus-violet": "#9b60aa",
        "error-red": "#b30000",
      },

      fontFamily: {
        display: ["var(--font-display)", "Space Grotesk", "Inter", "ui-sans-serif", "system-ui"],
        sans: ["var(--font-sans)", "Inter", "Arial", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },

      fontSize: {
        /* Typography hierarchy — [size, { lineHeight, letterSpacing }] */
        "hero-display": [
          "96px",
          { lineHeight: "1.00", letterSpacing: "-1.92px" },
        ],
        "product-display": [
          "72px",
          { lineHeight: "1.00", letterSpacing: "-1.44px" },
        ],
        "section-display": [
          "60px",
          { lineHeight: "1.00", letterSpacing: "-1.2px" },
        ],
        "section-heading": [
          "48px",
          { lineHeight: "1.20", letterSpacing: "-0.48px" },
        ],
        "card-heading": [
          "32px",
          { lineHeight: "1.20", letterSpacing: "-0.32px" },
        ],
        "feature-heading": [
          "24px",
          { lineHeight: "1.30", letterSpacing: "0" },
        ],
        "body-lg": ["18px", { lineHeight: "1.40", letterSpacing: "0" }],
        body: ["16px", { lineHeight: "1.50", letterSpacing: "0" }],
        btn: ["14px", { lineHeight: "1.71", letterSpacing: "0" }],
        caption: ["14px", { lineHeight: "1.40", letterSpacing: "0" }],
        "mono-label": [
          "14px",
          { lineHeight: "1.40", letterSpacing: "0.28px" },
        ],
        micro: ["12px", { lineHeight: "1.40", letterSpacing: "0" }],
      },

      borderRadius: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "22px",
        xl: "30px",
        pill: "32px",
        full: "9999px",
      },

      letterSpacing: {
        tightest: "-0.03em",
        tighter: "-0.02em",
        tight: "-0.01em",
        normal: "0",
        wide: "0.02em",
      },

      spacing: {
        "4.5": "18px",
        "13": "52px",
        "15": "60px",
        "18": "72px",
        "22": "88px",
      },

      animation: {
        shimmer: "shimmer 2s linear infinite",
        "fade-in": "fadeIn 0.3s ease-out",
        "fade-in-up": "fadeInUp 0.4s ease-out",
        "slide-in": "slideIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s cubic-bezier(0.16,1,0.3,1)",
        "image-in": "imageIn 0.4s ease-out",
      },
      keyframes: {
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translateX(-8px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        slideUp: {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        imageIn: {
          "0%": { opacity: "0", transform: "scale(1.05)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
