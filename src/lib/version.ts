/**
 * Build-time version info. The version comes from package.json and the commit from Vercel's
 * VERCEL_GIT_COMMIT_SHA; both are injected in next.config.ts. Falls back to "local".
 */
export const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';
export const commitSha = (process.env.NEXT_PUBLIC_COMMIT_SHA ?? 'local').slice(0, 7);
