'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from '@/components/ui/Toast/toast';
import { FLASH_NOTICES, type FlashNotice } from '@/lib/auth/constants';

/**
 * Shows a toast for `?notice=<key>` after a server redirect (password changed, logged out),
 * then removes the parameter. Only known keys are shown; text never comes from the URL.
 */
export function FlashToast() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const notice = params.get('notice');

  useEffect(() => {
    if (!notice) return;
    if (Object.hasOwn(FLASH_NOTICES, notice)) toast.success(FLASH_NOTICES[notice as FlashNotice]);
    const next = new URLSearchParams(params.toString());
    next.delete('notice');
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [notice, params, pathname, router]);

  return null;
}
