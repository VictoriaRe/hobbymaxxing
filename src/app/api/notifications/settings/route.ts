import {
  apiError,
  databaseRequest,
  deviceHashFromRequest,
  isPushConfigured,
  isStorageConfigured,
  isValidSubscription,
  validSettings,
} from "../lib";

type SettingsBody = { subscription?: unknown; settings?: unknown };

export async function PUT(request: Request) {
  if (!isPushConfigured()) return apiError("Push notifications are not configured.", 503);
  const deviceHash = deviceHashFromRequest(request);
  if (!deviceHash) return apiError("This device could not be verified.", 401);

  let body: SettingsBody;
  try {
    body = await request.json() as SettingsBody;
  } catch {
    return apiError("Invalid request body.", 400);
  }
  if (!isValidSubscription(body.subscription) || !validSettings(body.settings)) {
    return apiError("Check the notification subscription and schedule settings.", 400);
  }

  try {
    await databaseRequest("push_devices?on_conflict=device_hash", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        device_hash: deviceHash,
        subscription: body.subscription,
        settings: body.settings,
        last_active_at: new Date().toISOString(),
      }),
    });
    return Response.json({ saved: true });
  } catch {
    return apiError("Your notification settings could not be saved right now.", 503);
  }
}

export async function DELETE(request: Request) {
  if (!isStorageConfigured()) return apiError("Notification storage is not configured.", 503);
  const deviceHash = deviceHashFromRequest(request);
  if (!deviceHash) return apiError("This device could not be verified.", 401);
  try {
    await databaseRequest(`push_devices?device_hash=eq.${deviceHash}`, { method: "DELETE" });
    return new Response(null, { status: 204 });
  } catch {
    return apiError("This device could not be unsubscribed right now.", 503);
  }
}
