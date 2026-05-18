interface VoiceWaveformProps {
  bars: number[];
  isUser?: boolean;
  /** 0–1 avanzamento riproduzione */
  progress?: number;
  /** Onde animate (registrazione o in riproduzione) */
  live?: boolean;
  className?: string;
}

const DEFAULT_BARS = 28;

export function generatePlaceholderWaveform(count = DEFAULT_BARS): number[] {
  return Array.from({ length: count }, (_, i) => {
    const t = i / count;
    return 0.25 + Math.sin(t * Math.PI * 3) * 0.2 + ((i * 7) % 11) / 40;
  });
}

export async function extractWaveformFromBlob(
  blob: Blob,
  barCount = DEFAULT_BARS,
): Promise<number[]> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const ctx = new AudioContext();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const channel = audioBuffer.getChannelData(0);
    const blockSize = Math.max(1, Math.floor(channel.length / barCount));
    const bars: number[] = [];

    for (let i = 0; i < barCount; i++) {
      let sum = 0;
      const start = i * blockSize;
      for (let j = 0; j < blockSize && start + j < channel.length; j++) {
        sum += Math.abs(channel[start + j]);
      }
      const avg = sum / blockSize;
      bars.push(Math.min(1, Math.max(0.12, avg * 5)));
    }

    await ctx.close();
    return bars;
  } catch {
    return generatePlaceholderWaveform(barCount);
  }
}

export function VoiceWaveform({
  bars,
  isUser = false,
  progress = 0,
  live = false,
  className = "",
}: VoiceWaveformProps) {
  const displayBars = bars.length > 0 ? bars : generatePlaceholderWaveform();

  return (
    <div
      className={`flex items-center gap-[2px] h-7 ${className}`}
      role="img"
      aria-hidden
    >
      {displayBars.map((h, i) => {
        const barProgress = (i + 1) / displayBars.length;
        const played = progress > 0 && barProgress <= progress;
        const heightPx = Math.round(4 + h * 20);

        return (
          <span
            key={i}
            className={`w-[3px] rounded-full transition-colors duration-150 ${
              isUser
                ? played || live
                  ? "bg-white"
                  : "bg-white/45"
                : played || live
                  ? "bg-brand-700"
                  : "bg-brand-700/35"
            } ${live ? "voice-bar-live" : ""}`}
            style={{
              height: `${heightPx}px`,
              animationDelay: live ? `${(i % 7) * 70}ms` : undefined,
            }}
          />
        );
      })}
    </div>
  );
}
