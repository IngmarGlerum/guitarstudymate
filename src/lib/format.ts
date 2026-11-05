/** m:ss, optionally with fractional seconds (m:ss.cc). */
export function formatTime(seconds: number, decimals = 0): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const factor = 10 ** decimals;
  const units = Math.floor(safe * factor + 1e-6);
  const whole = Math.floor(units / factor);
  const frac = units % factor;
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  const fracStr = decimals > 0 ? `.${String(frac).padStart(decimals, '0')}` : '';
  return `${m}:${String(s).padStart(2, '0')}${fracStr}`;
}

/** 0.75 -> "0,75×", 1 -> "1×" (Dutch decimal comma). */
export function formatRate(rate: number): string {
  return `${Number(rate.toFixed(2)).toString().replace('.', ',')}×`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
