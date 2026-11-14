import { getPublicEnv } from '@/lib/env';
import styles from './SuspendedBanner.module.css';

/**
 * Suspended accounts can still log in and read; every write is refused by the database.
 * The contact line comes from NEXT_PUBLIC_SUPPORT_EMAIL and is left out when it isn't set.
 */
export function SuspendedBanner() {
  const contact = getPublicEnv().NEXT_PUBLIC_SUPPORT_EMAIL;
  return (
    <div role="status" className={styles.banner}>
      <strong>Your account is suspended.</strong> You can still log in and read your recipes, but
      you can&apos;t make changes.
      {contact ? (
        <>
          {' '}
          If you think this is a mistake, contact <a href={`mailto:${contact}`}>{contact}</a>.
        </>
      ) : null}
    </div>
  );
}
