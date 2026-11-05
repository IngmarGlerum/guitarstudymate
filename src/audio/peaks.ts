/** Fine-grained peak resolution; the renderer aggregates these per pixel column. */
export const PEAK_RATE = 1000; // buckets per second

export interface Peaks {
  min: Float32Array;
  max: Float32Array;
  /** buckets per second */
  rate: number;
  duration: number;
  /** display gain so quiet recordings still fill the lane (capped) */
  gain: number;
}

export function computePeaks(buffer: AudioBuffer, rate = PEAK_RATE): Peaks {
  const buckets = Math.max(1, Math.ceil(buffer.duration * rate));
  const min = new Float32Array(buckets);
  const max = new Float32Array(buckets);
  const channels: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) channels.push(buffer.getChannelData(c));

  const perBucket = buffer.sampleRate / rate;
  let peak = 0;

  for (let i = 0; i < buckets; i++) {
    const start = Math.floor(i * perBucket);
    if (start >= buffer.length) break;
    const end = Math.max(start + 1, Math.min(buffer.length, Math.floor((i + 1) * perBucket)));
    let lo = 0;
    let hi = 0;
    for (let c = 0; c < channels.length; c++) {
      const data = channels[c];
      for (let s = start; s < end; s++) {
        const v = data[s];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    min[i] = lo;
    max[i] = hi;
    if (-lo > peak) peak = -lo;
    if (hi > peak) peak = hi;
  }

  const gain = peak > 0 ? Math.min(6, 0.92 / peak) : 1;
  return { min, max, rate, duration: buffer.duration, gain };
}
