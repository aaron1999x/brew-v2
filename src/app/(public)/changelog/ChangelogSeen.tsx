'use client';

import { useEffect } from 'react';
import { appVersion } from '@/lib/version';
import { writeLastViewed } from '@/lib/lastViewedVersion';

/** Renders nothing. Opening the changelog marks the current version as seen, which clears the dot. */
export function ChangelogSeen() {
  useEffect(() => {
    writeLastViewed(appVersion);
  }, []);
  return null;
}
