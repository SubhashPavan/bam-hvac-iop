import {
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

interface LazyMountProps {
  /** Approximate height to reserve before mounting (px). */
  placeholderHeight?: number;
  /** Margin around viewport that still counts as visible. */
  rootMargin?: string;
  /** Once mounted, never unmount (default true — avoids losing chart state). */
  keepAlive?: boolean;
  /** When true, the wrapper has `h-full w-full`. Use this only when the
   *  parent has a fixed height (e.g. canvas grid cell). In natural-flow
   *  contexts (DeepInsightView page scroll), leave this false so the
   *  wrapper sizes itself from its children. */
  fillParent?: boolean;
  children: ReactNode;
  /** Catch-all for props the parent wants forwarded to the wrapped
   *  child (e.g. `showData` driven by an outer toolbar button). When
   *  the child is a single React element we clone it with these props
   *  merged in. Without this, intermediate LazyMount layers swallowed
   *  props like `showData` so toggles never reached the actual chart. */
  [key: string]: unknown;
}

/**
 * Mount children only when scrolled into (or near) the viewport.
 *
 * Used to wrap heavy content (charts, sections, deep blocks) so off-screen
 * recharts SVGs don't run their render passes. Big perf win when a single
 * tab has many charts.
 */
export default function LazyMount({
  placeholderHeight = 300,
  rootMargin = '200px',
  keepAlive = true,
  fillParent = false,
  children,
  ...rest
}: LazyMountProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            if (keepAlive) observer.disconnect();
          } else if (!keepAlive) {
            setVisible(false);
          }
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin, keepAlive]);

  // When children are mounted, size the wrapper from content. Only the
  // placeholder reserves vertical space to keep the page-scroll from
  // jumping when content swaps in.
  const wrapperClass = fillParent ? 'h-full w-full' : 'w-full';

  // If the parent passed extra props (e.g. CanvasBlock clones LazyMount
  // with `showData`), and our child is a single React element, forward
  // those props to it so toggles like "View data" actually reach the
  // ChartBlock buried inside.
  const renderedChildren =
    isValidElement(children) && Object.keys(rest).length > 0
      ? cloneElement(children as React.ReactElement<Record<string, unknown>>, rest)
      : children;

  return (
    <div ref={ref} className={wrapperClass}>
      {visible ? (
        renderedChildren
      ) : (
        <div
          className="w-full animate-pulse rounded-xl bg-navy-50/40"
          style={{ height: placeholderHeight }}
        />
      )}
    </div>
  );
}
