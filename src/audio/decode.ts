/** Decode an audio file to an AudioBuffer without needing a user gesture. */
export async function decodeFile(file: File): Promise<AudioBuffer> {
  const data = await file.arrayBuffer();
  const ctx = new OfflineAudioContext(2, 1, 44100);
  return ctx.decodeAudioData(data);
}

export type MetadataResult =
  | { ok: true; duration: number }
  | { ok: false; reason: 'unsupported' };

/**
 * Wait until the media element knows the file's duration (or fails).
 * Used as a cheap gate before the memory-heavy full decode.
 */
export function waitForMetadata(audio: HTMLAudioElement, timeoutMs = 8000): Promise<MetadataResult> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (result: MetadataResult) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('error', onError);
      resolve(result);
    };
    const onMeta = () => finish({ ok: true, duration: audio.duration });
    const onError = () => finish({ ok: false, reason: 'unsupported' });
    const timer = window.setTimeout(() => finish({ ok: false, reason: 'unsupported' }), timeoutMs);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('error', onError);
    if (audio.readyState >= 1) onMeta();
  });
}
