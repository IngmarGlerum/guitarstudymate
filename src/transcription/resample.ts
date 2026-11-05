import { TRANSCRIBE_RATE } from './types';

/**
 * Decode the file again, straight to 22.05 kHz, and mix down to mono.
 * The waveform's buffer is not kept, so this is a fresh decode.
 */
export async function decodeForTranscription(file: File): Promise<Float32Array> {
  const data = await file.arrayBuffer();
  // decodeAudioData resamples to the context's rate; length and channels don't matter here.
  const ctx = new OfflineAudioContext(1, 1, TRANSCRIBE_RATE);
  const buffer = await ctx.decodeAudioData(data);
  const channels = buffer.numberOfChannels;
  const mono = new Float32Array(buffer.length);
  for (let c = 0; c < channels; c++) {
    const channel = buffer.getChannelData(c);
    for (let i = 0; i < mono.length; i++) mono[i] += channel[i];
  }
  if (channels > 1) {
    const scale = 1 / channels;
    for (let i = 0; i < mono.length; i++) mono[i] *= scale;
  }
  return mono;
}
