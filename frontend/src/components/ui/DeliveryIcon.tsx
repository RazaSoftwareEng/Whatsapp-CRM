import { Check, CheckCheck, Clock, X } from "lucide-react";

export function DeliveryIcon({ status }: { status: string }) {
  if (status === "read") return <CheckCheck size={13} style={{ color: "var(--whatsapp-strong)" }} />;
  if (status === "delivered") return <CheckCheck size={13} />;
  if (status === "sent") return <Check size={13} />;
  if (status === "failed") return <X size={13} style={{ color: "var(--danger)" }} />;
  return <Clock size={12} />;
}
