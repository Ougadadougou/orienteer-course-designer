import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

interface ResizableSplitProps {
  left: React.ReactNode;
  right: React.ReactNode;
  splitRatio: number;
  onSplitRatioChange: (ratio: number) => void;
  isRightPaneVisible?: boolean;
  minLeftWidth?: number;
  minRightWidth?: number;
  dividerWidth?: number;
  className?: string;
}

export const ResizableSplit: React.FC<ResizableSplitProps> = ({
  left,
  right,
  splitRatio,
  onSplitRatioChange,
  isRightPaneVisible = true,
  minLeftWidth = 320,
  minRightWidth = 320,
  dividerWidth = 6,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handlePositionChange = useCallback((clientX: number) => {
    if (!containerRef.current || !isRightPaneVisible) return;

    const rect = containerRef.current.getBoundingClientRect();
    const totalWidth = rect.width;
    if (totalWidth <= 0) return;

    const availableWidth = totalWidth - dividerWidth;
    const minLeft = minLeftWidth;
    const maxLeft = availableWidth - minRightWidth;

    if (maxLeft <= minLeft) return;

    const rawLeft = clientX - rect.left;
    const clampedLeft = clamp(rawLeft, minLeft, maxLeft);
    const newRatio = clamp(clampedLeft / totalWidth, 0, 1);
    onSplitRatioChange(newRatio);
  }, [dividerWidth, isRightPaneVisible, minLeftWidth, minRightWidth, onSplitRatioChange]);

  const handlePointerDown = useCallback((event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    event.preventDefault();
    if ('touches' in event) {
      if (event.touches.length > 0) {
        handlePositionChange(event.touches[0].clientX);
      }
    } else {
      handlePositionChange(event.clientX);
    }
    setIsDragging(true);
  }, [handlePositionChange]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (event: MouseEvent) => {
      handlePositionChange(event.clientX);
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length > 0) {
        handlePositionChange(event.touches[0].clientX);
      }
    };

    const stopDragging = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopDragging);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', stopDragging);
    window.addEventListener('touchcancel', stopDragging);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopDragging);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', stopDragging);
      window.removeEventListener('touchcancel', stopDragging);
    };
  }, [handlePositionChange, isDragging]);

  useEffect(() => {
    if (!isRightPaneVisible && isDragging) {
      setIsDragging(false);
    }
  }, [isDragging, isRightPaneVisible]);

  const leftRatio = isRightPaneVisible ? clamp(splitRatio, 0, 1) : 1;
  const leftStyle = useMemo<React.CSSProperties>(() => {
    if (!isRightPaneVisible) {
      return { flex: 1, width: '100%' };
    }

    return {
      width: `${leftRatio * 100}%`,
      flexBasis: `${leftRatio * 100}%`,
      minWidth: minLeftWidth,
    };
  }, [isRightPaneVisible, leftRatio, minLeftWidth]);

  const rightStyle = useMemo<React.CSSProperties>(() => ({
    width: `${(1 - leftRatio) * 100}%`,
    flexBasis: `${(1 - leftRatio) * 100}%`,
    minWidth: minRightWidth,
  }), [leftRatio, minRightWidth]);

  const showRightPane = isRightPaneVisible && !!right;

  return (
    <div ref={containerRef} className={`flex h-full w-full min-w-0 ${className}`}>
      <div className="flex h-full min-w-0 overflow-hidden" style={leftStyle}>
        {left}
      </div>
      {showRightPane && (
        <div
          role="separator"
          aria-orientation="vertical"
          tabIndex={-1}
          onMouseDown={handlePointerDown}
          onTouchStart={handlePointerDown}
          className={`flex h-full cursor-col-resize items-center justify-center ${isDragging ? 'bg-gray-700/40' : ''}`}
          style={{ width: dividerWidth }}
        >
          <div className={`h-2/3 w-[2px] rounded-full bg-gray-700 ${isDragging ? 'bg-teal-400' : ''}`} />
        </div>
      )}
      {showRightPane && (
        <div className="flex h-full min-w-0 flex-shrink-0 flex-col overflow-hidden" style={rightStyle}>
          {right}
        </div>
      )}
    </div>
  );
};
