'use client';

import { useEffect, useRef } from 'react';

type GlobalGameUISoundsProps = {
  clickSoundSrc?: string;
  hoverSoundSrc?: string;
  volume?: number;
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
  hoverSoundSrc,
  volume = 0.35,
}: GlobalGameUISoundsProps) {
  const clickAudioRef = useRef<HTMLAudioElement | null>(null);
  const hoverAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    clickAudioRef.current = new Audio(clickSoundSrc);
    clickAudioRef.current.volume = volume;

    if (hoverSoundSrc) {
      hoverAudioRef.current = new Audio(hoverSoundSrc);
      hoverAudioRef.current.volume = volume * 0.7;
    }

    const playClick = () => {
      try {
        if (!clickAudioRef.current) return;

        clickAudioRef.current.currentTime = 0;
        clickAudioRef.current.play();
      } catch (error) {
        console.error(error);
      }
    };

    const playHover = () => {
      try {
        if (!hoverAudioRef.current) return;

        hoverAudioRef.current.currentTime = 0;
        hoverAudioRef.current.play();
      } catch (error) {
        console.error(error);
      }
    };

    const handleMouseDown = (event: MouseEvent) => {
      // left click only
      if (event.button === 0) {
        playClick();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (INTERACTION_KEYS.includes(event.key)) {
        // avoid spam while holding key
        if (!event.repeat) {
          playClick();
        }
      }
    };

    const handleMouseOver = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;

      if (!target) return;

      const interactiveElement = target.closest(
        'button, a, input, select, textarea, [role="button"]'
      );

      if (interactiveElement) {
        playHover();
      }
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKeyDown);

    if (hoverSoundSrc) {
      window.addEventListener('mouseover', handleMouseOver);
    }

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown);

      if (hoverSoundSrc) {
        window.removeEventListener('mouseover', handleMouseOver);
      }
    };
  }, [clickSoundSrc, volume]);

  return null;
}