export interface AppSettings {
  returnToStartOnStop: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = { returnToStartOnStop: false };

export const isAppSettings = (v: unknown): v is AppSettings =>
  typeof v === 'object' && v !== null && typeof (v as AppSettings).returnToStartOnStop === 'boolean';
