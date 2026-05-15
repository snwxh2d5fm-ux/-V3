---
version: alpha
name: 住港伴 / LiveHK
description: >
  Hong Kong identity planning companion. Navy-blue authority meets warm
  approachability — premium trust for new immigrants navigating visas,
  documents, and settlement.
colors:
  primary: "#1a73e8"
  primary-dark: "#1557b0"
  primary-light: "#e8f0fe"
  secondary: "#5f6368"
  tertiary: "#059669"
  neutral: "#f8f9fa"
typography:
  h1:
    fontFamily: "PingFang SC, -apple-system, sans-serif"
    fontSize: 48rpx
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  h2:
    fontFamily: "PingFang SC, -apple-system, sans-serif"
    fontSize: 40rpx
    fontWeight: 700
    lineHeight: 1.25
  h3:
    fontFamily: "PingFang SC, -apple-system, sans-serif"
    fontSize: 34rpx
    fontWeight: 700
    lineHeight: 1.3
  body-lg:
    fontFamily: "PingFang SC, -apple-system, sans-serif"
    fontSize: 30rpx
    fontWeight: 400
    lineHeight: 1.6
  body-md:
    fontFamily: "PingFang SC, -apple-system, sans-serif"
    fontSize: 28rpx
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: "PingFang SC, -apple-system, sans-serif"
    fontSize: 26rpx
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "PingFang SC, -apple-system, sans-serif"
    fontSize: 22rpx
    fontWeight: 400
    lineHeight: 1.4
rounded:
  xs: 6rpx
  sm: 8rpx
  md: 16rpx
  lg: 24rpx
  pill: 20rpx
spacing:
  xs: 8rpx
  sm: 12rpx
  md: 16rpx
  lg: 24rpx
  xl: 32rpx
  2xl: 48rpx
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: 16rpx 36rpx
  button-primary-hover:
    backgroundColor: "{colors.primary-dark}"
  button-outline:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: 16rpx 36rpx
  card-default:
    backgroundColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: 28rpx
  tag-success:
    backgroundColor: "#ecfdf5"
    textColor: "{colors.tertiary}"
    rounded: "{rounded.pill}"
  tag-warning:
    backgroundColor: "#fff7ed"
    textColor: "#ea580c"
    rounded: "{rounded.pill}"
  tag-error:
    backgroundColor: "#fef2f2"
    textColor: "#b91c1c"
    rounded: "{rounded.pill}"
---

## Overview / 品牌与风格

住港伴 (LiveHK) is an AI-powered identity planning companion for new Hong Kong
immigrants. The visual identity must convey **trust** (navy blue authority),
**care** (warm approachable accents), and **clarity** (clean rules-based layout).

Brand keywords: 信赖 · 温暖 · 专业 · 隐私优先

The design language borrows from modern fintech (Stripe, Revolut) for dashboards
and editorial warmth (Notion) for guide content — blended for a mini-program
context with WeChat-native interaction patterns.

### DSG-3 Principles

1. **三层令牌架构**: Primitive → Semantic → Component. Never use raw hex in
   component/page wxss; always reference via `var(--token)`.
2. **4rpx 间距栅格**: All spacing values must be multiples of 4rpx.
3. **WCAG AA**: Text/background contrast ≥ 4.5:1 for body text.
4. **单源真相**: `tokens.wxss` is the single source of design truth.

## Colors / 配色体系

### Primary — Navy Blue
- **Primary (#1a73e8)**: Action buttons, active states, main brand identifier.
  Represents authority, trust, and the HK Immigration Department blue.
- **Primary Dark (#1557b0)**: Button hover/press states, dark mode emphasis.
- **Primary Light (#e8f0fe)**: Selected backgrounds, info cards, subtle brand
  presence.

### Neutral — Warm Gray
- **Text Primary (#111827)**: Headlines, body text.
- **Text Secondary (#5f6368)**: Supporting descriptions, metadata.
- **Text Muted (#757F8C)**: Placeholders, disabled text.
- **Background Page (#f8f9fa)**: App-wide background, warm but light.
- **Background Card (#ffffff)**: Card surfaces, modal backgrounds.
- **Border (#e5e7eb)**: Dividers, card borders.

### Semantic Status
- **Success (#059669)**: Done, verified, collected.
- **Warning (#ea580c)**: Expiring, attention needed.
- **Error (#dc2626)**: Expired, missing required.
- **Info (#2563eb)**: In progress, current step.

### Gray Scale (Tailwind-derived, contrast-enhanced)
50: #F9FAFB | 100: #F3F4F6 | 200: #E5E7EB | 300: #D1D5DB
400: #757F8C | 500: #5E6773 | 600: #4B5563 | 700: #374151
800: #1F2937 | 900: #111827

## Typography / 字体系统

PingFang SC is the primary font for Chinese text. System fallback:
`-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif`.

| Token | Size | Weight | Use |
|-------|------|--------|-----|
| --font-xs | 22rpx | 400 | Captions, disclaimers |
| --font-sm | 26rpx | 400/500 | Secondary text, labels |
| --font-md | 28rpx | 400/600 | Body text (default) |
| --font-lg | 32rpx | 600/700 | Card titles, section heads |
| --font-xl | 36rpx | 700 | Dialog titles, hero names |
| --font-xxl | 44rpx | 800 | Page headers, brand moments |

## Layout & Spacing / 间距与布局

4rpx base grid. Common patterns:

- Page padding: 24rpx horizontal
- Card margin: 16rpx horizontal between cards
- Card padding: 28rpx internal
- Section gap: 24rpx between section groups
- Icon + text gap: 8rpx small, 16rpx default
- List item height: minimum 88rpx tap target

### Global Page Layout
```
┌─ Status Bar ──────────────┐
├─ Nav Bar (蓝底白字) ─────┤
├─ Hero/Header (optional) ──┤
├─ Content Area ────────────┤
│  ├─ Section Header        │
│  ├─ Card / List           │
│  └─ ...                   │
├─ Safe Bottom ─────────────┤
└─ Tab Bar ─────────────────┘
```

## Elevation & Depth / 阴影层级

4-level shadow system, ascending with importance:

| Token | Value | Use |
|-------|-------|-----|
| --shadow-sm | 0 2rpx 8rpx rgba(0,0,0,0.04) | Flat cards, subtle lift |
| --shadow | 0 4rpx 16rpx rgba(0,0,0,0.06) | Default cards |
| --shadow-md | 0 4rpx 20rpx rgba(0,0,0,0.08) | Interactive cards, popovers |
| --shadow-lg | 0 8rpx 32rpx rgba(0,0,0,0.12) | Modals, hero cards |

## Shapes / 圆角

| Token | Value | Use |
|-------|-------|-----|
| --radius-xs | 6rpx | Inline badges, tiny buttons |
| --radius-sm | 8rpx | Buttons, input fields, search bars |
| --radius | 16rpx | Cards (default) |
| --radius-lg | 24rpx | Large cards, dialogs, hero sections |
| --radius-pill | 20rpx | Tags, chips, tabs |

## Components / 组件规范

### Button
- `.btn-primary`: Blue bg, white text, 8rpx radius, 16rpx 36rpx padding.
  Press: darken to primary-dark, scale(0.97).
- `.btn-outline`: White bg, blue border (1.5rpx), blue text.
- `.btn-lg`: Full-width, 22rpx 44rpx padding, font-lg.
- `.btn-sm`: Compact, 10rpx 24rpx, font-sm.
- `.btn-disabled`: opacity 0.5, no pointer events.

### Card
- `.card`: White bg, 16rpx radius, 28rpx padding, shadow-sm.
- `.card--highlight`: Left blue border (6rpx).
- `.card--urgent`: Left red border.
- `.card--warning`: Left orange border.
- `.card--success`: Left green border.

### Tag / Badge
- Pill shape (20rpx radius), 4rpx 14rpx padding, font-xs, weight 600.
- Color variants: success (green), warning (orange), danger (red), info (blue),
  muted (gray).

### Progress Bar
- 10rpx height, gray-200 background, 5rpx radius.
- Fill colors: blue (primary), green (complete), orange (partial), red (blocked).
- Transition: width 0.5s ease.

### List Item
- 22rpx 28rpx padding, white bg, gap 16rpx.
- Active state: gray-50 background.
- Border bottom: 1rpx gray-100.

### Modal / Sheet
- Fixed overlay, rgba(0,0,0,0.4) background.
- Bottom sheet: 28rpx top-left/right radius, slideUp animation.
- Dialog: centered, 24rpx radius, 40rpx padding.

### Search Bar
- Gray-100 bg, 8rpx radius, 14rpx 24rpx padding.
- Icon 28rpx, input flex:1 transparent bg.

### Tab / Segment Control
- Gray-100 bg wrapper, 8rpx radius, 4rpx padding.
- Active tab: white bg, shadow-sm, blue text.
- Inactive: gray-500 text.

### Step Indicator
- Horizontal scroll, 36rpx circles.
- Done: green bg + checkmark.
- Active: blue bg.
- Pending: white bg + gray-300 border.

### Privacy Bar
- Green-light bg, centered flex, 12rpx 24rpx padding.
- Green text, font-xs, weight 500.

### Lock Section
- Dashed gray-300 border, gray-50 bg, centered.
- Large lock icon → title → description → action button.

## Do's and Don'ts

**Do:**
- Always reference `var(--color-*)` or `var(--gray-*)` for colors
- Use 4rpx-multiple spacing values
- Follow BEM naming: `.block__element--modifier`
- Apply `transition` for interactive state changes
- Test WCAG AA contrast on all text/background pairs

**Don't:**
- Never use raw hex values in page/component wxss
- Don't use non-4rpx-multiple spacing (6→8, 10→12, 14→16)
- Don't create duplicate token definitions across files
- Don't use hardcoded font sizes — always reference --font-*
- Don't apply box-shadow without a corresponding border-radius
