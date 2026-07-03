---
name: Industrial Commerce Framework
colors:
  surface: '#f7fafc'
  surface-dim: '#d7dadc'
  surface-bright: '#f7fafc'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f4f6'
  surface-container: '#ebeef0'
  surface-container-high: '#e5e9eb'
  surface-container-highest: '#e0e3e5'
  on-surface: '#181c1e'
  on-surface-variant: '#44474e'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eef1f3'
  outline: '#74777f'
  outline-variant: '#c4c6cf'
  surface-tint: '#465f88'
  primary: '#002046'
  on-primary: '#ffffff'
  primary-container: '#1b365d'
  on-primary-container: '#87a0cd'
  inverse-primary: '#aec7f7'
  secondary: '#006d2f'
  on-secondary: '#ffffff'
  secondary-container: '#5dfd8a'
  on-secondary-container: '#007232'
  tertiary: '#212121'
  on-tertiary: '#ffffff'
  tertiary-container: '#363636'
  on-tertiary-container: '#a09f9e'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d6e3ff'
  primary-fixed-dim: '#aec7f7'
  on-primary-fixed: '#001b3d'
  on-primary-fixed-variant: '#2e476f'
  secondary-fixed: '#66ff8e'
  secondary-fixed-dim: '#3de273'
  on-secondary-fixed: '#002109'
  on-secondary-fixed-variant: '#005322'
  tertiary-fixed: '#e4e2e1'
  tertiary-fixed-dim: '#c8c6c6'
  on-tertiary-fixed: '#1b1c1c'
  on-tertiary-fixed-variant: '#474747'
  background: '#f7fafc'
  on-background: '#181c1e'
  surface-variant: '#e0e3e5'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  container-max: 1440px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style

The design system is engineered for the high-velocity B2B automotive aftermarket in Brazil. It prioritizes utility, rapid recognition of technical data, and professional reliability. The aesthetic is **Industrial Modern**, blending the precision of a technical manual with the efficiency of modern SaaS.

**Target Audience:** Auto parts resellers, workshop owners, and procurement specialists who require high legibility in various lighting conditions (from bright offices to dimly lit stockrooms).

**Visual Principles:**
- **High-Contrast Utility:** Deep blues and sharp whites ensure information is never lost.
- **Rugged Precision:** Clean lines and structured grids reflect the mechanical nature of the product catalog.
- **Action-Oriented:** Vital business triggers (like WhatsApp sharing) are highlighted with culturally resonant colors to drive conversion.

## Colors

The palette is anchored in industrial reliability. 

- **Primary (Industrial Blue):** Used for headers, primary actions, and brand reinforcement. It evokes stability and institutional trust.
- **Secondary (WhatsApp Green):** Reserved exclusively for communication and sharing actions, tapping into the primary business tool used in the Brazilian market.
- **Charcoal & Greys:** Used for technical text and UI borders to maintain a professional, "grease-resistant" clarity.
- **Status Tones:** Standardized Red (#D32F2F) for out-of-stock, Yellow (#FBC02D) for low stock/pending, and Green (#388E3C) for available.

## Typography

This design system utilizes **Inter** for its exceptional legibility and neutral, professional tone. To handle the complexity of automotive SKUs and technical specifications, **JetBrains Mono** is employed for product codes and serial numbers to prevent character confusion (e.g., 0 vs O).

- **Headlines:** Use SemiBold weight to create clear hierarchy in dense parts lists.
- **Product Codes:** Must always use the `code-md` style to ensure part numbers are easily readable for manual entry.
- **Mobile Scaling:** On mobile devices (390px), `headline-lg` should downscale to `headline-md` (20px) to ensure titles do not wrap excessively.

## Layout & Spacing

The layout follows a **Hybrid Grid** approach. 

- **Desktop (1440px):** 12-column grid. Emphasis is on horizontal density for data tables, allowing users to compare multiple part attributes (price, stock, compatibility) at a glance.
- **Mobile (390px):** Single-column fluid layout with a fixed bottom navigation bar. 
- **Density:** The system uses a tight 8px baseline grid to allow for "Information-Dense" views, which are preferred by power users managing large inventories.

## Elevation & Depth

To maintain an industrial and "flat" feel, depth is communicated through **Tonal Layering** and **Structured Outlines** rather than soft shadows.

- **Surface Levels:** The base background is light grey (#F4F7F9). Cards and data containers use a pure white surface with a 1px border (#E1E4E8).
- **Interactive States:** On hover or focus, elements transition from a 1px grey border to a 2px Primary Blue border.
- **Sticky Elements:** The search bar and bottom navigation use a very subtle, tight shadow (0px 2px 4px rgba(0,0,0,0.05)) to indicate they sit above the scrolling content.

## Shapes

The shape language is **Soft (0.25rem)**. This provides a modern touch while maintaining the structural rigidity expected of a B2B industrial tool.

- **Inputs & Buttons:** 4px (0.25rem) corner radius.
- **Badges/Tags:** 2px corner radius to distinguish them from interactive buttons.
- **Product Images:** Should always be housed in a 4px rounded container with a light grey inner stroke.

## Components

### Search & Navigation
- **Sticky Search Bar:** Features a prominent magnifying glass icon and a "Vehicle Filter" shortcut. It remains fixed at the top of both mobile and desktop views.
- **Mobile Bottom Nav:** 4 items (Início, Catálogo, Pedidos, Perfil) with icons and 10px labels.
- **Vehicle Wizard:** A multi-step stepper (Year > Brand > Model > Engine) using large, tappable list items with chevron indicators.

### Data & Catalog
- **Dense Tables (Desktop):** Row height set to 40px. Zebra striping (White / #F9FAFB) for row tracking. Tabular monospaced figures for all pricing and part numbers.
- **Product Cards (Mobile):** Vertical orientation. Top half is the product image; bottom half contains the part name, monospace code, and price.
- **Status Badges:** Small rectangles with a left-aligned colored dot (Green/Yellow/Red) and the source name (e.g., "Iguaçu") in uppercase `label-sm`.

### Actions
- **Action Bars:** Found on product details. Contains two primary buttons: a "Copy Code" button (Charcoal) and a "WhatsApp" button (Green).
- **Primary Button:** High-contrast Primary Blue with White text. Bold 14px weight.
- **Input Fields:** 1px charcoal border, with the label always visible (floating or top-aligned) to assist in high-speed data entry.