'use client';

import { useEffect, useRef, useState } from 'react';

type GlobalGameUISoundsProps = {
  clickSoundSrc?: string;
  hoverSoundSrc?: string;
  volume?: number;
  muteStorageKey?: string;
};

const INTERACTION_KEYS = [
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'w',
  'a',
  's',
  'd',
  'W',
  'A',
  'S',
  'D',
  'Enter',
  ' ',
];

export function GlobalGameUISounds({
  clickSoundSrc = '/sounds/ui-click.mp3',
  hoverSoundSrc = '/sounds/ui-hover.mp3',
  volume = 0.35,
  muteStorageKey = 'baruto_uisounds_muted',
}: GlobalGameUISoundsProps) {
  const clickAudioRef = useRef<HTMLAudioElement | null>(null);
  const hoverAudioRef = useRef<HTMLAudioElement | null>(null);

  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    clickAudioRef.current = new Audio(clickSoundSrc);
    clickAudioRef.current.volume = volume;

    hoverAudioRef.current = new Audio(hoverSoundSrc);
    hoverAudioRef.current.volume = volume * 0.7;

    const syncMuteState = () => {
      const storedValue = localStorage.getItem(muteStorageKey);

      setIsMuted(storedValue === 'true');
    };

    syncMuteState();

    const handleStorageUpdate = () => {
      syncMuteState();
    };

    window.addEventListener('storage', handleStorageUpdate);

    // custom event for same-tab updates
    window.addEventListener(
      'baruto-ui-sound-change',
      handleStorageUpdate as EventListener
    );

    return () => {
      window.removeEventListener('storage', handleStorageUpdate);

      window.removeEventListener(
        'baruto-ui-sound-change',
        handleStorageUpdate as EventListener
      );
    };
  }, [clickSoundSrc, hoverSoundSrc, volume, muteStorageKey]);

  useEffect(() => {
    const playClick = () => {
      if (isMuted) return;

      try {
        if (!clickAudioRef.current) return;

        clickAudioRef.current.currentTime = 0;
        clickAudioRef.current.play();
      } catch (error) {
        console.error(error);
      }
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button === 0) {
        playClick();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (INTERACTION_KEYS.includes(event.key)) {
        if (!event.repeat) {
          playClick();
        }
      }
    };



    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMuted]);

  return null;
}