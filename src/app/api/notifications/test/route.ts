import {
  apiError,
  databaseRequest,
  deviceHashFromRequest,
  isExpiredSubscriptionError,
  isPushConfigured,
  sendPush,
  type PushDevice,
} from "../lib";

export async function POST(request: Request) {
  if (!isPushConfigured()) return apiError("Push notifications are not configured.", 503);
  const deviceHash = deviceHashFromRequest(request);
  if (!deviceHash) return apiError("This device could not be verified.", 401);

  try {
    const devices = await databaseRequest<PushDevice[]>(
      `push_devices?device_hash=eq.${deviceHash}&select=device_hash,subscription,settings,last_active_at&limit=1`,
    );
    const device = devices[0];
    if (!device) return apiError("This device is not subscribed.", 404);
    try {
      await sendPush(device.subscription, {
        title: "A little hello 🌷",
        body: "Your Hobbymaxxing test notification is ready.",
        url: "/?view=ideas",
        tag: "hobbymaxxing-test",
      });
    } catch (error) {
      if (isExpiredSubscriptionError(error)) {
        await databaseRequest(`push_devices?device_hash=eq.${deviceHash}`, { method: "DELETE" });
        return apiError("This browser subscription has expired. Enable notifications again on this device.", 410);
      }
      console.error("Test push delivery failed.");
      return apiError("The test notification could not be delivered. Check your push configuration and try again.", 502);
    }
    return Response.json({ sent: true });
  } catch {
    return apiError("The test notification could not be sent right now.", 503);
  }
}
