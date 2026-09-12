import { useEffect, useRef, useState } from "react";

const NEAR_BOTTOM_PX = 80;

/**
 * Keeps a message-list container scrolled to the latest message.
 *
 * - Switching chats always jumps straight to the bottom (the newest message).
 * - A new message while already near the bottom auto-scrolls smoothly.
 * - A new message while scrolled up leaves the view alone and instead flags
 *   `showJump` so the caller can show a "New message" button.
 */
export function useAutoScroll(messageCount: number, activeId: number | string | null) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showJump, setShowJump] = useState(false);
  const prevCountRef = useRef(0);
  const prevActiveRef = useRef(activeId);

  function isNearBottom() {
    const el = containerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  }

  function scrollToBottom(smooth = false) {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    setShowJump(false);
  }

  useEffect(() => {
    const chatSwitched = prevActiveRef.current !== activeId;
    prevActiveRef.current = activeId;

    if (chatSwitched) {
      prevCountRef.current = messageCount;
      requestAnimationFrame(() => scrollToBottom(false));
      return;
    }

    const grew = messageCount > prevCountRef.current;
    prevCountRef.current = messageCount;
    if (!grew) return;

    if (isNearBottom()) {
      requestAnimationFrame(() => scrollToBottom(true));
    } else {
      requestAnimationFrame(() => setShowJump(true));
    }
  }, [messageCount, activeId]);

  function onScroll() {
    if (isNearBottom()) setShowJump(false);
  }

  return { containerRef, showJump, scrollToBottom, onScroll };
}
