import { BadgeCheck, BookOpen, Coffee, House, type LucideIcon } from 'lucide-react';
import { User } from 'lucide-react';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** The centre action on the phone tab bar. */
  primary?: boolean;
};

/** The five destinations, in tab-bar order (docs/phase-2-ia-flows.md §1). */
export const navItems: readonly NavItem[] = [
  { href: '/home', label: 'Home', icon: House },
  { href: '/recipes', label: 'Recipes', icon: BookOpen },
  { href: '/brew', label: 'Brew', icon: Coffee, primary: true },
  { href: '/verified', label: 'Verified', icon: BadgeCheck },
  { href: '/profile', label: 'Profile', icon: User },
];

/** True for the item's own page and anything beneath it (/recipes and /recipes/123). */
export function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
