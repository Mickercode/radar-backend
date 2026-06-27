import { useEffect, useRef, useState, useCallback, createContext, useContext } from 'react';
import { Icon } from './Icon';

// ── Player context so any page can trigger playback ─────────────────────────

interface Track {
  src: string;
  title: string;
  source: string;
  contentId: string;
}

interface PlayerCtx {
  track: Track | null;
  playing: boolean;
  play: (track: Track) => void;
  pause: () => void;
  resume: () => void;
}

const PlayerContext = createContext<PlayerCtx>({
  track: null, playing: false,
  play: () => {}, pause: () => {}, resume: () => {},
});

export function usePlayer() { return useContext(PlayerContext); }

function formatTime(s: number): string {
  if (!Number.isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [track, setTrack] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);

  // Restore last position from localStorage
  const storageKey = (id: string) => `radar:pos:${id}`;

  const play = useCallback((t: Track) => {
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;

    if (track?.contentId === t.contentId) {
      audio.play().catch(() => {});
      setPlaying(true);
      return;
    }

    setTrack(t);
    setLoading(true);
    audio.src = t.src;
    audio.load();

    const saved = parseFloat(localStorage.getItem(storageKey(t.contentId)) ?? '0');
    audio.currentTime = saved > 0 ? saved : 0;

    audio.play().catch(() => setPlaying(false));
  }, [track]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(false);
  }, []);

  const resume = useCallback(() => {
    audioRef.current?.play().catch(() => {});
    setPlaying(true);
  }, []);

  // Wire audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (track) localStorage.setItem(storageKey(track.contentId), String(audio.currentTime));
    };
    const onDurationChange = () => setDuration(audio.duration);
    const onCanPlay = () => setLoading(false);
    const onEnded = () => { setPlaying(false); if (track) localStorage.removeItem(storageKey(track.contentId)); };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('ended', onEnded);
    };
  }, [track]);

  const seek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    if (audioRef.current) audioRef.current.currentTime = t;
    setCurrentTime(t);
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <PlayerContext.Provider value={{ track, playing, play, pause, resume }}>
      {children}

      {track && (
        <div className="audio-player">
          <div className="audio-player__progress-bar">
            <div className="audio-player__progress-fill" style={{ width: `${progress}%` }} />
            <input
              className="audio-player__seek"
              type="range"
              min={0}
              max={duration || 100}
              step={1}
              value={currentTime}
              onChange={seek}
              aria-label="Seek"
            />
          </div>

          <div className="audio-player__row">
            <div className="audio-player__info">
              <p className="audio-player__title">{track.title}</p>
              <p className="audio-player__source">{track.source}</p>
            </div>

            <div className="audio-player__controls">
              <span className="audio-player__time">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              <button
                className="audio-player__play"
                onClick={playing ? pause : resume}
                aria-label={playing ? 'Pause' : 'Play'}
                disabled={loading}
              >
                {loading ? (
                  <span className="audio-player__loading" />
                ) : playing ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
                  </svg>
                ) : (
                  <Icon name="play" size={20} />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </PlayerContext.Provider>
  );
}
