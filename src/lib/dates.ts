import { format } from "date-fns";

/** Day label (like 2026-09-21) in phone time, not server time.
 *  Server time misfiles late-night notes under the wrong day. */
export function localDayKey(iso: string): string {
    return format(new Date(iso), "yyyy-MM-dd");
}

/** Today's label in phone time. */
export function todayKey(now: Date = new Date()): string {
    return format(now, "yyyy-MM-dd");
}
