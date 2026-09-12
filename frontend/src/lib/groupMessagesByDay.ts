import { dayLabel } from "./format";
import type { Message } from "@/types/admin";

export type MessageFeedItem = { kind: "divider"; label: string } | { kind: "message"; message: Message };

/** Interleaves date-divider entries ("Today", "Yesterday", ...) between messages
 * from different calendar days, in order, ready to `.map()` over directly. */
export function groupMessagesByDay(messages: Message[]): MessageFeedItem[] {
  const items: MessageFeedItem[] = [];
  let lastLabel = "";
  for (const message of messages) {
    const label = dayLabel(message.sent_at);
    if (label !== lastLabel) {
      items.push({ kind: "divider", label });
      lastLabel = label;
    }
    items.push({ kind: "message", message });
  }
  return items;
}
