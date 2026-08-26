import React from "react";

interface AudioPlayerProps {
  src: string;
}

export const AudioPlayer = ({ src }: AudioPlayerProps) => {
  const audioRef = React.useRef<HTMLAudioElement>(null);

  React.useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.02;
      audioRef.current.src = src;
      audioRef.current.autoplay = true;
      audioRef.current.play().catch(() => {
        // Auto-play prevented by browser policy
      });
    }
  }, [src]);

  return <audio ref={audioRef} className="w-full h-full" />;
};