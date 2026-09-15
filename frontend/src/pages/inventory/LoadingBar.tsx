import { useEffect, useRef, useState } from 'react';
import { onInflight } from '../../services/inventoryApi';

/** Live count of inventory API requests currently in flight. */
export function useInflight(): number {
  const [n, setN] = useState(0);
  useEffect(() => onInflight(setN), []);
  return n;
}

/**
 * Thin YouTube-style progress bar pinned to the top of its positioned parent.
 * Appears whenever any inventory API call is running (mock content already shows,
 * so this signals "populating with live data"), creeps toward 90%, then snaps to
 * 100% and fades when the last request settles.
 */
export function TopProgressBar() {
  const inflight = useInflight();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const fade = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (inflight > 0) {
      if (fade.current) { clearTimeout(fade.current); fade.current = null; }
      setVisible(true);
      setWidth((w) => (w < 8 ? 8 : w));
      if (!timer.current) {
        timer.current = setInterval(() => {
          // ease toward 90% — slower as it approaches
          setWidth((w) => (w >= 90 ? 90 : w + (90 - w) * 0.12));
        }, 220);
      }
    } else {
      if (timer.current) { clearInterval(timer.current); timer.current = null; }
      setWidth(100);
      fade.current = setTimeout(() => { setVisible(false); setWidth(0); }, 350);
    }
    return () => {
      if (timer.current) { clearInterval(timer.current); timer.current = null; }
    };
  }, [inflight]);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-50 h-[3px]" aria-hidden>
      <div
        className="h-full bg-gradient-to-r from-accent-400 to-accent-600 shadow-[0_0_8px_var(--color-accent-500,#6366f1)] transition-[width,opacity] duration-300 ease-out"
        style={{ width: `${width}%`, opacity: visible ? 1 : 0 }}
      />
    </div>
  );
}

/** Small inline spinner circle for panels that start empty. */
export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-navy-200 border-t-accent-500 dark:border-slate-700 dark:border-t-accent-400 ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

/** Centered loader block with a message — for a panel/region that has no content yet. */
export function LoaderBlock({ label = 'Loading…', className = '' }: { label?: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-2.5 text-[14px] text-navy-400 dark:text-slate-500 ${className}`}>
      <Spinner /> {label}
    </div>
  );
}
