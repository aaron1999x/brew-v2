import { Bookmark, ChevronRight, Coffee, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Avatar } from '../Avatar/Avatar';
import { VerifiedBadge, VersionBadge } from '../Badge/Badge';
import { Icon } from '../Icon/Icon';
import { VisuallyHidden } from '../VisuallyHidden/VisuallyHidden';
import styles from './Card.module.css';

export type KeyNumber = { label: string; value: string };

type RecipeCardProps = {
  name: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  verified?: boolean;
  method: string;
  /** Already formatted for display (use the units helpers), e.g. { label: 'Dose', value: '18 g' }. */
  keyNumbers: readonly KeyNumber[];
  version: number;
  brewCount?: number;
  saveCount?: number;
  href: string;
};

/** One tab stop: the title is the link and a stretched ::after makes the whole card clickable. */
export function RecipeCard({
  name,
  authorName,
  authorAvatarUrl,
  verified,
  method,
  keyNumbers,
  version,
  brewCount,
  saveCount,
  href,
}: RecipeCardProps) {
  return (
    <article className={cx(styles.card, styles.interactive)}>
      <div className={styles.head}>
        <h3 className={styles.title}>
          <Link href={href} className={styles.link}>
            {name}
          </Link>
        </h3>
        <VersionBadge version={version} />
      </div>
      <p className={styles.byline}>
        <Avatar name={authorName} src={authorAvatarUrl} size="sm" decorative />
        <span className={styles.author}>{authorName}</span>
        {verified ? <VerifiedBadge /> : null}
      </p>
      <p className={styles.meta}>{method}</p>
      {keyNumbers.length > 0 ? (
        <dl className={styles.numbers}>
          {keyNumbers.map((n) => (
            <div key={n.label} className={styles.number}>
              <dt className={styles.numberLabel}>{n.label}</dt>
              <dd className={cx(styles.numberValue, 'num')}>{n.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {brewCount != null || saveCount != null ? (
        <p className={styles.counts}>
          {brewCount != null ? (
            <span className={styles.count}>
              <Icon icon={Coffee} size="sm" />
              <span className="num">{brewCount}</span> {brewCount === 1 ? 'brew' : 'brews'}
            </span>
          ) : null}
          {saveCount != null ? (
            <span className={styles.count}>
              <Icon icon={Bookmark} size="sm" />
              <span className="num">{saveCount}</span> {saveCount === 1 ? 'save' : 'saves'}
            </span>
          ) : null}
        </p>
      ) : null}
    </article>
  );
}

type BrewCardProps = {
  recipeName: string;
  version: number;
  /** Display text for the date, e.g. "Sat 14 Nov". */
  dateLabel: string;
  /** Machine-readable date for the <time> element. */
  dateTime: string;
  /** Overall score 0–10; null when the brew wasn't scored. */
  score: number | null;
  /** Slot for the mini radar chart (arrives with the charts milestone). */
  radar?: ReactNode;
  href: string;
};

export function BrewCard({
  recipeName,
  version,
  dateLabel,
  dateTime,
  score,
  radar,
  href,
}: BrewCardProps) {
  return (
    <article className={cx(styles.card, styles.interactive, styles.brew)}>
      <div className={styles.brewText}>
        <p className={styles.meta}>
          <time dateTime={dateTime}>{dateLabel}</time>
        </p>
        <h3 className={styles.title}>
          <Link href={href} className={styles.link}>
            {recipeName}
          </Link>
        </h3>
        <p className={styles.byline}>
          <VersionBadge version={version} />
          {score == null ? (
            <span className={styles.meta}>Not scored</span>
          ) : (
            <span className={styles.score}>
              <span className={cx(styles.scoreValue, 'num')}>{score}</span>
              <span className={styles.meta}> / 10 overall</span>
            </span>
          )}
        </p>
      </div>
      {radar ? <div className={styles.radar}>{radar}</div> : null}
    </article>
  );
}

export function StatTile({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
}) {
  return (
    <div className={styles.tile}>
      <p className={styles.tileLabel}>{label}</p>
      <p className={styles.tileValue}>
        <span className="num">{value}</span>
        {unit ? <span className={styles.tileUnit}> {unit}</span> : null}
      </p>
      {hint ? <p className={styles.meta}>{hint}</p> : null}
    </div>
  );
}

/** Wrap rows in this so they form a real list. */
export function RowList({ children, label }: { children: ReactNode; label: string }) {
  return (
    <ul className={styles.rows} aria-label={label}>
      {children}
    </ul>
  );
}

type ListRowProps = {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  trailing?: ReactNode;
  /** Makes the whole row a link with a chevron. */
  href?: string;
};

export function ListRow({ title, subtitle, icon, trailing, href }: ListRowProps) {
  const content = (
    <>
      {icon ? <Icon icon={icon} size="md" /> : null}
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>{title}</span>
        {subtitle ? <span className={styles.meta}>{subtitle}</span> : null}
      </span>
      {trailing ? <span className={styles.trailing}>{trailing}</span> : null}
      {href ? <Icon icon={ChevronRight} size="md" /> : null}
    </>
  );
  return (
    <li className={styles.row}>
      {href ? (
        <Link href={href} className={styles.rowLink} data-primary-control="">
          {content}
        </Link>
      ) : (
        <div className={styles.rowStatic}>{content}</div>
      )}
    </li>
  );
}

type NoticeItemProps = {
  message: string;
  timeLabel: string;
  unread?: boolean;
  href?: string;
};

/** Unread = a dot, bold text and hidden "Unread" text: never colour alone. */
export function NoticeItem({ message, timeLabel, unread = false, href }: NoticeItemProps) {
  const content = (
    <>
      <span className={cx(styles.dot, unread && styles.dotOn)} aria-hidden="true" />
      <span className={styles.rowText}>
        <span className={cx(styles.rowTitle, unread && styles.unread)}>
          {unread ? <VisuallyHidden>Unread: </VisuallyHidden> : null}
          {message}
        </span>
        <span className={styles.meta}>{timeLabel}</span>
      </span>
    </>
  );
  return (
    <li className={styles.row}>
      {href ? (
        <Link href={href} className={styles.rowLink} data-primary-control="">
          {content}
        </Link>
      ) : (
        <div className={styles.rowStatic}>{content}</div>
      )}
    </li>
  );
}
