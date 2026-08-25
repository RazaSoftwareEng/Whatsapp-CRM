export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
}
