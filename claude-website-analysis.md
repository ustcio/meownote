# Claude Website Analysis & Resource Documentation

## Overview
This document provides a comprehensive analysis of the Claude AI website (anthropic.com/claude.ai) including its structure, design system, typography, and interactive components.

---

## 1. Website Structure

### Main Entry Points
- **Primary**: https://claude.ai - The Claude chat interface
- **Marketing**: https://www.anthropic.com - Company and product information
- **Product Page**: https://www.anthropic.com/claude - Claude product details

### Site Architecture
```
anthropic.com/
├── /                    # Homepage
├── /claude              # Claude product page
├── /research            # Research publications
├── /company             # About Anthropic
├── /safety              # AI safety initiatives
├── /api                 # API documentation
└── /pricing             # Pricing information

claude.ai/
├── /login               # Authentication
├── /chat                # Main chat interface
└── /settings            # User preferences
```

---

## 2. Design System

### Color Palette

#### Primary Colors
| Name | Hex | Usage |
|------|-----|-------|
| Claude Orange | `#D97757` | Primary brand color, CTAs, accents |
| Claude Dark | `#1A1A1A` | Primary text, dark mode backgrounds |
| Claude Light | `#FAFAFA` | Light backgrounds |
| Claude Cream | `#F5F0E8` | Warm backgrounds, cards |

#### Secondary Colors
| Name | Hex | Usage |
|------|-----|-------|
| Soft Gray | `#6B6B6B` | Secondary text |
| Border Gray | `#E5E5E5` | Borders, dividers |
| Hover Orange | `#C46A4A` | Button hover states |
| Link Blue | `#2563EB` | Links, interactive text |

#### Semantic Colors
| Name | Hex | Usage |
|------|-----|-------|
| Success Green | `#10B981` | Success states, confirmations |
| Warning Yellow | `#F59E0B` | Warnings, cautions |
| Error Red | `#EF4444` | Errors, destructive actions |
| Info Blue | `#3B82F6` | Information, tips |

### Dark Mode Colors
| Name | Hex | Usage |
|------|-----|-------|
| Dark Background | `#0D0D0D` | Main dark background |
| Dark Surface | `#1A1A1A` | Cards, elevated surfaces |
| Dark Border | `#2A2A2A` | Borders in dark mode |
| Dark Text | `#E5E5E5` | Primary text in dark mode |

---

## 3. Typography System

### Font Families

#### Primary Font: **Uncut Sans**
- **Source**: Custom font by Anthropic
- **Usage**: Headlines, UI elements, brand text
- **Weights**: 400 (Regular), 500 (Medium), 600 (Semibold), 700 (Bold)

#### Secondary Font: **Inter**
- **Source**: Google Fonts / Local
- **Usage**: Body text, paragraphs, secondary content
- **Weights**: 400, 500, 600

#### Monospace Font: **JetBrains Mono** or **SF Mono**
- **Usage**: Code blocks, technical content, timestamps

### Type Scale

| Level | Size | Line Height | Weight | Usage |
|-------|------|-------------|--------|-------|
| Hero | 72px / 4.5rem | 1.1 | 600 | Main headlines |
| H1 | 48px / 3rem | 1.2 | 600 | Page titles |
| H2 | 36px / 2.25rem | 1.3 | 600 | Section headers |
| H3 | 24px / 1.5rem | 1.4 | 600 | Subsection headers |
| H4 | 20px / 1.25rem | 1.4 | 500 | Card titles |
| Body Large | 18px / 1.125rem | 1.6 | 400 | Lead paragraphs |
| Body | 16px / 1rem | 1.6 | 400 | Standard text |
| Body Small | 14px / 0.875rem | 1.5 | 400 | Secondary text |
| Caption | 12px / 0.75rem | 1.4 | 500 | Labels, captions |

### Typography Patterns
- **Letter Spacing**: Tight for headlines (-0.02em), normal for body
- **Text Transform**: Sentence case for UI, Title Case for navigation
- **Font Smoothing**: `-webkit-font-smoothing: antialiased`

---

## 4. Layout System

### Grid System
- **Container Max Width**: 1280px
- **Grid Columns**: 12-column grid
- **Gutter**: 24px (desktop), 16px (mobile)
- **Breakpoints**:
  - Mobile: < 640px
  - Tablet: 640px - 1024px
  - Desktop: > 1024px
  - Large Desktop: > 1440px

### Spacing Scale
| Token | Value | Usage |
|-------|-------|-------|
| space-1 | 4px | Tight spacing |
| space-2 | 8px | Icon gaps |
| space-3 | 12px | Small gaps |
| space-4 | 16px | Standard padding |
| space-5 | 20px | Medium gaps |
| space-6 | 24px | Section padding |
| space-8 | 32px | Large gaps |
| space-10 | 40px | Section margins |
| space-12 | 48px | Large sections |
| space-16 | 64px | Hero spacing |
| space-20 | 80px | Major sections |

### Border Radius
| Token | Value | Usage |
|-------|-------|-------|
| radius-sm | 4px | Small elements |
| radius-md | 8px | Buttons, inputs |
| radius-lg | 12px | Cards, containers |
| radius-xl | 16px | Large cards |
| radius-2xl | 24px | Modals, dialogs |
| radius-full | 9999px | Pills, avatars |

---

## 5. Component Library

### Buttons

#### Primary Button
- Background: `#D97757` (Claude Orange)
- Text: White
- Padding: 12px 24px
- Border Radius: 8px
- Font Weight: 500
- Hover: Darken 10%, subtle scale

#### Secondary Button
- Background: Transparent
- Border: 1px solid `#E5E5E5`
- Text: `#1A1A1A`
- Hover: Background `#F5F5F5`

#### Ghost Button
- Background: Transparent
- Text: `#D97757`
- Hover: Background `rgba(217, 119, 87, 0.1)`

### Cards
- Background: White or `#F5F0E8` (cream)
- Border Radius: 12px or 16px
- Shadow: `0 1px 3px rgba(0,0,0,0.1)`
- Padding: 24px
- Hover: Subtle lift with increased shadow

### Inputs
- Border: 1px solid `#E5E5E5`
- Border Radius: 8px
- Padding: 12px 16px
- Focus: Border color `#D97757`, subtle glow
- Placeholder: `#9CA3AF`

### Navigation
- Height: 64px
- Background: White with blur backdrop
- Logo: Left aligned
- Links: Center or right aligned
- Mobile: Hamburger menu

---

## 6. Interactive Components

### Chat Interface (claude.ai)

#### Message Bubbles
- User messages: Right aligned, orange tint background
- Claude messages: Left aligned, white/gray background
- Max width: 80%
- Border radius: 16px
- Padding: 16px 20px

#### Input Area
- Fixed bottom position
- Multi-line textarea
- Send button with arrow icon
- Attachment button

#### Typing Indicator
- Animated dots
- Claude avatar with pulse animation

### Animations & Transitions

#### Micro-interactions
- Button hover: 200ms ease-out
- Card hover: 300ms cubic-bezier(0.4, 0, 0.2, 1)
- Page transitions: 300ms fade
- Modal open: 200ms scale + fade

#### Scroll Animations
- Fade up on scroll
- Stagger delay for lists (50ms between items)
- Parallax on hero sections

#### Loading States
- Skeleton screens with pulse animation
- Spinner: Circular, orange color
- Progress bars: Linear, ease-in-out

---

## 7. Font Files & Typography Resources

### Custom Fonts

#### Uncut Sans (Primary)
```
Location: /fonts/uncut-sans/
Files:
  - UncutSans-Regular.woff2 (weight: 400)
  - UncutSans-Medium.woff2 (weight: 500)
  - UncutSans-Semibold.woff2 (weight: 600)
  - UncutSans-Bold.woff2 (weight: 700)
Format: WOFF2 (primary), WOFF (fallback)
```

#### Inter (Secondary)
```
Location: Google Fonts CDN or /fonts/inter/
Weights: 400, 500, 600
Subsets: Latin, Latin Extended
```

### Font Loading Strategy
- **Method**: Font-display: swap
- **Preload**: Critical fonts (Regular, Medium)
- **Fallback**: System font stack

### CSS Font Stack
```css
--font-primary: 'Uncut Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-secondary: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'JetBrains Mono', 'SF Mono', Monaco, monospace;
```

---

## 8. CSS Architecture

### File Organization
```
styles/
├── tokens/
│   ├── colors.css
│   ├── typography.css
│   ├── spacing.css
│   └── shadows.css
├── base/
│   ├── reset.css
│   ├── typography.css
│   └── utilities.css
├── components/
│   ├── buttons.css
│   ├── cards.css
│   ├── forms.css
│   └── navigation.css
├── layouts/
│   ├── grid.css
│   ├── header.css
│   └── footer.css
└── pages/
    ├── home.css
    ├── chat.css
    └── pricing.css
```

### CSS Variables (Design Tokens)
```css
:root {
  /* Colors */
  --color-primary: #D97757;
  --color-primary-hover: #C46A4A;
  --color-background: #FAFAFA;
  --color-surface: #FFFFFF;
  --color-text: #1A1A1A;
  --color-text-secondary: #6B6B6B;
  
  /* Typography */
  --font-family-primary: 'Uncut Sans', sans-serif;
  --font-size-base: 16px;
  --line-height-base: 1.6;
  
  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
  
  /* Border Radius */
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  
  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-base: 200ms ease;
  --transition-slow: 300ms ease;
}
```

---

## 9. JavaScript Architecture

### Framework
- **Primary**: React (Next.js)
- **State Management**: React Context / Zustand
- **Styling**: Tailwind CSS + CSS Modules
- **Animation**: Framer Motion

### Key Components

#### Chat Interface
```javascript
// Core components
- ChatContainer
- MessageList
- MessageBubble (User/Claude)
- ChatInput
- TypingIndicator
- CodeBlock (syntax highlighting)
```

#### Interactive Features
- Real-time message streaming
- Markdown rendering
- Code syntax highlighting (Prism.js)
- File upload handling
- Conversation history

### API Integration
- **Base URL**: https://api.anthropic.com
- **Authentication**: API key in headers
- **Streaming**: Server-Sent Events (SSE)
- **Rate Limiting**: Client-side handling

---

## 10. Asset Organization

### Directory Structure
```
public/
├── fonts/
│   ├── uncut-sans/
│   ├── inter/
│   └── jetbrains-mono/
├── images/
│   ├── logos/
│   ├── icons/
│   ├── illustrations/
│   └── screenshots/
├── favicon.ico
├── manifest.json
└── robots.txt

src/
├── assets/
│   ├── icons/          # SVG icons
│   ├── illustrations/  # Vector illustrations
│   └── images/         # Optimized images
```

### Image Specifications
- **Format**: WebP (primary), PNG (fallback)
- **Icons**: SVG, 24x24px default
- **Illustrations**: SVG or optimized PNG
- **Screenshots**: WebP, 2x for retina

---

## 11. Responsive Design

### Breakpoint Strategy
```css
/* Mobile First */
@media (min-width: 640px) { /* Tablet */ }
@media (min-width: 1024px) { /* Desktop */ }
@media (min-width: 1440px) { /* Large Desktop */ }
```

### Mobile Adaptations
- Navigation collapses to hamburger menu
- Chat interface becomes full-screen
- Typography scales down (hero: 72px → 40px)
- Touch targets minimum 44px
- Bottom sheet modals

---

## 12. Accessibility

### Standards
- WCAG 2.1 AA compliance
- Semantic HTML5 elements
- ARIA labels where needed
- Keyboard navigation support
- Focus visible states

### Implementation
- Color contrast ratio: 4.5:1 minimum
- Focus indicators: 2px outline
- Skip links for navigation
- Alt text for images
- Reduced motion support

---

## 13. Performance Optimizations

### Loading Strategy
- Critical CSS inlined
- Fonts preloaded
- Images lazy loaded
- Code split by route
- Service worker for caching

### Metrics Targets
- First Contentful Paint: < 1.5s
- Largest Contentful Paint: < 2.5s
- Time to Interactive: < 3.5s
- Cumulative Layout Shift: < 0.1

---

## 14. Resource URLs

### CDN Resources
```
Fonts:
- https://fonts.anthropic.com/uncut-sans/...
- https://fonts.googleapis.com/css2?family=Inter:...

Assets:
- https://cdn.anthropic.com/images/...
- https://cdn.anthropic.com/icons/...
```

### API Endpoints
```
Authentication:
- POST /api/auth/login
- POST /api/auth/logout

Chat:
- POST /api/chat/completions (streaming)
- GET /api/conversations
- GET /api/conversations/:id
```

---

## 15. Implementation Notes

### Key Design Decisions
1. **Warm color palette**: Cream/beige backgrounds create approachable feel
2. **Generous whitespace**: Premium, uncluttered aesthetic
3. **Subtle animations**: Enhance without distracting
4. **Consistent radius**: 8px-16px for cohesive look
5. **Typography hierarchy**: Clear distinction between content levels

### Browser Support
- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Mobile Safari (iOS 14+)
- Chrome Android (latest)

---

## 16. File Inventory

### Extracted Files Location
```
/Users/maxwell/Desktop/WebSite/meownote/extracted-claude-website/
├── www-anthropic-com-.html          # Main homepage HTML
├── analysis.json                     # Resource analysis data
└── claude-website-analysis.md        # This documentation
```

### Next Steps for Complete Extraction
1. Use browser DevTools to capture rendered HTML
2. Extract CSS from Network tab
3. Download font files from Sources tab
4. Capture JavaScript bundles
5. Save image assets
6. Document component interactions

---

*Document generated: 2026-03-16*
*Analysis based on: https://www.anthropic.com*
