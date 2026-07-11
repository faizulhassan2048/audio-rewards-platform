// Pakistan Standard Time is UTC+5 year-round (no daylight saving),
// so this offset-based approach is safe regardless of what timezone
// the server itself runs in (Vercel/Supabase functions run in UTC).
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000

// Returns the next upcoming midnight (00:00 PKT) as a UTC Date instant.
// Example: if it's currently 3:00 PM PKT on July 11, this returns
// the UTC instant equal to 12:00 AM PKT on July 12.
export function getNextMidnightPKT(from: Date = new Date()): Date {
  const nowPKT = new Date(from.getTime() + PKT_OFFSET_MS)
  const nextMidnightPKT = new Date(
    Date.UTC(
      nowPKT.getUTCFullYear(),
      nowPKT.getUTCMonth(),
      nowPKT.getUTCDate() + 1,
      0, 0, 0, 0
    )
  )
  return new Date(nextMidnightPKT.getTime() - PKT_OFFSET_MS)
}
