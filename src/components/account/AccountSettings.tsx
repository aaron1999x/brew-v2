import { ChangePasswordForm } from './ChangePasswordForm';
import { DeleteAccount } from './DeleteAccount';
import { DownloadData } from './DownloadData';
import styles from './Account.module.css';

/** /settings/account: email (read-only), change password, download my data, delete account. */
export function AccountSettings({ email }: { email: string }) {
  return (
    <div className={styles.page}>
      <section className={styles.section} aria-labelledby="account-email">
        <h2 id="account-email" className={styles.heading}>
          Email
        </h2>
        <p className={styles.value} data-testid="account-email">
          {email}
        </p>
        <p className={styles.note}>Changing your email address isn&apos;t available yet.</p>
      </section>

      <section className={styles.section} aria-labelledby="account-password">
        <h2 id="account-password" className={styles.heading}>
          Change password
        </h2>
        <ChangePasswordForm />
      </section>

      <section className={styles.section} aria-labelledby="account-data">
        <h2 id="account-data" className={styles.heading}>
          Download my data
        </h2>
        <p className={styles.note}>
          A JSON file with your profile, settings, recipes, brews and everything else you have saved
          here.
        </p>
        <DownloadData />
      </section>

      <section className={styles.section} aria-labelledby="account-delete">
        <h2 id="account-delete" className={styles.heading}>
          Delete account
        </h2>
        <p className={styles.note}>
          This removes your account and everything in it. It can&apos;t be undone.
        </p>
        <DeleteAccount />
      </section>
    </div>
  );
}
