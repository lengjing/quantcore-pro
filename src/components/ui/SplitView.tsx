import React, { useRef, useState, useCallback, useEffect } from 'react';

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
  /** First pane content. */
  children: [React.ReactNode, React.ReactNode];
  /** Additional className for the container. */
  className?: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * A VSCode-style split-view component with a draggable divider
 * that allows users to resize two adjacent panes.
 */
export const SplitView = ({
  direction = 'horizontal',
  initialSize,
  minSize = 100,
  minSecondSize = 100,
  children,
  className = '',
}: SplitViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [firstSize, setFirstSize] = useState<number | null>(initialSize ?? null);
  const [isDragging, setIsDragging] = useState(false);
  const startPosRef = useRef(0);
  const startSizeRef = useRef(0);

  const isHorizontal = direction === 'horizontal';

  // Initialize size from container if no initialSize given
  useEffect(() => {
    if (firstSize === null && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const total = isHorizontal ? rect.width : rect.height;
      setFirstSize(Math.round(total * 0.5));
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
      newSize = Math.max(minSize, Math.min(newSize, totalSize - minSecondSize - 4));
      setFirstSize(newSize);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isHorizontal, minSize, minSecondSize]);

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
