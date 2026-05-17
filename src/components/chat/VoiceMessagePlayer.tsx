import { useRef, useState, useEffect } from "react";
import { Play, Pause } from "lucide-react";
import { VoiceWaveform } from "./VoiceWaveform";

interface VoiceMessagePlayerProps {
  url: string;
  waveform?: number[];
  durationSec?: number;
  isUser?: boolean;
}

function formatDuration(sec?: number): string {
  const s = Math.max(0, Math.floor(sec ?? 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function VoiceMessagePlayer({
  url,
  waveform = [],
  durationSec = 0,
  isUser = false,
}: VoiceMessagePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(durationSec);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    setDuration(durationSec);
  }, [durationSec]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      void audio.play();
    }
  };

  return (
    <div className="flex items-center gap-2.5 min-w-[200px] max-w-[260px] py-0.5">
      <button
        type="button"
        onClick={togglePlay}
        className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
          isUser
            ? "bg-white/20 hover:bg-white/30 text-white"
            : "bg-brand-100 hover:bg-brand-200 text-brand-800"
        }`}
        aria-label={playing ? "Pausa" : "Riproduci"}
      >
        {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} className="ml-0.5" fill="currentColor" />}
      </button>

      <VoiceWaveform
        bars={waveform}
        isUser={isUser}
        progress={progress}
        live={playing}
        className="flex-1"
      />

      <span
        className={`text-[11px] tabular-nums flex-shrink-0 min-w-[28px] text-right ${
          isUser ? "text-white/80" : "text-gray-500"
        }`}
      >
        {formatDuration(playing ? currentTime : duration || durationSec)}
      </span>

      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        className="hidden"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
          setCurrentTime(0);
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          setCurrentTime(el.currentTime);
          if (el.duration && Number.isFinite(el.duration)) {
            setProgress(el.currentTime / el.duration);
            if (!durationSec) setDuration(Math.ceil(el.duration));
          }
        }}
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          if (el.duration && Number.isFinite(el.duration) && !durationSec) {
            setDuration(Math.ceil(el.duration));
          }
        }}
      />
    </div>
  );
}
