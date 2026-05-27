import React, { useRef, useState, useCallback, useEffect } from 'react';
import { loadState, saveState } from '../../utils/storage';

// ── Types ──────────────────────────────────────────────────────────────────────

interface SplitViewProps {
  /** Direction of the split: horizontal splits left/right, vertical splits top/bottom. */
  direction?: 'horizontal' | 'vertical';
  /** Initial size (px) of the first pane. Defaults to 50% of the container. */
  initialSize?: number;
  /** Minimum size (px) of the first pane. */
  minSize?: number;
  /** Minimum size (px) of the second pane. */
  minSecondSize?: number;
  /**
   * When provided, the pane sizes are persisted to localStorage under this key.
   * Supports nested SplitViews — each should use a unique persistKey.
   */
  persistKey?: string;
  /** Two child panes. */
  children: [React.ReactNode, React.ReactNode];
  /** Additional className for the container. */
  className?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const DIVIDER_SIZE = 4; // px

function loadPersistedSize(key: string | undefined): number | null {
  if (!key) return null;
  const stored = loadState<number | null>(`splitview:${key}`, null);
  return typeof stored === 'number' ? stored : null;
}

function persistSize(key: string | undefined, size: number): void {
  if (!key) return;
  saveState(`splitview:${key}`, size);
}

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * A VSCode-style split-view component with a draggable divider
 * that allows users to resize two adjacent panes.
 *
 * Features:
 *  - Horizontal or vertical splitting
 *  - Draggable divider with min-size clamping
 *  - Optional localStorage persistence via `persistKey`
 *  - Nestable: combine horizontal + vertical SplitViews for grid layouts
 */
export const SplitView = ({
  direction = 'horizontal',
  initialSize,
  minSize = 100,
  minSecondSize = 100,
  persistKey,
  children,
  className = '',
}: SplitViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isHorizontal = direction === 'horizontal';

  // Resolve initial size: persisted > prop > 50%
  const [firstSize, setFirstSize] = useState<number | null>(() => {
    const persisted = loadPersistedSize(persistKey);
    return persisted ?? initialSize ?? null;
  });

  const [isDragging, setIsDragging] = useState(false);
  const startPosRef = useRef(0);
  const startSizeRef = useRef(0);

  // Initialize size from container when no persisted/initial value
  useEffect(() => {
    if (firstSize === null && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const total = isHorizontal ? rect.width : rect.height;
      const computed = Math.round(total * 0.5);
      setFirstSize(computed);
    }
  }, [firstSize, isHorizontal]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      startPosRef.current = isHorizontal ? e.clientX : e.clientY;
      startSizeRef.current = firstSize ?? 0;
    },
    [firstSize, isHorizontal],
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const totalSize = isHorizontal ? rect.width : rect.height;
      const delta = (isHorizontal ? e.clientX : e.clientY) - startPosRef.current;
      let newSize = startSizeRef.current + delta;

      // Clamp to min/max
      newSize = Math.max(minSize, Math.min(newSize, totalSize - minSecondSize - DIVIDER_SIZE));
      setFirstSize(newSize);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      // Persist final size on mouse up
      if (firstSize != null) {
        persistSize(persistKey, firstSize);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isHorizontal, minSize, minSecondSize, firstSize, persistKey]);

  // Also persist after dragging ends via state update
  const prevDraggingRef = useRef(isDragging);
  useEffect(() => {
    if (prevDraggingRef.current && !isDragging && firstSize != null) {
      persistSize(persistKey, firstSize);
    }
    prevDraggingRef.current = isDragging;
  }, [isDragging, firstSize, persistKey]);

  const dividerCursor = isHorizontal ? 'cursor-col-resize' : 'cursor-row-resize';

  return (
    <div
      ref={containerRef}
      className={`flex ${isHorizontal ? 'flex-row' : 'flex-col'} ${className}`}
      style={{ userSelect: isDragging ? 'none' : undefined }}
    >
      {/* First pane */}
      <div
        className="overflow-hidden min-w-0 min-h-0 shrink-0"
        style={
          firstSize !== null
            ? { [isHorizontal ? 'width' : 'height']: firstSize }
            : { flex: 1 }
        }
      >
        {children[0]}
      </div>

      {/* Draggable divider */}
      <div
        onMouseDown={handleMouseDown}
        className={`${dividerCursor} shrink-0 ${isHorizontal ? 'w-1 hover:w-1' : 'h-1 hover:h-1'} ${isDragging ? 'bg-terminal-accent' : 'bg-transparent hover:bg-terminal-accent/50'} transition-colors z-10`}
      />

      {/* Second pane */}
      <div className="flex-1 overflow-hidden min-w-0 min-h-0">
        {children[1]}
      </div>
    </div>
  );
};
