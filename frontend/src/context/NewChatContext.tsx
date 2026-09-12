"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type NewChatContextValue = {
  requestId: number;
  requestNewChat: () => void;
};

const NewChatContext = createContext<NewChatContextValue | null>(null);

/** Lets a persistent sidebar button ("New chat") tell the chats page,
 * mounted separately under it, to pop open its add-contact form. */
export function NewChatProvider({ children }: { children: ReactNode }) {
  const [requestId, setRequestId] = useState(0);
  return (
    <NewChatContext.Provider value={{ requestId, requestNewChat: () => setRequestId((n) => n + 1) }}>
      {children}
    </NewChatContext.Provider>
  );
}

export function useNewChatRequest() {
  const ctx = useContext(NewChatContext);
  if (!ctx) throw new Error("useNewChatRequest must be used within a NewChatProvider");
  return ctx;
}
