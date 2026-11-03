import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isNotificationSettings, suggestedNotificationSettings } from "./notification-types.ts";

describe("notification settings", () => {
  it("suggests reminder days and a time from onboarding availability", () => {
    const settings = suggestedNotificationSettings(["Weekday mornings", "Weekend evenings"]);
    assert.deepEqual(settings.reminderDays, [0, 1, 2, 3, 4, 5, 6]);
    assert.equal(settings.reminderTime, "19:00");
    assert.equal(settings.inactivityNudges, false);
    assert.equal(settings.weeklyRecaps, false);
  });

  it("validates the saved settings shape", () => {
    const settings = suggestedNotificationSettings([]);
    assert.equal(isNotificationSettings(settings), true);
    assert.equal(isNotificationSettings({ ...settings, reminderDays: ["Monday"] }), false);
  });
});
