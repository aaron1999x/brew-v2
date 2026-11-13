# Design token samples (companion to the design brief)

For: the designer · 13 Nov 2026

This shows **how** to structure and name the tokens so they convert straight into code. **All values below are placeholders** to show structure, not a colour or type proposal. Use your own.

Format: W3C Design Tokens Community Group format (stable version 2025.10), which Figma Variables export natively (Variables panel → right-click a collection → **Export modes**, giving one `.tokens.json` file per mode). Tokens Studio exports the same format.

---

## 1. Structure in Figma

| Collection | Modes | Contains | Used by components? |
|---|---|---|---|
| **Primitives** | one (Default) | Raw palette and raw scales, named by what they are: `neutral.900`, `roast.600`, `space.4` | **No**, never directly |
| **Semantic** | **Light**, **Dark** | Names by purpose, each one an alias pointing at a primitive: `color.text.primary → {color.neutral.900}` | **Yes**, only these |

Dark mode works by **pointing the same semantic name at a different primitive**, never by making separate "dark" components.

## 2. Naming rules

| ✅ Do | ❌ Don't |
|---|---|
| `color.text.primary` | `color.gray.900` used in a component |
| `color.status.danger` | `color.red` |
| `color.changed.bg` (field changed between versions) | `color.orange-highlight` |
| `color.surface.raised` | `color.white-card` |
| `space.4` (= 16 px on the 4 px scale) | `space.medium-ish` |
| Lowercase, dot-separated groups, kebab-case words: `color.accent.on-accent` | Spaces, emoji, "Copy of…", mixed case |

---

## 3. Sample: Primitives (`primitives.tokens.json`)

```json
{
  "color": {
    "$type": "color",
    "neutral": {
      "0":   { "$value": "#FFFFFF" },
      "50":  { "$value": "#F6F2EC" },
      "100": { "$value": "#ECE6DD" },
      "300": { "$value": "#C9BFB2" },
      "600": { "$value": "#6B6158" },
      "800": { "$value": "#2E2824" },
      "900": { "$value": "#1F1A17" },
      "950": { "$value": "#141110" }
    },
    "roast": {
      "300": { "$value": "#E08A55" },
      "600": { "$value": "#9A4A1F" },
      "700": { "$value": "#7C3A17" }
    },
    "green": { "600": { "$value": "#2F7D4A" }, "300": { "$value": "#6CC08A" } },
    "amber": { "600": { "$value": "#9A6400" }, "300": { "$value": "#E7B45A" } },
    "red":   { "600": { "$value": "#B3261E" }, "300": { "$value": "#F08A80" } },
    "teal":  { "600": { "$value": "#0E7C86" }, "300": { "$value": "#5CC4CC" } },
    "violet":{ "600": { "$value": "#6B4FC8" }, "300": { "$value": "#A996F0" } }
  },
  "space": {
    "$type": "dimension",
    "1":  { "$value": { "value": 4,  "unit": "px" } },
    "2":  { "$value": { "value": 8,  "unit": "px" } },
    "3":  { "$value": { "value": 12, "unit": "px" } },
    "4":  { "$value": { "value": 16, "unit": "px" } },
    "6":  { "$value": { "value": 24, "unit": "px" } },
    "8":  { "$value": { "value": 32, "unit": "px" } },
    "12": { "$value": { "value": 48, "unit": "px" } }
  },
  "radius": {
    "$type": "dimension",
    "sm":   { "$value": { "value": 8,   "unit": "px" } },
    "md":   { "$value": { "value": 12,  "unit": "px" } },
    "lg":   { "$value": { "value": 20,  "unit": "px" } },
    "full": { "$value": { "value": 999, "unit": "px" } }
  }
}
```

> Figma's export may write colours as objects (`colorSpace`, `components`, `hex`) instead of hex strings, as the 2025.10 spec allows. Either is fine; the build converts both.

## 4. Sample: Semantic, Light mode (`semantic.light.tokens.json`)

```json
{
  "color": {
    "$type": "color",
    "bg": {
      "canvas":  { "$value": "{color.neutral.50}",  "$description": "Page background" },
      "surface": { "$value": "{color.neutral.0}",   "$description": "Cards, sheets" },
      "inset":   { "$value": "{color.neutral.100}", "$description": "Inset panels, input fills" }
    },
    "text": {
      "primary":   { "$value": "{color.neutral.900}" },
      "secondary": { "$value": "{color.neutral.600}" },
      "on-accent": { "$value": "{color.neutral.0}" }
    },
    "border": {
      "subtle": { "$value": "{color.neutral.100}", "$description": "Dividers only, not inputs" },
      "strong": { "$value": "{color.neutral.600}", "$description": "Input borders; must be 3:1 on bg" }
    },
    "accent": {
      "default": { "$value": "{color.roast.600}" },
      "pressed": { "$value": "{color.roast.700}" }
    },
    "focus":   { "ring": { "$value": "{color.roast.600}" } },
    "status": {
      "success": { "$value": "{color.green.600}" },
      "warning": { "$value": "{color.amber.600}" },
      "danger":  { "$value": "{color.red.600}" }
    },
    "changed": {
      "bg": { "$value": "{color.amber.300}", "$description": "Field changed between recipe versions" },
      "fg": { "$value": "{color.neutral.900}" }
    },
    "chart": {
      "series-a":    { "$value": "{color.teal.600}" },
      "series-b":    { "$value": "{color.roast.600}" },
      "series-c":    { "$value": "{color.violet.600}" },
      "grid":        { "$value": "{color.neutral.100}" },
      "target-band": { "$value": "{color.green.300}" }
    }
  }
}
```

## 5. Sample: Semantic, Dark mode (`semantic.dark.tokens.json`)

**Same names, different aliases.** Every name in Light must exist in Dark.

```json
{
  "color": {
    "$type": "color",
    "bg": {
      "canvas":  { "$value": "{color.neutral.950}" },
      "surface": { "$value": "{color.neutral.900}" },
      "inset":   { "$value": "{color.neutral.800}" }
    },
    "text": {
      "primary":   { "$value": "{color.neutral.50}" },
      "secondary": { "$value": "{color.neutral.300}" },
      "on-accent": { "$value": "{color.neutral.950}" }
    },
    "border": {
      "subtle": { "$value": "{color.neutral.800}" },
      "strong": { "$value": "{color.neutral.300}" }
    },
    "accent": {
      "default": { "$value": "{color.roast.300}" },
      "pressed": { "$value": "{color.roast.600}" }
    },
    "focus":   { "ring": { "$value": "{color.roast.300}" } },
    "status": {
      "success": { "$value": "{color.green.300}" },
      "warning": { "$value": "{color.amber.300}" },
      "danger":  { "$value": "{color.red.300}" }
    },
    "changed": {
      "bg": { "$value": "{color.amber.600}" },
      "fg": { "$value": "{color.neutral.50}" }
    },
    "chart": {
      "series-a":    { "$value": "{color.teal.300}" },
      "series-b":    { "$value": "{color.roast.300}" },
      "series-c":    { "$value": "{color.violet.300}" },
      "grid":        { "$value": "{color.neutral.800}" },
      "target-band": { "$value": "{color.green.600}" }
    }
  }
}
```

## 6. Sample: typography and motion

Figma Variables can hold numbers and strings but not a whole text style. Please make **number/string variables** for the parts (family, size, line height, weight) and **text styles** that use them. Name the text styles the same as below.

```json
{
  "font": {
    "family": {
      "$type": "fontFamily",
      "text":    { "$value": ["Inter", "system-ui", "sans-serif"] },
      "numeric": { "$value": ["Inter", "system-ui", "sans-serif"], "$description": "Must support tabular numerals" }
    }
  },
  "type": {
    "$type": "typography",
    "body":   { "$value": { "fontFamily": "{font.family.text}", "fontSize": { "value": 16, "unit": "px" }, "fontWeight": 400, "lineHeight": 1.5, "letterSpacing": { "value": 0, "unit": "px" } } },
    "label":  { "$value": { "fontFamily": "{font.family.text}", "fontSize": { "value": 14, "unit": "px" }, "fontWeight": 500, "lineHeight": 1.4, "letterSpacing": { "value": 0, "unit": "px" } } },
    "h1":     { "$value": { "fontFamily": "{font.family.text}", "fontSize": { "value": 28, "unit": "px" }, "fontWeight": 600, "lineHeight": 1.2, "letterSpacing": { "value": -0.4, "unit": "px" } } },
    "timer":  { "$value": { "fontFamily": "{font.family.numeric}", "fontSize": { "value": 120, "unit": "px" }, "fontWeight": 600, "lineHeight": 1, "letterSpacing": { "value": -2, "unit": "px" } }, "$description": "Guided timer clock, readable at arm's length" }
  },
  "motion": {
    "duration": {
      "$type": "duration",
      "fast":   { "$value": { "value": 120, "unit": "ms" } },
      "normal": { "$value": { "value": 240, "unit": "ms" } }
    },
    "easing": {
      "$type": "cubicBezier",
      "standard": { "$value": [0.2, 0, 0, 1] }
    }
  }
}
```

## 7. What the build turns it into (for reference)

```css
:root {
  --color-bg-canvas: #F6F2EC;
  --color-text-primary: #1F1A17;
  --color-accent-default: #9A4A1F;
  --color-changed-bg: #E7B45A;
  --space-4: 16px;
  --radius-md: 12px;
  --motion-duration-normal: 240ms;
}

[data-theme="dark"] {
  --color-bg-canvas: #141110;
  --color-text-primary: #F6F2EC;
  --color-accent-default: #E08A55;
  --color-changed-bg: #9A6400;
}

/* A component only ever uses semantic names */
.button-primary {
  background: var(--color-accent-default);
  color: var(--color-text-on-accent);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  transition: background var(--motion-duration-normal);
}
```

## 8. Checklist before handoff

- [ ] Every component uses **Semantic** variables only (no primitives, no hard-coded hex).
- [ ] Every Semantic name exists in **both** Light and Dark.
- [ ] Text/background pairs pass **4.5:1** (body) or **3:1** (large text) in both modes.
- [ ] Input borders, icons, focus ring, chart lines and slider tracks pass **3:1** against their background in both modes.
- [ ] Chart series A/B/C are distinguishable for colour-blind users (and also differ by line style or marker).
- [ ] Tokens exported: `primitives.tokens.json`, `semantic.light.tokens.json`, `semantic.dark.tokens.json` (plus typography/motion if in a separate collection).
- [ ] Each token that isn't obvious has a `$description`.

Spec: https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/
