import type { MetadataRoute } from 'next';

/** Everything is crawlable except the development pages under /dev/ (component gallery, previews). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: '/dev/' }],
  };
}
