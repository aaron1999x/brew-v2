import { createSerwistRoute } from '@serwist/turbopack';
import { randomUUID } from 'node:crypto';

// Builds src/sw/sw.ts with esbuild and serves it at /serwist/sw.js (see SerwistProvider in the
// root layout). The precache manifest defaults to the Next build output (.next/static) and public/.
// The revision versions the precached offline page; the commit SHA on Vercel, random locally.
const revision = process.env.VERCEL_GIT_COMMIT_SHA || randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute(
  {
    additionalPrecacheEntries: [{ url: '/~offline', revision }],
    swSrc: 'src/sw/sw.ts',
    // Vercel builds on Linux, where the default would be esbuild-wasm (not installed).
    useNativeEsbuild: true,
  },
);
