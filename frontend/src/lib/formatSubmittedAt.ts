const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Formats a server timestamp for the viewer's local clock and zone label, e.g.
 * `2026-01-13 15:12 (GMT)`.
 */
export function formatSubmittedAtLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  const y = d.getFullYear();
  const mo = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const localPart = `${y}-${mo}-${day} ${h}:${mi}`;

  const tz =
    Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
      .formatToParts(d)
      .find((p) => p.type === "timeZoneName")
      ?.value?.trim() ?? "UTC";

  return `${localPart} (${tz})`;
}
