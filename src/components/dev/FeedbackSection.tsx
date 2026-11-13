'use client';

import { Coffee, Inbox } from 'lucide-react';
import { useState } from 'react';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { Button } from '@/components/ui/Button/Button';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import {
  FormErrorSummary,
  type FormError,
} from '@/components/ui/FormErrorSummary/FormErrorSummary';
import { OfflineBanner } from '@/components/ui/OfflineBanner/OfflineBanner';
import { LoadingRegion, SkeletonCard, SkeletonRow } from '@/components/ui/Skeleton/Skeleton';
import { StillLoading, useStillLoading } from '@/components/ui/StillLoading/StillLoading';
import { TextField } from '@/components/ui/TextField/TextField';
import styles from './sections.module.css';

export function FeedbackSection() {
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<FormError[]>([]);
  const still = useStillLoading(loading, 3000);

  function validate() {
    setErrors([
      { fieldId: 'demo-recipe-name', message: 'Enter a recipe name.' },
      { fieldId: 'demo-method', message: 'Choose a method.' },
    ]);
  }

  return (
    <>
      <div className={styles.group}>
        <h3 className={styles.groupTitle}>Offline banner</h3>
        <div className={styles.row}>
          <Button variant="secondary" onPress={() => setOffline((o) => !o)}>
            {offline ? 'Go online' : 'Go offline'}
          </Button>
        </div>
        <OfflineBanner isOffline={offline} />
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupTitle}>Empty states</h3>
        <div className={styles.grid}>
          <EmptyState
            icon={Coffee}
            title="Your brew bar is empty"
            text="Create your first recipe or brew one from Verified."
            action={<Button>New recipe</Button>}
          />
          <EmptyState icon={Inbox} title="No notices yet." headingLevel={3} />
          <EmptyState
            title="No recipes match these filters."
            text="Try removing a filter."
            action={<Button variant="secondary">Clear filters</Button>}
            headingLevel={3}
          />
        </div>
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupTitle}>Loading</h3>
        <div className={styles.row}>
          <Button variant="secondary" onPress={() => setLoading((l) => !l)}>
            {loading ? 'Finish loading' : 'Start loading'}
          </Button>
          <span className={styles.result}>
            “Still loading…” appears after 3 s here (10 s in the app).
          </span>
        </div>
        {loading ? (
          <LoadingRegion label="recipes">
            <SkeletonCard />
            <SkeletonRow />
            <SkeletonRow />
            {still ? <StillLoading onRetry={() => setLoading(false)} /> : null}
          </LoadingRegion>
        ) : (
          <p className={styles.result}>Loaded.</p>
        )}
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupTitle}>Error panel (inside a page)</h3>
        <ErrorPanel
          as="section"
          title="Couldn't load your recipes"
          message="Couldn't reach the server. Check your connection and try again."
          onRetry={() => {}}
          showHomeLink={false}
        />
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupTitle}>Form error summary</h3>
        <FormErrorSummary errors={errors} />
        <div className={styles.grid}>
          <TextField
            id="demo-recipe-name"
            label="Recipe name"
            isInvalid={errors.some((e) => e.fieldId === 'demo-recipe-name')}
            errorMessage="Enter a recipe name."
          />
          <TextField
            id="demo-method"
            label="Method"
            isInvalid={errors.some((e) => e.fieldId === 'demo-method')}
            errorMessage="Choose a method."
          />
        </div>
        <div className={styles.row}>
          <Button onPress={validate}>Submit with errors</Button>
          <Button variant="ghost" onPress={() => setErrors([])}>
            Clear
          </Button>
        </div>
      </div>
    </>
  );
}
