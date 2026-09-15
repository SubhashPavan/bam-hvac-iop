import { useState, useCallback, useRef, useEffect } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

interface SplitPanelProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultLeftWidth?: number;
  minLeftWidth?: number;
  minRightWidth?: number;
  /** When true, the left panel is hidden AND the toggle button disabled,
      forcing the right side to take the full width. Used when the canvas
      shows a Deep Analysis tab so chat doesn't compete for space. */
  hideLeft?: boolean;
}

export default function SplitPanel({
  left,
  right,
  defaultLeftWidth = 440,
  minLeftWidth = 340,
  minRightWidth = 420,
  hideLeft = false,
}: SplitPanelProps) {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [userCollapsed, setUserCollapsed] = useState(false);
  const collapsed = hideLeft || userCollapsed;
  const setCollapsed = setUserCollapsed;
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevWidth = useRef(defaultLeftWidth);

  const handleMouseDown = useCallback(() => {
    if (collapsed) return;
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [collapsed]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;
      const maxLeftWidth = containerRect.width - minRightWidth - 6;
      setLeftWidth(Math.max(minLeftWidth, Math.min(maxLeftWidth, newWidth)));
    },
    [minLeftWidth, minRightWidth]
  );

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const toggleCollapse = useCallback(() => {
    if (collapsed) {
      setCollapsed(false);
      setLeftWidth(prevWidth.current);
    } else {
      prevWidth.current = leftWidth;
      setCollapsed(true);
    }
  }, [collapsed, leftWidth]);

  return (
    <div ref={containerRef} className="flex flex-1 overflow-hidden">
      {/* Left panel */}
      <div
        className="flex shrink-0 flex-col overflow-hidden"
        style={{
          width: collapsed ? 0 : leftWidth,
          transition: collapsed ? 'width 0.25s cubic-bezier(0.4,0,0.2,1)' : undefined,
        }}
      >
        {!collapsed && left}
      </div>

      {/* Split handle — hidden entirely when chat is force-hidden by parent */}
      {!hideLeft && (
        <div
          className={`group relative flex w-[6px] shrink-0 cursor-col-resize items-center justify-center bg-navy-100 transition-colors hover:bg-accent-300 ${
            collapsed ? 'cursor-default' : ''
          }`}
          onMouseDown={handleMouseDown}
        >
          <button
            type="button"
            className="absolute left-1/2 top-1/2 z-10 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-navy-200 bg-white text-navy-500 shadow-md transition-all hover:scale-110 hover:border-accent-400 hover:text-accent-600"
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapse();
            }}
            title={collapsed ? 'Show chat panel' : 'Hide chat panel'}
          >
            {collapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}

      {/* Right panel */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">{right}</div>
    </div>
  );
}
