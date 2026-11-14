/** The product name lives here only. Renaming later = this file + public/brand/ icons. */
export const siteConfig = {
  name: '[App]',
  shortName: '[App]',
  /** Text wordmark shown in the shell until a logo exists. */
  wordmark: '[App]',
  description:
    'Recipes that evolve, a guided brew timer and brew logs for serious home coffee brewers.',
  /** Placeholder values; must match the Light/Dark canvas tokens in src/styles/tokens.css. */
  themeColor: { light: '#F6F2EC', dark: '#141110' },
  /** The public GitHub repository. Release links on /changelog point here. */
  repoUrl: 'https://github.com/aaron1999x/brew-v2',
  accentColor: '#9A4A1F',
} as const;
