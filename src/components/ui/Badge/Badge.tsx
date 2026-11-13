import {
  BadgeCheck,
  Check,
  Clock,
  EyeOff,
  Globe,
  Lock,
  Pencil,
  TriangleAlert,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Icon } from '../Icon/Icon';
import styles from './Badge.module.css';

export type BadgeTone =
  'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'changed';

type BadgeProps = {
  tone?: BadgeTone;
  /** Every badge carries an icon or text so meaning never rests on colour alone. */
  icon?: LucideIcon;
  children: ReactNode;
};

export function Badge({ tone = 'neutral', icon, children }: BadgeProps) {
  return (
    <span className={cx(styles.badge, styles[tone])}>
      {icon ? <Icon icon={icon} size="sm" /> : null}
      <span>{children}</span>
    </span>
  );
}

export function VerifiedBadge() {
  return (
    <Badge tone="accent" icon={BadgeCheck}>
      Verified
    </Badge>
  );
}

export type Visibility = 'private' | 'public' | 'hidden';

const visibility: Record<Visibility, { label: string; icon: LucideIcon; tone: BadgeTone }> = {
  private: { label: 'Private', icon: Lock, tone: 'neutral' },
  public: { label: 'Public', icon: Globe, tone: 'info' },
  hidden: { label: 'Hidden', icon: EyeOff, tone: 'warning' },
};

export function VisibilityBadge({ visibility: value }: { visibility: Visibility }) {
  const v = visibility[value];
  return (
    <Badge tone={v.tone} icon={v.icon}>
      {v.label}
    </Badge>
  );
}

/** "v1", "v2"… The number is the version; the "v" is part of the visible text. */
export function VersionBadge({ version }: { version: number }) {
  return <Badge tone="neutral">{`v${version}`}</Badge>;
}

export type SyncState = 'saved' | 'waiting' | 'offline' | 'attention';

const sync: Record<SyncState, { label: string; icon: LucideIcon; tone: BadgeTone }> = {
  saved: { label: 'Saved', icon: Check, tone: 'success' },
  waiting: { label: 'Waiting to sync', icon: Clock, tone: 'warning' },
  offline: { label: 'Offline', icon: WifiOff, tone: 'neutral' },
  attention: { label: 'Needs attention', icon: TriangleAlert, tone: 'danger' },
};

export function SyncBadge({ state }: { state: SyncState }) {
  const s = sync[state];
  return (
    <Badge tone={s.tone} icon={s.icon}>
      {s.label}
    </Badge>
  );
}

/** Marks a field that changed between recipe versions. */
export function ChangedPill() {
  return (
    <Badge tone="changed" icon={Pencil}>
      Changed
    </Badge>
  );
}
