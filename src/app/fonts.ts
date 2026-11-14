import { Inter } from 'next/font/google';

/** Self-hosted by next/font at build time; wired to --font-family-text/-numeric in tokens.css. */
export const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});
