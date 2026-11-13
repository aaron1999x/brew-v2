/** The product name lives here only. Renaming later = this file + public/brand/ icons. */
export const siteConfig = {
  name: '[App]',
  shortName: '[App]',
  description:
    'Recipes that evolve, a guided brew timer and brew logs for serious home coffee brewers.',
  /** Placeholder values; must match the Light/Dark canvas tokens in src/styles/tokens.css. */
  themeColor: { light: '#F6F2EC', dark: '#141110' },
  accentColor: '#9A4A1F',
} as const;
