import { Coffee, Settings } from 'lucide-react';
import {
  BrewCard,
  ListRow,
  NoticeItem,
  RecipeCard,
  RowList,
  StatTile,
} from '@/components/ui/Card/Card';
import { SyncBadge } from '@/components/ui/Badge/Badge';
import styles from './sections.module.css';

/** Placeholder for the mini radar chart that arrives with the charts milestone. */
function RadarSlot() {
  return <div className={styles.radarPlaceholder} aria-hidden="true" />;
}

export function CardsSection() {
  return (
    <>
      <div className={styles.group}>
        <h3 className={styles.groupTitle}>Recipe card</h3>
        <div className={styles.grid}>
          <RecipeCard
            name="Washed Ethiopia, 1:16 V60"
            authorName="Aaron Tan"
            verified
            method="Hario V60 · Pour over"
            keyNumbers={[
              { label: 'Dose', value: '18 g' },
              { label: 'Water', value: '288 g' },
              { label: 'Ratio', value: '1:16' },
              { label: 'Temp', value: '93 °C' },
            ]}
            version={3}
            brewCount={24}
            saveCount={7}
            href="/dev/components#cards"
          />
          <RecipeCard
            name="An extremely long recipe name that should wrap onto several lines without breaking the card layout or pushing the badge off screen"
            authorName="Maximilian Alexander Konstantinopolous-Featherstonehaugh"
            method="AeroPress · Inverted"
            keyNumbers={[{ label: 'Dose', value: '15 g' }]}
            version={12}
            brewCount={1}
            saveCount={0}
            href="/dev/components#cards"
          />
          <RecipeCard
            name="Minimal recipe"
            authorName="you"
            method="French press"
            keyNumbers={[]}
            version={1}
            href="/dev/components#cards"
          />
        </div>
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupTitle}>Brew card</h3>
        <div className={styles.grid}>
          <BrewCard
            recipeName="Washed Ethiopia, 1:16 V60"
            version={3}
            dateLabel="Sat 14 Nov"
            dateTime="2026-11-14"
            score={8.5}
            radar={<RadarSlot />}
            href="/dev/components#cards"
          />
          <BrewCard
            recipeName="A brew of a recipe with a very long name that needs to wrap nicely"
            version={2}
            dateLabel="Fri 13 Nov"
            dateTime="2026-11-13"
            score={null}
            href="/dev/components#cards"
          />
        </div>
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupTitle}>Stat tile</h3>
        <div className={styles.grid}>
          <StatTile label="Brews this month" value={12} />
          <StatTile label="Average score" value="7.8" unit="/ 10" hint="Up 0.4 from October" />
          <StatTile label="Favourite ratio" value="1:16" />
        </div>
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupTitle}>List rows</h3>
        <RowList label="Example rows">
          <ListRow
            title="Gear"
            subtitle="Brewer, grinder, kettle"
            icon={Coffee}
            href="/dev/components#cards"
          />
          <ListRow title="Settings" icon={Settings} href="/dev/components#cards" />
          <ListRow
            title="Last sync"
            subtitle="2 minutes ago"
            trailing={<SyncBadge state="saved" />}
          />
          <ListRow
            title="A row whose title is long enough to wrap onto a second line on a phone screen"
            subtitle="And a subtitle that is also quite long to check wrapping behaviour"
            href="/dev/components#cards"
          />
        </RowList>
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupTitle}>Notice items</h3>
        <RowList label="Example notices">
          <NoticeItem
            message="Your recipe was verified."
            timeLabel="2 h ago"
            unread
            href="/dev/components#cards"
          />
          <NoticeItem message="Sam saved Washed Ethiopia." timeLabel="Yesterday" unread />
          <NoticeItem
            message="Welcome to the app."
            timeLabel="3 days ago"
            href="/dev/components#cards"
          />
        </RowList>
        <p className={styles.result}>
          Unread notices have a dot, bold text and hidden “Unread” text.
        </p>
      </div>
    </>
  );
}
