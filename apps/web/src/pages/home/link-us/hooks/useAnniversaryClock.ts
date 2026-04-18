import { useState, useEffect, useCallback } from 'react';
import { ANNIVERSARY } from '../constants';

export type AnniversaryClock = {
  days: string | number;
  hours: string | number;
  minutes: string | number;
  seconds: string | number;
};

const initial: AnniversaryClock = {
  days: '...',
  hours: '...',
  minutes: '...',
  seconds: '...',
};

export function useAnniversaryClock() {
  const [anniversary, setAnniversary] = useState<AnniversaryClock>(initial);

  const tick = useCallback(() => {
    const now = new Date();
    const diff = now.getTime() - ANNIVERSARY.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    setAnniversary({ days, hours, minutes, seconds });
  }, []);

  useEffect(() => {
    const runSoon = window.setTimeout(() => {
      tick();
    }, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      clearTimeout(runSoon);
      clearInterval(id);
    };
  }, [tick]);

  return anniversary;
}
