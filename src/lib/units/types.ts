export type TempUnit = 'c' | 'f';
export type WeightUnit = 'g' | 'oz';
export type DateFormat = 'dmy' | 'mdy' | 'ymd';
export type TimeFormat = '12h' | '24h';

/** The display preferences stored in `user_settings`. Stored brewing values are always metric. */
export type UnitSettings = {
  temp_unit: TempUnit;
  weight_unit: WeightUnit;
  date_format: DateFormat;
  time_format: TimeFormat;
  time_zone: string;
};

export const TEMP_UNITS: readonly TempUnit[] = ['c', 'f'];
export const WEIGHT_UNITS: readonly WeightUnit[] = ['g', 'oz'];
export const DATE_FORMATS: readonly DateFormat[] = ['dmy', 'mdy', 'ymd'];
export const TIME_FORMATS: readonly TimeFormat[] = ['12h', '24h'];
