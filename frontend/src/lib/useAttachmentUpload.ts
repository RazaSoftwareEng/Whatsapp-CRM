import { useState } from "react";
import { api } from "@/lib/api";

/** Uploads a file to the active chat via /messages/send_media/, then lets the
 * caller refresh that chat's messages. Shared by every chat view's composer. */
export function useAttachmentUpload(chatId: number | null, onSent: () => void) {
  const [attaching, setAttaching] = useState(false);

  async function upload(file: File) {
    if (!chatId) return;
    setAttaching(true);
    const formData = new FormData();
    formData.append("chat", String(chatId));
    formData.append("file", file);
    try {
      await api.post("/messages/send_media/", formData);
      onSent();
    } catch {
      alert("Could not send this attachment.");
    } finally {
      setAttaching(false);
    }
  }

  return { attaching, upload };
}
