import { useRef, useState, type PointerEvent } from "react";

const TRIGGER = 56;
const MAX = 80;

export function useSwipeToReply(onReply: (() => void) | undefined) {
  const [offset, setOffset] = useState(0);
  const start = useRef<{ x: number; y: number; horizontal?: boolean } | null>(null);

  const reset = () => {
    start.current = null;
    setOffset(0);
  };

  const handlers = {
    onPointerDown: (e: PointerEvent) => {
      if (onReply && e.pointerType === "touch") start.current = { x: e.clientX, y: e.clientY };
    },
    onPointerMove: (e: PointerEvent) => {
      const s = start.current;
      if (!s) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (s.horizontal === undefined && Math.hypot(dx, dy) > 8) s.horizontal = Math.abs(dx) > Math.abs(dy) && dx > 0;
      if (!s.horizontal) return;
      const next = Math.min(MAX, Math.max(0, dx));
      if (offset < TRIGGER && next >= TRIGGER) navigator.vibrate?.(10);
      setOffset(next);
    },
    onPointerCancel: reset,
  };

  const end = () => {
    if (offset >= TRIGGER) onReply?.();
    reset();
  };

  return { offset, progress: Math.min(1, offset / TRIGGER), handlers, end };
}
