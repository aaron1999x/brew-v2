/** Build-time version info. Version comes from package.json (injected in next.config.ts). */
export const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';
export const commitSha = (process.env.VERCEL_GIT_COMMIT_SHA ?? 'local').slice(0, 7);
