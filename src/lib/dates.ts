import { addDays, format } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
export const TIMEZONE = "Asia/Dhaka";
export function bounds(now = new Date(), timezone = TIMEZONE) {
  const local = toZonedTime(now, timezone);
  const today = format(local, "yyyy-MM-dd");
  const start = fromZonedTime(today + "T00:00:00", timezone).toISOString();
  const end = fromZonedTime(
    format(addDays(local, 1), "yyyy-MM-dd") + "T00:00:00",
    timezone,
  ).toISOString();
  const upcomingEnd = fromZonedTime(
    format(addDays(local, 8), "yyyy-MM-dd") + "T00:00:00",
    timezone,
  ).toISOString();
  return { now: now.toISOString(), start, end, upcomingEnd };
}
export function dateBoundary(date: string, timezone = TIMEZONE, next = false) {
  const parsed = fromZonedTime(date + "T00:00:00", timezone);
  if (
    Number.isNaN(parsed.valueOf()) ||
    format(toZonedTime(parsed, timezone), "yyyy-MM-dd") !== date
  )
    throw new Error("Invalid calendar date.");
  return next
    ? fromZonedTime(
        format(addDays(toZonedTime(parsed, timezone), 1), "yyyy-MM-dd") +
          "T00:00:00",
        timezone,
      ).toISOString()
    : parsed.toISOString();
}
export function toInputDate(iso: string | null) {
  return iso ? format(toZonedTime(iso, TIMEZONE), "yyyy-MM-dd'T'HH:mm") : "";
}
export function fromInputDate(value: string) {
  return value ? fromZonedTime(value, TIMEZONE).toISOString() : null;
}
export function displayDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: TIMEZONE,
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "No deadline";
}
