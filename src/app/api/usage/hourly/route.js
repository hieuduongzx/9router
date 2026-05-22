import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/db/driver";

// Build a 24-bucket array starting 23 hours ago (oldest first) up through the
// current hour. Each bucket counts requests in usageHistory whose timestamp
// falls inside that hour. The bucket for the current local hour is flagged
// with `isCurrent: true` so the dashboard can highlight it.
export async function GET() {
  try {
    const db = await getAdapter();

    const now = new Date();
    const currentHour = new Date(now);
    currentHour.setMinutes(0, 0, 0);
    const startTime = new Date(currentHour);
    startTime.setHours(startTime.getHours() - 23);

    const buckets = [];
    for (let i = 0; i < 24; i++) {
      const d = new Date(startTime);
      d.setHours(startTime.getHours() + i);
      buckets.push({
        hour: `${String(d.getHours()).padStart(2, "0")}:00`,
        timestamp: d.getTime(),
        requests: 0,
        isCurrent: d.getTime() === currentHour.getTime(),
      });
    }

    const rows = db.all(
      "SELECT timestamp FROM usageHistory WHERE timestamp >= ?",
      [startTime.toISOString()],
    );

    const startMs = startTime.getTime();
    const endMs = currentHour.getTime() + 3600 * 1000;
    for (const r of rows) {
      const t = new Date(r.timestamp).getTime();
      if (t < startMs || t >= endMs) continue;
      const idx = Math.min(Math.floor((t - startMs) / (3600 * 1000)), 23);
      if (idx >= 0) buckets[idx].requests += 1;
    }

    return NextResponse.json(buckets);
  } catch (error) {
    console.error("[API] Failed to get hourly activity:", error);
    return NextResponse.json({ error: "Failed to fetch hourly activity" }, { status: 500 });
  }
}
