# Taste Design Principles

Premium frontend design system adapted from the taste-skill project. These principles ensure
the frontend looks like it was built by a high-end design studio, not auto-generated.

Source: https://github.com/Leonxlnx/taste-skill

## Table of Contents

1. [Configuration Dials](#configuration-dials)
2. [Typography](#typography)
3. [Color System](#color-system)
4. [Layout Rules](#layout-rules)
5. [Motion & Animation](#motion--animation)
6. [Interactive States](#interactive-states)
7. [Anti-Slop Rules](#anti-slop-rules)
8. [Advanced UI Patterns](#advanced-ui-patterns)
9. [Performance Guardrails](#performance-guardrails)
10. [Pre-Flight Checklist](#pre-flight-checklist)

---

## Configuration Dials

Three global settings control the design intensity. These are defaults — override per project:

- **DESIGN_VARIANCE: 8** (1=Perfect Symmetry, 10=Artsy Chaos)
- **MOTION_INTENSITY: 6** (1=Static, 10=Cinematic)
- **VISUAL_DENSITY: 4** (1=Art Gallery/Airy, 10=Cockpit/Packed)

### What the dials mean in practice

**DESIGN_VARIANCE:**
- 1-3: Centered flexbox, symmetric 12-column grids
- 4-7: Overlapping elements (`margin-top: -2rem`), varied aspect ratios
- 8-10: Masonry layouts, CSS Grid with fractional units (`2fr 1fr 1fr`)
- Mobile override: Asymmetric layouts collapse to single-column below `md:`

**MOTION_INTENSITY:**
- 1-3: CSS `:hover` and `:active` only
- 4-7: `transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1)`; animation-delay cascades
- 8-10: Scroll-triggered reveals, parallax via Framer Motion

**VISUAL_DENSITY:**
- 1-3: Generous whitespace, "expensive" aesthetic
- 4-7: Standard app spacing
- 8-10: Cockpit mode — tiny padding, 1px separators, monospace numbers

---

## Typography

### Hierarchy
- Display/Headlines: `text-4xl md:text-6xl tracking-tighter leading-none`
- Body: `text-base text-gray-600 leading-relaxed max-w-[65ch]`

### Font Rules
- **Banned**: Inter (completely banned — it's the #1 AI tell)
- **Use instead**: Geist, Outfit, Cabinet Grotesk, Satoshi
- **Serif**: Forbidden in Dashboard/Software UIs (fine for editorial/marketing pages)

---

## Color System

- Max 1 accent color, saturation < 80%
- **Banned**: "AI Purple/Blue" gradient aesthetic
- **Banned**: Pure black (#000000) — use Zinc-950 or off-black instead
- Maintain single palette consistency across the entire application
- Background: `#f9fafb` for main surfaces
- Cards: Pure white with `border-slate-200/50`

---

## Layout Rules

- **Banned** (when DESIGN_VARIANCE > 4): Centered hero sections
- **Use instead**: Split Screen (50/50), Left-aligned with right assets, Asymmetric whitespace
- **Banned**: 3-column equal card layouts
- **Use instead**: Zig-Zag, asymmetric grid, horizontal scroll
- Mobile collapse mandatory: `w-full px-4 max-w-7xl mx-auto` below 768px
- Grid over flex-math for layouts
- Use `min-h-[100dvh]` instead of `h-screen` (prevents iOS Safari collapse)
- Card surfaces: `rounded-[2.5rem]` with `shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]`
- Generous interior padding: `p-8` or `p-10` inside cards

---

## Motion & Animation

### Spring Physics (mandatory for all animations)
```
type: "spring", stiffness: 100, damping: 20
```

### Framer Motion Patterns
- Use `useMotionValue` and `useTransform` for continuous animations (never `useState`)
- Use `layout` and `layoutId` props for layout transitions
- Wrap dynamic lists in `<AnimatePresence>`
- Staggered orchestration with `staggerChildren`
- Parent and Child variants must be in the same Client Component tree

### Perpetual Micro-Interactions
Every card/section should have at least one looping animation:
- Pulse, Typewriter, Float, Shimmer, or Carousel
- Isolate CPU-heavy animations in their own Client Components

### Scroll Animations (MOTION_INTENSITY > 5)
- Scroll-triggered reveals
- Parallax via Framer Motion (never `window.addEventListener('scroll')`)

---

## Interactive States

Every interactive element MUST have:
- **Loading state**: Skeletal loaders matching the actual layout
- **Empty state**: Clear guidance on what data will populate the view
- **Error state**: Inline form validation, helpful error messages
- **Tactile feedback**: `-translate-y-[1px]` or `scale-[0.98]` on `:active`

---

## Anti-Slop Rules

These are the patterns that make AI-generated UIs look generic. Avoid all of them.

### Visual
- NO neon/outer glows or auto-glows
- NO oversaturated accents
- NO excessive gradient text on headers
- NO custom mouse cursors

### Content (the "Jane Doe" Effect)
- NO generic names (John Doe, Sarah Chan)
- NO generic avatars (standard SVG egg icons)
- NO fake round numbers (99.99%, 50%)
- NO startup slop names (Acme, Nexus, SmartFlow)
- NO filler copywriting (Elevate, Seamless, Unleash, Next-Gen)

### Images
- NO broken Unsplash links — use `picsum.photos/seed/{random}/800/600`
- shadcn/ui must be customized (radii, colors, shadows) — not used with defaults

### Liquid Glass Effect (for premium card surfaces)
- 1px inner border: `border-white/10`
- Inner shadow: `shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]`

---

## Advanced UI Patterns

Use these as inspiration when building complex interfaces:

### Navigation
- Mac OS Dock magnification effect
- Magnetic buttons
- Dynamic Island morphing UI
- Floating speed dial with spring expansion
- Mega menu with staggered reveals

### Cards & Containers
- Parallax tilt tracking mouse coordinates
- Spotlight border illumination on cursor
- Glassmorphism with inner refraction
- Morphing modal expansion from card

### Scroll Effects
- Sticky scroll stack (cards physically stack)
- Horizontal scroll hijack (vertical → horizontal pan)
- Scroll progress with SVG path drawing
- Zoom parallax backgrounds

### Data Display
- Bento Grid (asymmetric, Apple Control Center style)
- Coverflow carousel (3D with focused center)
- Accordion image slider (expand on hover)

### Typography Effects
- Kinetic marquee (endless scrolling text)
- Text mask reveal (large text as transparent window)
- Text scramble (Matrix-style decoding)

### Micro-Interactions
- Particle explosion buttons
- Skeleton shimmer loading
- Directional hover-aware buttons
- Animated SVG line drawing
- Mesh gradient background (lava-lamp blobs)

---

## Performance Guardrails

- Animate ONLY `transform` and `opacity` (never top/left/width/height)
- Grain/noise filters: Fixed `pointer-events-none` pseudo-elements only
- Z-index restraint: Use strictly for systemic layers (navbars, modals, overlays)
- Cleanup functions mandatory in all `useEffect` animations
- Memoize perpetual motion components in isolated Client Components

---

## Pre-Flight Checklist

Before considering the frontend complete, verify:

- [ ] No Inter font anywhere
- [ ] No pure black (#000000) anywhere
- [ ] No centered hero sections (if DESIGN_VARIANCE > 4)
- [ ] No 3-column equal card grids
- [ ] Mobile layout collapse works below 768px
- [ ] Full-height sections use `min-h-[100dvh]`
- [ ] All `useEffect` animations have cleanup functions
- [ ] Empty, loading, and error states for every interactive element
- [ ] Cards omitted where spacing alone suffices
- [ ] shadcn/ui components customized (not default styles)
- [ ] Spring physics used for all Framer Motion animations
- [ ] Accent color saturation < 80%
- [ ] No AI-slop content (generic names, filler copy, etc.)
