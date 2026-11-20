import { createClient } from '@/lib/supabase/client';
import type { BrewSession } from './schema';

export type TimerEventName = 'timer_started' | 'timer_completed' | 'timer_abandoned';

export type TimerEventProps = {
  method: string;
  step_count: number;
  steep: boolean;
  quick_change: boolean;
  /** timer_completed only: the brew was ended early with "Log it anyway". */
  early?: boolean;
};

/**
 * What an event says about a brew: its method, how many steps, whether it is a long steep and
 * whether a quick change is set. Nothing personal: no names, notes, recipe text or values.
 */
export function timerEventProps(
  session: Pick<BrewSession, 'method' | 'version' | 'timer' | 'quickChange'>,
  extra: { early?: boolean } = {},
): TimerEventProps {
  const change = session.quickChange;
  return {
    method: session.method,
    step_count: session.version.steps.length,
    steep: session.timer?.mode === 'steep',
    quick_change: Boolean(change && Object.keys(change).length > 0),
    ...(extra.early === undefined ? {} : { early: extra.early }),
  };
}

/**
 * Sends a product event (`log_event`). Fire and forget: a failure, a missing connection or a
 * rate limit never gets in the way of brewing.
 */
export function logTimerEvent(
  name: TimerEventName,
  session: Pick<BrewSession, 'recipeId' | 'method' | 'version' | 'timer' | 'quickChange'>,
  extra: { early?: boolean } = {},
): void {
  try {
    void createClient()
      .rpc('log_event', {
        p_name: name,
        p_recipe_id: session.recipeId,
        p_props: timerEventProps(session, extra),
      })
      .then(
        () => undefined,
        () => undefined,
      );
  } catch {
    /* events are best effort */
  }
}
