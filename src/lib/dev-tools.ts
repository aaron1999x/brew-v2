/** `/dev/*` pages exist everywhere except production (staging, preview and local). */
export function isDevToolsEnabled(appEnv: string | undefined): boolean {
  return appEnv !== 'production';
}
