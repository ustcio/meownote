# Claude AI Website - Complete Resource Catalog

## Overview
This document catalogs all extracted resources from the Claude AI website (claude.ai and anthropic.com), including design tokens, typography, colors, components, and layout systems.

---

## 📁 File Structure

```
extracted-claude-website/
├── analysis.json              # Extraction metadata
├── resource-catalog.json      # Complete resource catalog (JSON)
├── design-tokens.css          # CSS custom properties
├── fonts.css                  # Font-face declarations
├── components.css             # UI component styles
├── layout.css                 # Grid and layout utilities
├── www-anthropic-com-.html    # Extracted HTML (compressed)
└── README.md                  # This file
```

---

## 🎨 Color Palette

### Primary Colors
| Name | Hex | Usage |
|------|-----|-------|
| Claude Orange | `#D97757` | Primary brand color, CTAs, accents |
| Claude Orange Hover | `#C46A4A` | Button hover states |
| Light Background | `#FAFAFA` | Main page background |
| Warm Background | `#F5F0E8` | Cards, warm sections |
| Surface White | `#FFFFFF` | Cards, modals |

### Text Colors
| Name | Hex | Usage |
|------|-----|-------|
| Primary Text | `#1A1A1A` | Headlines, primary content |
| Secondary Text | `#6B6B6B` | Subtitles, descriptions |
| Muted Text | `#9CA3AF` | Placeholders, disabled |
| Border Gray | `#E5E5E5` | Borders, dividers |

### Semantic Colors
| Name | Hex | Usage |
|------|-----|-------|
| Success Green | `#10B981` | Success states |
| Warning Yellow | `#F59E0B` | Warnings |
| Error Red | `#EF4444` | Errors |
| Info Blue | `#3B82F6` | Information |
| Link Blue | `#2563EB` | Links |

### Dark Mode Colors
| Name | Hex | Usage |
|------|-----|-------|
| Dark Background | `#0D0D0D` | Main dark background |
| Dark Surface | `#1A1A1A` | Cards, elevated surfaces |
| Dark Text | `#E5E5E5` | Primary text in dark mode |

---

## 🔤 Typography

### Font Families

#### Primary: Uncut Sans
- **Source**: Custom font by Anthropic
- **Weights**: 400 (Regular), 500 (Medium), 600 (Semibold), 700 (Bold)
- **Usage**: Headlines, UI elements, brand text

#### Secondary: Inter
- **Source**: Google Fonts
- **Weights**: 400, 500, 600
- **Usage**: Body text, paragraphs, secondary content

#### Monospace: JetBrains Mono
- **Source**: Google Fonts / Local
- **Weights**: 400, 500
- **Usage**: Code blocks, technical content

### Type Scale
| Level | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| Hero | 72px / 4.5rem | 600 | 1.1 | Main headlines |
| H1 | 48px / 3rem | 600 | 1.2 | Page titles |
| H2 | 36px / 2.25rem | 600 | 1.3 | Section headers |
| H3 | 24px / 1.5rem | 600 | 1.4 | Subsection headers |
| H4 | 20px / 1.25rem | 500 | 1.4 | Card titles |
| Body Large | 18px / 1.125rem | 400 | 1.6 | Lead paragraphs |
| Body | 16px / 1rem | 400 | 1.6 | Standard text |
| Body Small | 14px / 0.875rem | 400 | 1.5 | Secondary text |
| Caption | 12px / 0.75rem | 500 | 1.4 | Labels, captions |

---

## 📐 Spacing System

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Micro spacing |
| `space-2` | 8px | Icon gaps |
| `space-3` | 12px | Small gaps |
| `space-4` | 16px | Standard padding |
| `space-5` | 20px | Medium gaps |
| `space-6` | 24px | Section padding |
| `space-8` | 32px | Large gaps |
| `space-10` | 40px | Section margins |
| `space-12` | 48px | Large sections |
| `space-16` | 64px | Hero spacing |
| `space-20` | 80px | Major sections |

---

## 🔲 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 4px | Small elements |
| `radius-md` | 8px | Buttons, inputs |
| `radius-lg` | 12px | Cards, containers |
| `radius-xl` | 16px | Large cards |
| `radius-2xl` | 24px | Modals, dialogs |
| `radius-full` | 9999px | Pills, avatars |

---

## 🧩 Components

### Buttons
- **Variants**: Primary, Secondary, Ghost
- **Sizes**: Small, Medium, Large
- **States**: Default, Hover, Active, Focus, Disabled

### Cards
- **Variants**: Default (shadow), Bordered
- **Features**: Hover lift animation, shadow transitions

### Inputs
- **Types**: Text, Textarea
- **States**: Default, Focus, Disabled, Error
- **Features**: Focus ring, placeholder styling

### Navigation
- **Features**: Sticky, blur backdrop, responsive hamburger menu
- **Height**: 64px

### Badges
- **Variants**: Primary, Success, Warning, Error
- **Style**: Pill-shaped with background tint

### Chat Components
- **Message Bubbles**: User (orange, right-aligned), Claude (gray, left-aligned)
- **Typing Indicator**: Animated bouncing dots
- **Code Blocks**: Dark theme with syntax highlighting

### Loading States
- **Skeleton**: Shimmer animation
- **Spinner**: Circular, orange color

---

## 📱 Responsive Breakpoints

| Name | Value | Usage |
|------|-------|-------|
| sm | 640px | Mobile landscape |
| md | 768px | Tablet |
| lg | 1024px | Desktop |
| xl | 1280px | Large desktop |
| 2xl | 1440px | Extra large desktop |

---

## ⚡ Animations & Transitions

| Token | Duration | Easing |
|-------|----------|--------|
| `transition-fast` | 150ms | ease |
| `transition-base` | 200ms | ease |
| `transition-slow` | 300ms | ease |
| `transition-bounce` | 300ms | cubic-bezier(0.4, 0, 0.2, 1) |

### Key Animations
- **Typing Indicator**: Bounce animation (1.4s infinite)
- **Skeleton Loading**: Shimmer effect (1.5s infinite)
- **Card Hover**: Lift + shadow (300ms)
- **Button Hover**: Scale + shadow (200ms)

---

## ♿ Accessibility

- **Standard**: WCAG 2.1 AA
- **Color Contrast**: 4.5:1 minimum
- **Focus Indicators**: 2px outline
- **Keyboard Navigation**: Full support
- **Reduced Motion**: Respected via media query
- **Screen Reader**: Semantic HTML + ARIA labels

---

## 🚀 Performance Targets

| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.5s |
| Largest Contentful Paint | < 2.5s |
| Time to Interactive | < 3.5s |
| Cumulative Layout Shift | < 0.1 |

---

## 📦 Usage

### Import Order
```css
@import 'design-tokens.css';
@import 'fonts.css';
@import 'layout.css';
@import 'components.css';
```

### Quick Start
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <link rel="stylesheet" href="design-tokens.css">
  <link rel="stylesheet" href="fonts.css">
  <link rel="stylesheet" href="layout.css">
  <link rel="stylesheet" href="components.css">
</head>
<body>
  <nav class="nav">
    <a href="/" class="nav-logo">Claude</a>
    <ul class="nav-links">
      <li><a href="/features" class="nav-link">Features</a></li>
      <li><a href="/pricing" class="nav-link">Pricing</a></li>
      <li><a href="/api" class="nav-link">API</a></li>
    </ul>
    <button class="btn btn-primary">Get Started</button>
  </nav>
  
  <main class="hero">
    <h1 class="hero-title">Meet Claude</h1>
    <p class="hero-subtitle">Your AI assistant for any task</p>
    <button class="btn btn-primary btn-lg">Start Chatting</button>
  </main>
</body>
</html>
```

---

## 🔗 External Resources

- **Claude AI**: https://claude.ai
- **Anthropic**: https://www.anthropic.com
- **API Docs**: https://docs.anthropic.com
- **Anthropic Skills**: https://github.com/anthropics/skills

---

## 📄 License

This design system documentation is for educational and reference purposes. Claude and Anthropic are trademarks of Anthropic, PBC.
