# Morphié Design System

Complete reference for building the iOS app. Every value is extracted from the live Next.js web codebase — fonts, colours, spacing, component patterns, animations, and the editorial rules that tie them together.

---

## 1. Brand Identity

| Attribute | Value |
|-----------|-------|
| Name | **Morphié** (accent on the é) |
| Tagline | "Describe the vibe. Get the outfit. Shop instantly." |
| Personality | Editorial, sharp, confident — fashion magazine meets AI tool |
| Shape language | **All sharp corners. No rounded corners anywhere.** |
| Logo mark | Black square (`w-6 h-6` / `w-8 h-8`) containing a white Lucide `Sparkles` icon |
| Logo text | `font-display text-lg font-medium tracking-tight` — "Morphié" |
| Selection colour | `rgba(229, 231, 250, 1)` (lavender) on landing, `rgba(255, 119, 89, 0.15)` (coral tint) in app |

---

## 2. Typography

Three font families. Each has a specific role.

### Font Stack

| Role | Family | Weights | iOS Equivalent |
|------|--------|---------|----------------|
| **Display** | Space Grotesk | 300, 400, 500, 600, 700 | Bundle Space Grotesk via Google Fonts. Fallback: SF Pro Display |
| **Body (sans)** | Inter | 300, 400, 500, 600 | Bundle Inter. Fallback: SF Pro Text |
| **Mono** | JetBrains Mono | 400, 500 | Bundle JetBrains Mono. Fallback: SF Mono |

### Loading (Root Layout)

Loaded via `next/font/google` with CSS variables:
- `--font-display` → Space Grotesk
- `--font-sans` → Inter
- `--font-mono` → JetBrains Mono

### Type Scale

| Token | Size | Line Height | Letter Spacing | Usage |
|-------|------|-------------|----------------|-------|
| hero-display | 96px | 1.00 | -1.92px | Landing hero headline |
| product-display | 72px | 1.00 | -1.44px | — |
| section-display | 60px | 1.00 | -1.20px | Section headlines (md+), empty-state glyph |
| section-heading | 48px | 1.20 | -0.48px | Section headlines (mobile) |
| card-heading | 32px | 1.20 | -0.32px | Card titles, page headings (Profile, Saved, History, Auth) |
| feature-heading | 24px | 1.30 | 0 | Feature titles, technology card titles, empty-state text |
| body-lg | 18px | 1.40 | 0 | Prominent body text, technology card body |
| body | 16px | 1.50 | 0 | Default body, footer links, pricing features |
| btn | 14px | 1.71 | 0 | Button labels (nav-size), filter toggles |
| caption | 14px | 1.40 | 0 | Secondary labels, testimonial roles |
| mono-label | 14px | 1.40 | 0.28px | Monospace labels (uppercase) |
| micro | 12px | 1.40 | 0 | Smallest text, user email, sign-out |

### Type Patterns (Landing)

- **Section eyebrow**: `font-mono`, 12–18px, `UPPERCASE`, tracking 0.54–0.60px, colour `black/40` or `black/50`
- **Section headline**: `font-display`, `font-medium`, 48px mobile → 64–86px desktop, tracking tight (-0.96 to -1.72px), leading 1.00–1.10
- **Body paragraph**: `font-light` (300 weight), 20–26px, leading 1.35, tracking -0.26px, colour `black/80`
- **CTA button text**: `font-medium`, 18–20px, leading 1.40, tracking -0.10px
- **Footer column header**: `font-mono`, 12px, `UPPERCASE`, tracking 0.60px, colour `black/40`
- **Footer body links**: 16px, `font-light`, leading 1.45, colour `black/80`

### Type Patterns (App)

- **Page heading**: `font-display text-card-heading font-medium text-near-black` (32px)
- **Section label**: `text-xs font-mono text-muted-slate uppercase tracking-wider` (12px)
- **Form label**: `text-xs font-medium text-ink` (12px)
- **Input text**: `text-sm text-ink` (14px)
- **Placeholder**: `text-sm text-muted-slate` (14px)
- **Metadata / counts**: `text-xs text-muted-slate` (12px)
- **Item role tag**: `text-xs font-mono text-coral uppercase tracking-wider` (12px)

---

## 3. Colour Palette

### Core

| Token | Hex | CSS Variable | Usage |
|-------|-----|-------------|-------|
| Black | `#000000` | `--cohere-black` | Primary text, primary buttons, nav elements |
| White / Canvas | `#FFFFFF` | `--canvas` | Backgrounds, button text on dark |
| Near Black | `#17171C` | `--near-black` | App text, app buttons, sidebar text |
| Ink | `#212121` | `--ink` | Default body text |
| Dark Navy | `#1A1D2D` | — | Dark section background (FutureVision only) |

### App Accent Colours

| Token | Hex | CSS Variable | Usage |
|-------|-----|-------------|-------|
| Action Blue | `#1863DC` | `--action-blue` | Links ("Shop →", "View on store →"), auth links |
| Coral | `#FF7759` | `--coral` | Item role tags, photo tips bullet |
| Soft Coral | `#FFAD9B` | `--soft-coral` | — |
| Deep Green | `#003C33` | `--deep-green` | "Saved" confirmation text |
| Focus Blue | `#4C6EE6` | `--focus-blue` | Focus ring outline |
| Error Red | `#B30000` | `--error-red` | Form errors |

### Surface Colours

| Token | Hex | CSS Variable | Usage |
|-------|-----|-------------|-------|
| Stone | `#EEECE7` | `--stone` | Active nav item bg, summary panels, photo guidelines bg, avatar fallback bg |
| Pale Green | `#EDFCE9` | `--pale-green` | Saved outfit button bg |
| Pale Blue | `#F1F5FF` | `--pale-blue` | — |
| Card Border | `#F2F2F2` | `--card-border` | Card borders, collage grid gaps, skeleton bg |

### Border / Rule Colours

| Token | Hex | CSS Variable | Usage |
|-------|-----|-------------|-------|
| Hairline | `#D9D9DD` | `--hairline` | All borders in app UI, input borders |
| Border Light | `#E5E7EB` | `--border-light` | — |
| Muted Slate | `#93939F` | `--muted-slate` | Inactive nav text, placeholder text, secondary labels |

### Text Opacity Scale (Landing Only)

Used extensively instead of grey tokens:

| Pattern | Usage |
|---------|-------|
| `black` (100%) | Headlines, primary text |
| `black/90` | Hero body text |
| `black/80` | Section body text |
| `black/70` | Card body text, avatar initials, secondary descriptions |
| `black/60` | Muted interactive text, login link, pricing inactive tab |
| `black/50` | Section eyebrow labels |
| `black/40` | Footer column headers, faint labels, placeholder labels |
| `black/30` | Placeholder text in landing elements |
| `black/10` | Card borders (`border-black/10`), nav grid lines |
| `black/5` | Barely-visible borders, header border, hero section CTA outline |

### Section Background Tints (Landing)

Every landing section uses a distinct pastel tint:

| Token | Hex | Section / Usage |
|-------|-----|-----------------|
| Lavender | `#E5E7FA` | Hero bg, FinalCta bg, Pricing "Most popular" badge, avatars (SK), style tile, GitHub social icon |
| Mint | `#E5F5E6` | HowItWorks bg, checkmarks, brand nodes, style tile, Twitter/X social icon |
| Soft Green | `#E0F2E9` | Testimonials bg, product tags, "Interaction" step bg |
| Peach | `#FFE0D9` | CrossBrand bg, brand nodes, style tile, avatar (ER), YouTube social icon |
| Blush | `#FCE4EC` | Ecosystem bg, Instagram social icon, brand nodes |
| Cream | `#FDF4EB` | ProblemStatement bg, brand nodes, style tile, "Vibe" step bg, step number "1" bg |

### Floating Icon Accent Colours (Hero)

| Icon | Colour |
|------|--------|
| Shirt | `#FF8B7B` |
| Glasses | `#4CAF50` |
| ShoppingBag | `#E91E63` |
| Watch | `#009688` |
| Camera | `#FF9800` |
| Briefcase | `#795548` |
| Wallet | `#607D8B` |
| Scissors | `#000000` |

---

## 4. Spacing & Layout

### Grid

| Context | Max Width | Padding |
|---------|-----------|---------|
| Full-bleed sections | `1440px` | `16px` (px-4) mobile, `32px` (px-8) desktop |
| Content sections | `1280px` | `24px` (px-6) |
| Marketing body content | `768px` (max-w-3xl) | `24px` |
| Auth forms | `384px` (max-w-sm) | `24px` (px-6) |
| App content | No max | `32px` (px-8) for page content |

### Section Spacing (Landing)

| Between sections | Mobile | Desktop |
|-----------------|--------|---------|
| Standard gap | `96px` (h-24) | `128px` (h-32) |
| Section internal padding | `96px` top/bottom (py-24) | `128px` top/bottom (py-32) |
| Section horizontal padding | `24px` (px-6) | `96px` (px-24) |

### Custom Spacing Tokens

| Token | Value |
|-------|-------|
| 4.5 | 18px |
| 13 | 52px |
| 15 | 60px |
| 18 | 72px |
| 22 | 88px |

---

## 5. Component Patterns

### Buttons

All buttons are **sharp rectangles** (0px border-radius).

| Variant | Style | Used In |
|---------|-------|---------|
| **Primary Large** | `bg-black text-white`, `px-8 py-5`, `text-[20px] font-medium`, hover `bg-black/90`, `shadow-xl hover:shadow-2xl` | Hero CTAs |
| **Primary Standard** | `bg-black text-white`, `px-6 py-4`, `text-[20px] font-medium`, hover `bg-black/90` | Section CTAs, pricing CTAs |
| **Primary Nav** | `bg-black text-white`, `px-5 py-2.5`, `text-[14px] font-medium`, hover `bg-black/90` | Nav "Get started" |
| **Primary App** | `bg-near-black text-white`, `px-6 py-2.5`, `text-sm font-medium`, hover `bg-ink`, disabled `opacity-40` | Generate, Save Profile, Try On |
| **Secondary Large** | `bg-white text-black`, `border border-black/5`, `shadow-xl`, hover `bg-white/90` | Hero "See how it works" |
| **Secondary App** | `border border-hairline text-muted-slate`, hover `border-near-black text-ink`, `bg-canvas` | Filter toggles, session buttons |
| **Ghost** | No bg, `text-black hover:bg-black/5` | Nav "Log in" |
| **Inverse** (dark bg) | `bg-white text-[#1A1D2D]`, hover `bg-white/90` | FutureVision CTA, Pro pricing CTA |
| **Outline App** | `border border-near-black text-near-black bg-canvas`, hover `bg-near-black text-white` | "Try On" button |
| **Saved State** | `border-deep-green text-deep-green bg-pale-green` | "Saved" button |

### Cards

- **Standard card**: `bg-white`, `border border-black/5` or `border-black/10`, `shadow-sm`, padding `p-8` or `p-10`
- **Feature card**: Same as standard + `hover:shadow-[0_4px_24px_rgba(0,0,0,0.06)] transition-shadow`
- **Highlighted card** (Pro pricing): `bg-black text-white`, `border-black`
- **Dark card** (FutureVision): `bg-white/5`, `border border-white/10`, `backdrop-blur-sm`
- **Ecosystem dark card** (Retailers): `bg-black text-white`, `shadow-xl`
- **Outfit card** (App): `border border-card-border bg-canvas`, no shadow, `animate-fade-in`
- **No rounded corners on any card**

### Outfit Card (App — Most Critical for iOS)

Structure from top to bottom:
1. **Image collage** — adaptive grid based on item count:
   - 1 item: full width, natural aspect ratio
   - 2 items: 2-col grid with 1px gaps (`bg-card-border`)
   - 3 items: 2 on top + 1 full width bottom
   - 4 items: 2x2 grid
   - Each product image: `object-cover`, `group-hover:scale-105 transition-transform duration-300`
   - Multi-image badge: `bg-black/60 text-white text-[10px] px-1.5 py-0.5 font-mono`
2. **Content** (`p-5`):
   - AI reasoning: `text-muted-slate text-xs leading-relaxed italic`
   - Total: `font-mono text-muted-slate uppercase tracking-wide` label + `font-display text-lg font-medium text-near-black tracking-tight` price
   - Items list: separated by `border-t border-hairline pt-4`
     - Role tag: `text-xs font-mono text-coral tracking-wider uppercase`
     - Separator: `text-hairline` dot
     - Brand: `text-xs text-muted-slate`
     - Product name: `text-xs font-medium text-ink`, click opens gallery
     - Price: `text-xs text-muted-slate`
     - Action links: "Photos" (`text-muted-slate hover:text-ink`), "Shop" (`text-action-blue hover:underline`)
3. **Action buttons** (`mt-5 flex gap-2`):
   - "Try On": outline button
   - "Save": hairline border, toggles to green saved state

### Outfit Card Skeleton

```
w-80, border border-card-border bg-canvas
  2x2 grid of skeleton squares
  p-5 space-y-3
    skeleton h-3 w-3/4
    skeleton h-3 w-1/2
    4 rows of skeleton h-3
    skeleton h-9 w-full (button)
```

### Image Gallery Modal

Full-screen overlay:
- Backdrop: `bg-black/70`
- Layout: flex row (image left, sidebar right)
- Close button: `w-9 h-9 bg-white/10 hover:bg-white/20 text-white`
- Arrow navigation: same styling, positioned absolute left/right center
- Image counter: `bg-black/50 text-white text-xs px-3 py-1.5 font-mono`
- Sidebar (`w-72 bg-canvas`):
  - Product name: `text-sm font-medium text-ink`
  - Store link: `text-xs font-medium text-action-blue hover:underline`
  - Thumbnail grid: 3-col, `border-2` active: `border-near-black`, inactive: `border-transparent hover:border-muted-slate`

### Avatar Badges

Used for testimonials and try-on avatar selection:

```
w-11 h-11 (or w-12 h-12)
flex items-center justify-center
background: pastel tint (#E5E7FA, #E5F5E6, #FFE0D9)
font-mono text-[13px] font-medium text-black/70
content: initials (SK, DM, ER)
sharp corners — no rounding
```

### Social Icon Buttons (Footer)

```
w-12 h-12
pastel background (each icon different tint):
  Instagram: #FCE4EC (blush)
  Twitter/X: #E5F5E6 (mint)
  YouTube: #FFE0D9 (peach)
  GitHub: #E5E7FA (lavender)
hover: bg-black text-white
transition-colors
sharp corners
framer-motion hover: y: -5, scale: 1.1, rotate wiggle
```

### Section Eyebrow Pattern (Landing)

Every landing section follows this structure:
1. **Eyebrow** — mono, uppercase, small, muted
2. **Headline** — display font, medium weight, large, tight tracking
3. **Body** — light weight, larger size, muted
4. **CTA** (optional) — primary or secondary button

### Pricing Toggle

- Container: `inline-flex bg-black/5 p-1`
- Active tab: `bg-black text-white px-5 py-2.5 text-[14px] font-medium`
- Inactive tab: `text-black/60 hover:text-black px-5 py-2.5 text-[14px] font-medium`
- No border-radius
- "Save 30%+" badge: `text-[11px] font-mono uppercase tracking-wider`

### Pricing Card

- Container: `border p-8 md:p-10 relative h-full flex flex-col`
- Normal: `border-black/15 bg-white text-black`
- Highlighted (Pro): `border-black bg-black text-white`
- "Most popular" badge: `absolute -top-3 left-8 bg-[#E5E7FA] px-3 py-0.5`, `font-mono text-[11px] uppercase tracking-widest text-black`
- Plan name: `text-[24px] font-display font-medium`
- Price: `text-[48px] font-display font-medium leading-none`
- Period: `text-[16px] font-light text-black/50 or text-white/50`
- Yearly note: `text-[13px] font-light text-black/40 or text-white/40`
- Description: `text-[15px] font-light text-black/60 or text-white/70`

### Feature List Checkmarks

```
w-5 h-5
normal: bg-[#E5F5E6] (mint)
highlighted: bg-white/10
flex items-center justify-center
text-[11px] "check" character
sharp corners
```

### Testimonial Card

```
p-10 bg-white shadow-sm border border-black/5 h-full flex flex-col
  Quote: text-[20px] font-light text-black/80 leading-[1.45] italic, flex-1
  Author row: flex items-center gap-4
    Avatar badge (w-11 h-11, pastel bg, monospace initials)
    Name: font-medium text-black
    Role: text-[14px] text-black/50
```

### Editorial Style Tiles

```
Grid: 2x2 gap-4
Each tile:
  p-8 border border-black/10
  pastel bg (Cream, Mint, Lavender, Peach)
  text-[18px] font-mono uppercase tracking-[0.54px] text-black/60
  flex items-end h-40
  hover: darker pastel bg + text-black
  transition-colors cursor-default
```

### Carousel / Horizontal Scroll (App)

- Container: `flex gap-6 overflow-x-auto snap-x snap-mandatory scroll-smooth`, `scrollbar-width: none`
- Each card: `snap-start flex-shrink-0 w-80`
- Navigation arrows: `w-9 h-9 bg-canvas border border-hairline text-ink hover:border-ink shadow-sm`
- Dot indicators: active `w-5 h-1 bg-near-black`, inactive `w-1.5 h-1 bg-hairline hover:bg-muted-slate`

### Empty States (App)

Pattern used across Saved, History, and Generate:
```
flex flex-col items-center justify-center py-24
  Icon container: w-16 h-16 bg-stone, centered emoji
  Title: font-display text-feature-heading font-medium text-ink
  Subtitle: text-muted-slate text-sm
  (Generate only) Example prompt buttons:
    px-5 py-2.5 border border-hairline text-sm text-muted-slate
    hover:border-near-black hover:text-ink bg-canvas
```

---

## 6. Auth Screens (Login / Signup)

Both share identical layout:

```
min-h-screen bg-canvas flex flex-col items-center justify-center px-6
  Logo: font-display text-xl font-medium text-near-black mb-12 (links to "/")
  Form container: w-full max-w-sm
    Heading: font-display text-card-heading font-medium text-near-black
    Subtitle: text-muted-slate text-sm mb-8
    Form fields (space-y-4):
      Label: text-xs font-medium text-ink mb-1.5
      Input: bg-canvas border border-hairline px-4 py-2.5 text-sm text-ink
        placeholder-muted-slate
        focus: border-near-black ring-1 ring-near-black
    Error: text-red-700 text-sm bg-red-50 border border-red-200 px-4 py-3
    Submit: w-full py-2.5 bg-near-black text-white text-sm font-medium
      hover:bg-ink disabled:opacity-50
    Footer link: text-muted-slate text-sm, link in text-action-blue hover:underline
```

**Signup success state**:
- "Check your email" heading
- Email highlighted: `font-medium text-ink`
- "Back to sign in" link: `text-action-blue hover:underline text-sm`

---

## 7. App Chrome (Authenticated)

### TopBar (Current — Mobile-Friendly)

```
h-12 flex-shrink-0 border-b border-hairline bg-canvas
flex items-center justify-between px-6
  Left: logo + inline nav
    Logo: font-display text-base font-medium tracking-tight text-near-black
    Nav: flex gap-1
      Each item: px-3 py-1.5 text-sm
      Active: text-ink font-medium bg-stone
      Inactive: text-muted-slate hover:text-ink
  Right: user email + sign out
    Email: text-muted-slate text-xs
    Sign out: text-xs text-muted-slate hover:text-ink
```

Nav items: Generate, Saved, History, Profile

### Sidebar (Desktop/iPad — 208px)

```
w-52 flex-shrink-0 border-r border-hairline bg-canvas flex flex-col py-5
  Logo area: px-5 mb-8
    font-display text-lg font-medium tracking-tight text-near-black
  Nav: flex-1 px-3 space-y-0.5
    Each item: px-3 py-2 text-sm rounded-sm
    Active: bg-stone text-ink font-medium
    Inactive: text-muted-slate hover:text-ink hover:bg-stone/50
  User area: px-5 pt-5 border-t border-hairline
    Email: text-muted-slate text-xs truncate mb-2.5
    Sign out: text-xs text-muted-slate hover:text-red-600
```

### iOS Mapping

TopBar maps to a custom navigation bar or tab bar. Sidebar maps to iPad sidebar navigation (`NavigationSplitView`). Keep the same minimal, monochrome chrome.

---

## 8. Form Patterns (App)

### Prompt Input (Generate Page)

```
  Textarea: w-full bg-canvas border border-hairline px-4 py-3 text-sm text-ink
    placeholder-muted-slate resize-none leading-relaxed
    focus: border-near-black ring-1 ring-near-black
    Auto-grows to max 200px height
  Below row:
    Hint: text-muted-slate text-xs (Cmd+Enter on web, not needed on iOS)
    Submit button: px-6 py-2.5 bg-near-black text-white text-sm font-medium
      Loading state: inline spinner (w-3.5 h-3.5 border-2 border-white/30
      border-t-white animate-spin) + "Styling..."
```

### Filter Bar (Generate Page)

```
flex items-center gap-6
  Budget: label (mono, uppercase, xs, muted-slate) + min/max inputs
    Inputs: w-16 bg-canvas border border-hairline px-2 py-1.5 text-xs
    text-ink text-center, focus: border-near-black
  Divider: w-px h-5 bg-hairline
  Gender: label + toggle group (Women / Men / Both)
    Toggle: px-3 py-1.5 text-xs border
    Active: border-near-black bg-near-black text-white
    Inactive: border-hairline text-muted-slate hover:border-ink hover:text-ink bg-canvas
```

### Refine Bar (Generate Page, post-results)

```
border-b border-hairline px-6 py-3
max-w-2xl mx-auto flex gap-3
  Input: flex-1 bg-canvas border border-hairline px-4 py-2.5 text-sm
    placeholder: "Refine: swap the jacket for something leather..."
    focus: border-near-black
  Button: px-5 py-2.5 bg-near-black text-white text-sm font-medium
```

### Profile Form

- Section headers: `text-xs font-mono text-muted-slate uppercase tracking-wider mb-4 pb-2 border-b border-hairline`
- Input fields: `w-full bg-canvas border border-hairline px-3 py-2 text-sm text-ink placeholder-muted-slate focus:border-near-black`
- Select fields: same as input + `appearance-none`
- Photo guidelines: `bg-stone px-4 py-3` containing mono header + bullet list with `text-coral` dot bullets
- Upload button: `px-5 py-2.5 text-xs font-medium border border-near-black text-ink hover:bg-stone`
- Avatar preview: `w-36 aspect-[3/4] border border-hairline bg-stone`, with remove button `w-6 h-6`
- Save button: standard primary app button
- Success indicator: `text-xs text-deep-green font-medium` "Saved"

---

## 9. Try-On Modal (App — Full Spec)

Full-screen overlay: `bg-black/70`, centered `max-w-5xl max-h-[90vh]`

**Header**: `px-6 py-4 border-b border-hairline`
- Title: `font-display text-lg font-medium text-near-black`
- Subtitle: `text-xs text-muted-slate`
- Close: `w-8 h-8 text-muted-slate hover:text-ink text-xl`

**Body**: Two-column flex (`lg:flex-row`)

**Left column** (`lg:w-1/2 border-r border-hairline`):
1. Avatar picker:
   - Gender tab bar: `px-3 py-1.5 text-xs font-medium border`, active: `border-near-black text-ink bg-stone`, inactive: `border-hairline text-muted-slate hover:border-ink`
   - Tabs: You, All, Female, Male, Androgynous
   - Avatar grid: 4 columns, each card: `p-2 border`, aspect-[3/4] image + label + description
   - "You" tab: custom avatar or upload prompt linking to `/profile`
2. Garment selector:
   - Checkboxes: `w-4 h-4 border`, checked: `border-near-black bg-near-black` with white check SVG, unchecked: `border-muted-slate`
   - Item rows: `px-3 py-2.5 border`, selected: `border-near-black bg-stone`, normal: `border-hairline`
   - Item thumb: `w-10 h-10 bg-stone`
   - Counter: `text-[10px] text-muted-slate`

**Right column** (`lg:w-1/2 p-5`):
1. Summary panel: `bg-stone px-4 py-3` with avatar/garment count
2. Generate button: full width `py-3 bg-near-black text-white text-sm font-medium`
3. Loading spinner: `w-10 h-10 border-2 border-hairline border-t-near-black animate-spin` (square, not rounded)
4. Angle selector tabs: same toggle pattern as filter bar
5. Result image: `aspect-[3/4] bg-stone`

### Angles

7 viewing angles:

| Key | Label | Icon |
|-----|-------|------|
| front | Front | up arrow |
| back | Back | down arrow |
| left-side | Left | left arrow |
| right-side | Right | right arrow |
| three-quarter | 3/4 | diagonal arrow |
| close-up-top | Top Detail | up bar arrow |
| close-up-bottom | Bottom Detail | down bar arrow |

---

## 10. Section Colour Map (Landing)

Each major section has a background tint creating the visual rhythm:

| Section | Background | Layout |
|---------|------------|--------|
| Nav (absolute overlay) | transparent | Logo left, Log in + Get started right |
| Hero | `#E5E7FA` (lavender) | Centered, full-bleed card within px-4/px-8 wrapper |
| SocialProof | white | Centered, inline logos with "Powered by" label |
| ProblemStatement | `#FDF4EB` (cream) | 2-col: copy left, interactive visual right |
| ProductPreview | white | 4-col step cards with connecting line |
| HowItWorks | `#E5F5E6` (mint) | Centered copy + 3-col feature cards |
| CrossBrand | `#FFE0D9` (peach) | 2-col: copy left, animated node network right |
| VirtualTryOn | white | 2-col: copy+features left, UI mockup right |
| Technology | white | Left-aligned copy + 3-col feature cards |
| FutureVision | `#1A1D2D` (dark navy) | Centered copy + 3-col dark cards |
| Ecosystem | `#FCE4EC` (blush) | Centered copy + 4-col cards (last one dark) |
| Editorial | white | 2-col: copy left, 2x2 style tile grid right |
| Pricing | white | Centered copy + toggle + 3-col pricing cards |
| Testimonials | `#E0F2E9` (soft green) | Centered copy + 3-col quote cards |
| FinalCta | `#E5E7FA` (lavender) | Centered, 2 CTAs |
| Footer | white | 5-col grid + bottom bar with social icons |

Pattern: alternating white and tinted sections, with one dark block (FutureVision) as a visual anchor.

---

## 11. Shadows

| Token | Value | Usage |
|-------|-------|-------|
| sm | `shadow-sm` | Cards, social icons, brand nodes, outline buttons |
| lg | `shadow-lg` | CTA buttons in FinalCta |
| xl | `shadow-xl` | Hero buttons, dark ecosystem card, secondary hero CTA |
| 2xl | `shadow-2xl` | Hero buttons hover, Morphié centre node (CrossBrand) |
| Soft card | `0 4px 24px rgba(0,0,0,0.06)` | Feature cards hover, comparison panels |
| Subtle | `0 4px 24px rgba(0,0,0,0.04)` | HowItWorks step icons |
| None | — | Most app UI cards (outfit cards use only border) |

---

## 12. Animation & Motion

### Scroll-triggered (FadeIn Component)

The `FadeIn` component is used on every landing section. It uses `framer-motion`:

- **Direction**: `up` (default, 40px), `down`, `left` (40px), `right` (-40px), `none`
- **Duration**: 0.8s
- **Easing**: `[0.16, 1, 0.3, 1]` — custom spring-like curve (Apple style)
- **Viewport trigger**: `once: true, margin: "-100px"` (triggers 100px before entering viewport)
- **Delay**: optional `delay` prop

### Stagger (FadeInStaggerItem)

- Children animate sequentially, default 0.1s delay between items (configurable via `staggerDelay`)
- Each item: 0.6s duration, `y: 20` to `y: 0`, same Apple-style easing
- Used in: card grids, feature lists, pricing cards, ecosystem cards

### Ambient Animations

| Element | Animation | Duration | Ease |
|---------|-----------|----------|------|
| **Hero floating icons** | `y: [-20, 20, -20]` + `rotate: [-5, 5, -5]` | 6-10s | easeInOut |
| **ProblemStatement chaos cards** | Random `x`, `y`, `rotate` | 3-5s | linear |
| **ProblemStatement moodboard** | `scale: [1, 1.02, 1]` (breathe) | 3s | easeInOut |
| **CrossBrand nodes** | `y: [-10, 10, -10]` | 4s each, staggered delays | easeInOut |
| **Hero Camera icon** | `scale: [0.95, 1.05, 0.95]` + `rotate: [8, -8, 8]` | 10s | easeInOut |
| **Footer social icons** | Hover: `y: -5, scale: 1.1, rotate: [0, -10, 10, 0]` | 0.3s | — |

### App Transitions

| Element | Transition |
|---------|-----------|
| Colour transitions | `transition-colors` (150ms ease, scoped to interactive elements) |
| Shadow transitions | `transition-shadow` |
| Scale on hover | `hover:scale-105 transition-transform duration-300` (product images) |
| Spin loader | `border-2 border-hairline border-t-near-black animate-spin` (square) |
| Fade in | `animate-fade-in` (0.3s ease-out) |
| Shimmer (skeleton) | Linear gradient sweep, 2s linear infinite |

### iOS Translation

Map to SwiftUI/UIKit:
- FadeIn: `onAppear { withAnimation(.easeOut(duration: 0.8)) { opacity = 1; offset = 0 } }`
- Stagger: `Animation.delay(index * 0.1)`
- Floating: `withAnimation(.easeInOut(duration: 8).repeatForever(autoreverses: true))`
- Breathe: `withAnimation(.easeInOut(duration: 3).repeatForever(autoreverses: true)) { scale = 1.02 }`
- Apple easing `[0.16, 1, 0.3, 1]`: `UICubicTimingParameters(controlPoint1: CGPoint(x: 0.16, y: 1), controlPoint2: CGPoint(x: 0.3, y: 1))`

---

## 13. Icons

Landing page uses [Lucide](https://lucide.dev/) icons exclusively.

### Hero Floating Icons

`Shirt`, `Glasses`, `ShoppingBag`, `Watch`, `Camera`, `Briefcase`, `Scissors`, `Wallet`
- Sizes: `w-16 h-16` mobile, `w-28 h-28` / `w-32 h-32` desktop
- `strokeWidth={1}` (thin line weight)
- `opacity-50` to `opacity-70`

### Section Icons

| Section | Icons | Size |
|---------|-------|------|
| ProblemStatement | `Link2`, `ArrowRight`, `Camera`, `Star`, `Zap`, `Shirt` | Various |
| ProductPreview | `Search`, `Brain`, `Layers`, `RefreshCw` | `w-8 h-8` |

### Nav / Logo

- `Sparkles` — logo accent, inside black square

### Footer Social Icons (Inline SVG)

Instagram, Twitter/X, YouTube, GitHub — all 20x20 inline SVGs with `strokeWidth={2}`

### iOS Mapping

Use SF Symbols where equivalents exist, or bundle Lucide SVGs:
- `Sparkles` → `sparkles`
- `Shirt` → `tshirt` or custom
- `ShoppingBag` → `bag`
- `Camera` → `camera`
- `Search` → `magnifyingglass`
- `Brain` → `brain.head.profile`

---

## 14. Specific Page Layouts

### Generate Page (Most Important for iOS)

```
Full height flex column:
  Error banner (conditional): mx-6 mt-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700
  Main content area (flex-1): px-6 py-8
    OutfitCarousel (horizontal scroll of w-80 cards)
    OR Empty state with example prompts
    OR Loading state (3x skeleton cards)
  Bottom controls (sticky bottom-0, bg-canvas, z-10, border-t border-hairline):
    Refine bar (if results exist)
    Prompt input OR collapsed prompt summary
      Collapsed: flex items-center justify-between
        "Prompt" mono label + truncated text
        "Edit" button
    Sessions drawer (collapsible):
      Toggle: w-full px-6 py-2, mono uppercase label + +/- icon
      Session grid: 4-col of session buttons (prompt + date)
```

### Saved Page

```
px-8 py-6
  Heading: "Saved Looks" (card-heading)
  Grid: 2-col (lg), gap-5
    Each: relative wrapper with remove button (absolute top-3 right-3)
    OutfitCard (without save action)
```

### History Page

```
px-8 py-6
  Heading: "History" (card-heading)
  Grouped by date:
    Date label: text-xs font-medium text-muted-slate mb-3 pb-2 border-b border-hairline
    Accordion list (space-y-1.5):
      Each session: border border-hairline
        Toggle button: w-full px-5 py-3.5, hover:bg-stone/40
          Prompt text: text-sm font-medium text-ink (truncated to 72 chars)
          Meta: text-xs text-muted-slate "N outfits . date"
          +/x indicator: text-muted-slate text-lg, rotates 45deg when expanded
        Expanded panel: border-t border-hairline bg-stone/20 px-5 py-4
          Grid: 1/2/4-col of OutfitCards
```

### Profile Page

```
px-8 py-6 max-w-3xl
  Heading: "Profile" (card-heading) + subtitle
  Section: Try-On Avatar
    Avatar preview (w-36) with remove button
    Upload area with photo guidelines
    Upload/Change button
  Section: Body Details
    2-col grid of form fields (height, weight, body type, gender presentation,
    skin tone, hair length, hair colour, age range)
  Save button with saved/error indicators
```

---

## 15. Marketing Pages (About, Contact, Privacy, Terms)

All share a common layout from `(marketing)/layout.tsx`:

```
min-h-screen bg-white text-black font-sans flex flex-col
  Header: px-6 md:px-10 py-4 flex items-center justify-between border-b border-black/5
    Logo: font-display text-xl font-medium tracking-tight text-black (links to "/")
    Actions:
      "Sign in": text-sm text-black/60 hover:text-black px-4 py-2 (links to /login)
      "Get started": text-sm font-medium bg-black text-white px-5 py-2.5 hover:bg-black/90
        (links to /signup)
  Main content: flex-1
    Content: max-w-3xl (or max-w-2xl for Contact)
    px-6 py-16 md:py-24
    Heading: font-display, 40-64px
    Body: 17-19px, font-light, leading 1.55-1.65
  Footer: Full landing page Footer component
```

---

## 16. Global CSS

### Base Reset

- Box-sizing: border-box on everything
- No default padding/margin
- `overflow-x: hidden` on html/body
- `font-family: 'Inter', Arial, ui-sans-serif, system-ui, sans-serif`
- `-webkit-font-smoothing: antialiased`
- `font-size: 16px`, `line-height: 1.5`

### Interactive Element Transitions

All `a`, `button`, `input`, `textarea`, `select`, `[role="button"]` get:
```css
transition-property: color, background-color, border-color, opacity, transform, box-shadow;
transition-duration: 150ms;
transition-timing-function: ease;
```

### Scrollbar

- Width/height: 4px
- Track: `#f2f2f2` (card-border)
- Thumb: `#d9d9dd` (hairline), hover: `#93939f` (muted-slate)
- `border-radius: 9999px` (the ONLY rounded element in the entire system)

### Focus Ring

```css
:focus-visible {
  outline: 2px solid #4C6EE6; /* focus-blue */
  outline-offset: 2px;
}
```

### Form Input Focus

```css
border-color: #17171C; /* near-black */
box-shadow: 0 0 0 1px #17171C;
outline: none;
```

### Selection Highlight

```css
::selection {
  background: rgba(255, 119, 89, 0.15); /* coral tint */
  color: #212121;
}
```

---

## 17. Design Rules

1. **No rounded corners** — every element (buttons, cards, inputs, avatars, images, modals, spinners, checkboxes) uses sharp 0px radius. This is the single most distinctive visual rule. The ONLY exception is the scrollbar thumb (browser chrome).

2. **Light weight body text** — body copy is always `font-weight: 300` (light). Only headings and buttons use medium (500) or bold (700).

3. **Opacity over grey** — instead of separate grey colour tokens, use `black` with opacity (`/80`, `/50`, `/40`, etc) on the landing page. The app uses named tokens (`muted-slate`, `hairline`).

4. **Monospace for labels** — section eyebrows, tags, metadata, item roles, step counters, and small labels use the mono font in uppercase with wide tracking.

5. **Pastel tints, not saturated colours** — backgrounds use soft pastels. The only saturated colours are the Lucide icon accents in the Hero and the functional colours (coral, action-blue).

6. **One dark section** — the FutureVision block (`#1A1D2D`) is the only dark-background section. Everything else is white or pastel.

7. **Editorial spacing** — generous whitespace. Sections have 96-128px vertical padding. Content maxes out at 1280px.

8. **Shadow restraint** — most cards use `shadow-sm` or no shadow. Larger shadows are reserved for hero CTAs and hover states. App outfit cards use NO shadow, just a `border-card-border`.

9. **No decorative borders** — borders are `border-black/5` (barely visible) or `border-black/10` for more definition on landing. App uses `border-hairline` (#D9D9DD). Never coloured borders.

10. **Consistent CTA sizing** — large CTAs are `px-6 py-4 text-[20px]` or `px-8 py-5 text-[20px]`, nav CTAs are `px-5 py-2.5 text-[14px]`.

11. **Two visual systems** — Landing page uses the black/opacity system with pastel tints. The app uses the named token system (near-black, ink, muted-slate, hairline, stone, etc). Both share the same fonts and shape language.

12. **Coral for emphasis** — in the app, `coral` (#FF7759) is used specifically for item role tags and accent dots. `Action Blue` (#1863DC) is used for links and interactive text.

---

## 18. iOS Mapping Cheat Sheet

| Web Pattern | iOS Equivalent |
|-------------|----------------|
| `font-display` | `Font.custom("SpaceGrotesk", size:)` or `.title.weight(.medium)` |
| `font-sans font-light` | `.body.weight(.light)` with Inter |
| `font-mono uppercase tracking-wide` | `Font.custom("JetBrainsMono", size:).uppercaseSmallCaps()` |
| `bg-black text-white` button | `.buttonStyle(.borderedProminent).tint(.black)` |
| `bg-near-black text-white` button | Same but with `Color("NearBlack")` |
| `border border-black/5` | `.overlay(Rectangle().stroke(Color.black.opacity(0.05)))` |
| `border border-hairline` | `.overlay(Rectangle().stroke(Color("Hairline")))` |
| `shadow-sm` | `.shadow(color: .black.opacity(0.04), radius: 2, y: 1)` |
| `shadow-[0_4px_24px_rgba(0,0,0,0.06)]` | `.shadow(color: .black.opacity(0.06), radius: 12, y: 4)` |
| `transition-colors` | `withAnimation(.easeInOut(duration: 0.15))` |
| `FadeIn` on scroll | `onAppear { withAnimation(.easeOut(duration: 0.8)) { opacity = 1; offset = 0 } }` |
| Pastel tint background | `Color(hex: "#E5E7FA")` — define as Color extension |
| `text-black/50` | `Color.black.opacity(0.5)` |
| `text-muted-slate` | `Color("MutedSlate")` from asset catalog |
| `overflow-x-hidden` | `.clipped()` |
| `snap-x snap-mandatory` | `ScrollView(.horizontal) { LazyHStack { } }` with `.scrollTargetBehavior(.viewAligned)` |
| `animate-spin` | `.rotationEffect(.degrees(360))` with `.animation(.linear(duration: 1).repeatForever(autoreverses: false))` |
| `animate-fade-in` | `.transition(.opacity.animation(.easeOut(duration: 0.3)))` |
| Skeleton shimmer | `ShimmerView` with linear gradient + offset animation |
| `max-w-sm` centered form | VStack with `.frame(maxWidth: 384)` centered in screen |
| TopBar | Custom navigation bar or native `toolbar` |
| Sidebar (iPad) | `NavigationSplitView` with 208pt sidebar |
| Bottom sticky controls | `.safeAreaInset(edge: .bottom)` |
| Horizontal carousel | `ScrollView(.horizontal) { LazyHStack(spacing: 24) { } }` |

---

## 19. Pricing Data

| Plan | Monthly | Yearly | Highlight |
|------|---------|--------|-----------|
| Starter | 9/mo | 79/yr (6.58/mo) | — |
| Pro | 19/mo | 149/yr (12.42/mo) | Most popular (black card) |
| Enterprise | Custom | Custom | — |

Currency: GBP

Features per plan:
- **Starter**: 50 generations, 3 try-on angles, 50 saved looks, 30-day history
- **Pro**: 200 generations, 7 try-on angles, custom avatars, 500 saved looks, advanced style memory, full history, priority processing
- **Enterprise**: Everything in Pro + API access, teams, fine-tuning, SLA, white-label

Trial: 14-day free, no credit card required. Early adopters grandfathered at current rate.

---

## 20. Try-On System

### Avatars

- 12 preset avatars across genders (female, male, androgynous)
- Custom user avatar uploaded via Profile page
- Avatar image format: 3:4 aspect ratio
- Avatar card: image + label (11px medium) + description (9px muted-slate)

### Garment Selection

- All outfit items selected by default
- Minimum 1 item must remain selected
- Toggle individual items or "Select all" / "Deselect all"
- Shows `N of M items selected` counter

---

## 21. Cross-Brand Node Network (Visual Spec)

The CrossBrand section features an animated node network:

### Brand Nodes

12 brand nodes positioned absolutely with pastel backgrounds:

```
Zara (Mint), COS (Lavender), SSENSE (Cream), Uniqlo (Soft Green),
Nike (Mint), Aritzia (Blush), Reformation (Mint), Supreme (Lavender),
Levi's (Cream), New Balance (Peach), H&M (Soft Green), Carhartt (Blush)
```

Each: `px-4 md:px-6 py-2 md:py-3`, `text-[12px] md:text-[14px] font-mono font-medium`, pastel bg, `shadow-sm`

### Centre Node (Morphie)

```
absolute center, transform -translate-x/y-1/2
px-4 py-2.5 md:px-5 md:py-3
bg-black text-white
font-display text-base md:text-lg
z-10 shadow-2xl
```

### Connection Lines

SVG lines from each brand node to centre, `stroke="black" strokeWidth="2" opacity-[0.15]`

---

## 22. Background Patterns

### Hero Grid Pattern

Subtle dot grid behind floating icons:
```css
background-image: radial-gradient(#00000008 1px, transparent 1px);
background-size: 48px 48px;
```

### ProductPreview Connecting Line

Horizontal line behind step icons on desktop:
```
absolute top-12 left-12 right-12 h-[1px] bg-black/5 z-0
```

---

## 23. File Reference

| Directory | Contains |
|-----------|----------|
| `components/landing/` | 16 landing page section components |
| `components/marketing/` | 4 marketing page content components + Footer re-export |
| `components/ui/` | FadeIn, Badge, Button, Parallax, Skeleton, SmoothScroll |
| `components/` (root) | App-specific: Sidebar, TopBar, OutfitCard, OutfitCarousel, TryOnModal, PromptInput, FilterBar |
| `app/(app)/` | Authenticated app routes: generate, saved, history, profile |
| `app/(auth)/` | Login and signup pages |
| `app/(marketing)/` | About, contact, privacy, terms with shared layout |
| `tailwind.config.ts` | Full theme definition (colours, fonts, spacing, animations) |
| `app/globals.css` | Tailwind directives, CSS variables, base reset, scrollbar, focus, selection |
| `app/layout.tsx` | Root layout with font loading (Space Grotesk, Inter, JetBrains Mono) |
