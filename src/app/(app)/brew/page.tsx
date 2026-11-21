import type { Metadata } from 'next';
import { BrewPicker } from '@/components/brews/BrewPicker';
import { TopBar } from '@/components/shell/TopBar';
import styles from '../shell.module.css';

export const metadata: Metadata = { title: 'Brew' };

export default function BrewPage() {
  return (
    <>
      <TopBar title="Brew" />
      <div className={styles.body}>
        <BrewPicker />
      </div>
    </>
  );
}
