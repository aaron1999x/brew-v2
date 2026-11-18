'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { toast } from '@/components/ui/Toast/toast';
import { currentUserId, useSession } from '@/lib/auth/useSession';
import { toUserMessage } from '@/lib/errors/messages';
import { reportUnexpected } from '@/lib/errors/report';
import { queryKeys } from '@/lib/query/keys';
import { createClient } from '@/lib/supabase/client';
import {
  DATE_FORMATS,
  TEMP_UNITS,
  TIME_FORMATS,
  WEIGHT_UNITS,
  deviceDefaults,
  formatDate,
  formatDateTime,
  formatClock,
  formatTemp,
  formatTime,
  formatWeight,
  type UnitSettings,
} from '@/lib/units';
import type { Json } from '@/types/database';
import { mergeOnboarding, parseOnboarding, type Onboarding } from './onboarding';
import { isTheme, type Theme } from './theme';

/** `user_settings` as the app uses it: checked unions instead of raw strings. */
export type Settings = UnitSettings & { theme: Theme; onboarding: Onboarding };

const COLUMNS = 'temp_unit, weight_unit, date_format, time_format, time_zone, theme, onboarding';

type Row = {
  temp_unit: string;
  weight_unit: string;
  date_format: string;
  time_format: string;
  time_zone: string;
  theme: string;
  onboarding: Json;
};

/** Turns a stored row into `Settings`; an unknown value falls back to the device default. */
export function toSettings(row: Row, fallback: UnitSettings = deviceDefaults()): Settings {
  return {
    temp_unit: TEMP_UNITS.find((u) => u === row.temp_unit) ?? fallback.temp_unit,
    weight_unit: WEIGHT_UNITS.find((u) => u === row.weight_unit) ?? fallback.weight_unit,
    date_format: DATE_FORMATS.find((u) => u === row.date_format) ?? fallback.date_format,
    time_format: TIME_FORMATS.find((u) => u === row.time_format) ?? fallback.time_format,
    time_zone: row.time_zone || fallback.time_zone,
    theme: isTheme(row.theme) ? row.theme : 'system',
    onboarding: parseOnboarding(row.onboarding),
  };
}

/** The signed-in user's settings (query key `['settings']`). */
export function useSettings() {
  const { user } = useSession();
  return useQuery({
    queryKey: queryKeys.settings(),
    enabled: Boolean(user),
    queryFn: async (): Promise<Settings> => {
      const { data, error } = await createClient()
        .from('user_settings')
        .select(COLUMNS)
        .eq('user_id', user!.id)
        .single();
      if (error) throw error;
      return toSettings(data);
    },
  });
}

export type SettingsPatch = Partial<Settings>;

type UpdateOptions = {
  /** Toast shown after a successful save. Leave out for quiet saves (onboarding). */
  successMessage?: string;
};

/**
 * Saves part of the settings. The cache changes first (optimistic) and rolls back if the save
 * fails, with an error toast that offers Retry.
 */
export function useUpdateSettings({ successMessage }: UpdateOptions = {}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (patch: SettingsPatch) => {
      const userId = await currentUserId();
      const { onboarding: patchOnboarding, ...rest } = patch;
      // `onMutate` already merged this change into the cache. Send the cache's onboarding (not just
      // this patch's copy), so two saves in flight at once (the "started" mark and a step finishing)
      // can't overwrite each other's steps with an older whole object.
      const onboarding = patchOnboarding
        ? (queryClient.getQueryData<Settings>(queryKeys.settings())?.onboarding ?? patchOnboarding)
        : undefined;
      const { error } = await createClient()
        .from('user_settings')
        .update({ ...rest, ...(onboarding ? { onboarding: onboarding as NonNullable<Json> } : {}) })
        .eq('user_id', userId);
      if (error) throw error;
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.settings() });
      const previous = queryClient.getQueryData<Settings>(queryKeys.settings());
      if (previous)
        queryClient.setQueryData<Settings>(queryKeys.settings(), {
          ...previous,
          ...patch,
          // Merge, not replace: two quick onboarding changes must not drop each other.
          onboarding: patch.onboarding
            ? mergeOnboarding(previous.onboarding, patch.onboarding)
            : previous.onboarding,
        });
      return { previous };
    },
    onError: (error, patch, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.settings(), context.previous);
      reportUnexpected(error);
      toast.error(toUserMessage(error), { onRetry: () => mutation.mutate(patch) });
    },
    onSuccess: () => {
      if (successMessage) toast.success(successMessage);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.settings() }),
  });

  return mutation;
}

/**
 * The user's display units and ready-made formatters for stored metric values. Until settings
 * load (or without a session) it uses defaults from the device's locale. `TemperatureField`
 * and `WeightField` are built on this; use them for every temperature or weight input.
 */
export function useUnits() {
  const query = useSettings();
  const settings = query.data;

  return useMemo(() => {
    const units: UnitSettings = settings ?? deviceDefaults();
    return {
      units,
      isLoading: query.isLoading,
      temp: (celsius: number) => formatTemp(celsius, units.temp_unit),
      weight: (grams: number) => formatWeight(grams, units.weight_unit),
      /** Step times, durations, totals and drawdown targets: m:ss, then h:mm:ss from one hour. */
      duration: formatClock,
      date: (value: Date | string | number) =>
        formatDate(value, units.date_format, units.time_zone),
      time: (value: Date | string | number) =>
        formatTime(value, units.time_format, units.time_zone),
      dateTime: (value: Date | string | number) => formatDateTime(value, units),
    };
  }, [settings, query.isLoading]);
}
