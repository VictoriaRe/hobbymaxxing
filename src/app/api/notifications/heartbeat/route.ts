import { apiError, databaseRequest, deviceHashFromRequest, isPushConfigured } from "../lib";

export async function POST(request: Request) {
  if (!isPushConfigured()) return apiError("Push notifications are not configured.", 503);
  const deviceHash = deviceHashFromRequest(request);
  if (!deviceHash) return apiError("This device could not be verified.", 401);
  try {
    await databaseRequest(`push_devices?device_hash=eq.${deviceHash}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ last_active_at: new Date().toISOString() }),
    });
    return new Response(null, { status: 204 });
  } catch {
    return apiError("This device could not be updated right now.", 503);
  }
}
