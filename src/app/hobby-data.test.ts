import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createHobbyProfile,
  getActivityDurationSeconds,
  getJournalingPrompt,
  getJournalingDurationRange,
  getSuggestedJournalingDuration,
  getSuggestedActivityDuration,
  journalingPromptLibrary,
  recommendActivities,
  type Activity,
  type Hobby,
  type Preferences,
} from "./hobby-data.ts";

function preferencesFor(
  hobbyIds: string[],
  profiles: Preferences["profiles"] = {},
  customHobbies: Hobby[] = [],
): Preferences {
  return {
    profiles,
    preferredTimes: [],
    completed: true,
    customHobbies,
    selectedHobbyIds: hobbyIds,
    schemaVersion: 2,
  };
}

describe("recommendActivities", () => {
  it("returns three distinct hobbies for four selected hobbies with unanswered enjoyment", () => {
    const ids = ["yoga", "pilates", "puzzles", "journaling"];
    const profiles = Object.fromEntries(ids.map((id) => [id, createHobbyProfile()]));
    const all = recommendActivities(preferencesFor(ids, profiles), "inside", 30, 3, { includeAll: true });
    const shortlist = recommendActivities(preferencesFor(ids, profiles), "inside", 30, 3);

    assert.ok(all.length >= 4);
    assert.equal(new Set(all.map((activity) => activity.hobbyId)).size, 4);
    assert.equal(shortlist.length, 3);
    assert.equal(new Set(shortlist.map((activity) => activity.hobbyId)).size, 3);
    assert.ok(Object.values(profiles).every((profile) => profile.enjoyment === null));
  });

  it("generates candidates for selected hobbies without saved profiles", () => {
    const ids = ["yoga", "pilates", "puzzles", "knitting"];
    const all = recommendActivities(preferencesFor(ids), "inside", 30, 3, { includeAll: true });
    assert.deepEqual(new Set(all.map((activity) => activity.hobbyId)), new Set(ids));
  });

  it("honors inside and outside activity constraints", () => {
    const prefs = preferencesFor(["reading"]);
    for (const place of ["inside", "outside"] as const) {
      const suggestions = recommendActivities(prefs, place, 30, 3, { includeAll: true });
      assert.ok(suggestions.length > 0);
      assert.ok(suggestions.every((activity) => activity.place === place || activity.place === "either"));
    }
    assert.ok(recommendActivities(prefs, "inside", 30, 3, { includeAll: true }).some((activity) => activity.id === "read-chapter"));
    assert.ok(recommendActivities(prefs, "outside", 30, 3, { includeAll: true }).some((activity) => activity.id === "read-outside"));
  });

  it("uses hobby location defaults and explicit location preferences", () => {
    const yoga = createHobbyProfile();
    const pilates = createHobbyProfile();
    const outsideYoga = createHobbyProfile();
    const outsidePilates = createHobbyProfile();
    outsideYoga.activityLocation = "Outside";
    outsidePilates.activityLocation = "Outside";

    assert.deepEqual(recommendActivities(preferencesFor(["running"]), "inside", 30, 3), []);
    assert.deepEqual(recommendActivities(preferencesFor(["yoga"]), "outside", 30, 3), []);
    assert.deepEqual(recommendActivities(preferencesFor(["pilates"]), "outside", 30, 3), []);
    assert.ok(recommendActivities(preferencesFor(["yoga", "pilates"], { yoga, pilates }), "inside", 30, 3)
      .some((activity) => activity.hobbyId === "yoga"));
    assert.ok(recommendActivities(preferencesFor(["yoga", "pilates"], { yoga, pilates }), "inside", 30, 3)
      .some((activity) => activity.hobbyId === "pilates"));
    assert.ok(recommendActivities(preferencesFor(["yoga"], { yoga: outsideYoga }), "outside", 30, 3)
      .some((activity) => activity.hobbyId === "yoga"));
    assert.ok(recommendActivities(preferencesFor(["pilates"], { pilates: outsidePilates }), "outside", 30, 3)
      .some((activity) => activity.hobbyId === "pilates"));

    const treadmill = createHobbyProfile();
    treadmill.runningLocation = "On a treadmill";
    assert.ok(recommendActivities(preferencesFor(["running"], { running: treadmill }), "inside", 30, 3)
      .some((activity) => activity.hobbyId === "running"));
  });

  it("provides setting-specific gardening, photography, and drawing candidates", () => {
    const insideGarden = recommendActivities(preferencesFor(["gardening"]), "inside", 30, 2, { includeAll: true });
    const outsideGarden = recommendActivities(preferencesFor(["gardening"]), "outside", 30, 2, { includeAll: true });
    assert.ok(insideGarden.some((activity) => activity.id === "garden-indoor-plant"));
    assert.ok(insideGarden.some((activity) => activity.id === "garden-propagate"));
    assert.ok(insideGarden.some((activity) => activity.id === "garden-herbs"));
    assert.ok(outsideGarden.some((activity) => activity.id === "garden-flowers"));
    assert.ok(outsideGarden.some((activity) => activity.id === "garden-bed"));
    assert.ok(outsideGarden.some((activity) => activity.id === "garden-balcony"));

    const indoorPhoto = recommendActivities(preferencesFor(["photography"]), "inside", 30, 2, { includeAll: true });
    const outdoorPhoto = recommendActivities(preferencesFor(["photography"]), "outside", 30, 2, { includeAll: true });
    assert.ok(indoorPhoto.some((activity) => activity.id === "photo-light"));
    assert.ok(outdoorPhoto.some((activity) => activity.id === "photo-outside-challenge"));
    assert.ok(recommendActivities(preferencesFor(["drawing"]), "inside", 30, 2, { includeAll: true })
      .some((activity) => activity.id === "draw-still-life"));
    assert.ok(recommendActivities(preferencesFor(["drawing"]), "outside", 30, 2, { includeAll: true })
      .some((activity) => activity.id === "draw-outside"));
  });

  it("allows crafts in both settings while keeping indoor-only hobbies restricted", () => {
    const outdoorPottery = recommendActivities(preferencesFor(["pottery"]), "outside", 30, 2, { includeAll: true });
    const outdoorKnitting = recommendActivities(preferencesFor(["knitting"]), "outside", 30, 2, { includeAll: true });
    assert.ok(outdoorPottery.some((activity) => activity.id === "pottery-sketch"));
    assert.ok(outdoorKnitting.some((activity) => activity.place === "either"));
    assert.deepEqual(recommendActivities(preferencesFor(["puzzles"]), "outside", 30, 2), []);
  });

  it("keeps candidates available across low, medium, and high energy settings", () => {
    const prefs = preferencesFor(["walking", "running", "photography", "yoga"]);
    for (const energy of [1, 3, 5]) {
      const suggestions = recommendActivities(prefs, "outside", 30, energy, { includeAll: true });
      assert.ok(suggestions.length >= 3);
      assert.ok(suggestions.every((activity) => activity.place === "outside" || activity.place === "either"));
    }
  });

  it("keeps flexible activity durations within 15, 30, and 60 minutes available", () => {
    const ids = ["reading", "knitting", "puzzles", "journaling"];
    const prefs = preferencesFor(ids, Object.fromEntries(ids.map((id) => [id, createHobbyProfile()])));
    for (const availableMinutes of [15, 30, 60]) {
      const suggestions = recommendActivities(prefs, "inside", availableMinutes, 3, { includeAll: true });
      assert.ok(suggestions.every((activity) => activity.duration <= availableMinutes));
      assert.ok(suggestions.every((activity) => activity.availableTimeMinutes === availableMinutes));
    }
    const shortKnitting = recommendActivities(
      preferencesFor(["knitting"], { knitting: createHobbyProfile() }),
      "inside",
      15,
      3,
      { includeAll: true },
    );
    assert.equal(shortKnitting.find((activity) => activity.id === "knit-swatch")?.duration, 15);
  });

  it("caps suggested journaling time to the available-time band", () => {
    assert.deepEqual(getJournalingDurationRange(15), [5, 10]);
    assert.deepEqual(getJournalingDurationRange(30), [10, 15]);
    assert.deepEqual(getJournalingDurationRange(60), [15, 20]);
    assert.equal(getSuggestedJournalingDuration(15), 10);
    assert.equal(getSuggestedJournalingDuration(30), 15);
    assert.equal(getSuggestedJournalingDuration(60), 20);
    assert.deepEqual([15, 30, 60].map((available) => getSuggestedActivityDuration({
      id: "reading",
      hobbyId: "reading",
      title: "Read",
      description: "",
      duration: 15,
      place: "inside",
      energy: 1,
      materials: [],
    }, available)), [15, 25, 45]);
    assert.deepEqual([15, 30, 60].map((available) => getSuggestedActivityDuration({
      id: "flow",
      hobbyId: "yoga",
      title: "Flow",
      description: "",
      duration: 15,
      place: "inside",
      energy: 1,
      materials: [],
    }, available)), [12, 25, 45]);

    const profile = createHobbyProfile();
    profile.journalingPromptPreference = "Yes, give me prompts.";
    const [journal] = recommendActivities(
      preferencesFor(["journaling"], { journaling: profile }),
      "inside",
      60,
      3,
    );
    assert.equal(journal.hobbyId, "journaling");
    assert.ok(journal.duration >= 15 && journal.duration <= 20);
  });

  it("uses local morning and evening prompt categories and keeps the library ordered", () => {
    assert.equal(getJournalingPrompt(8).category, "Morning reflection");
    assert.equal(getJournalingPrompt(19).category, "Evening reflection");
    assert.deepEqual(journalingPromptLibrary.map((section) => section.category), [
      "Morning reflection",
      "Evening reflection",
      "Gratitude",
      "Personal reflection",
      "Creative writing",
    ]);
    assert.equal(new Set(journalingPromptLibrary.flatMap((section) => section.prompts.map((prompt) => prompt.id))).size,
      journalingPromptLibrary.reduce((total, section) => total + section.prompts.length, 0));

    const profile = createHobbyProfile();
    profile.journalingPromptPreference = "No thanks, I prefer free writing.";
    const [journal] = recommendActivities(
      preferencesFor(["journaling"], { journaling: profile }),
      "inside",
      30,
      3,
      { localHour: 8 },
    );
    assert.equal(journal.journalPrompt, undefined);
  });

  it("includes custom hobbies without inventing a resource", () => {
    const custom: Hobby = {
      id: "custom-model-building",
      name: "Model building",
      icon: "🧩",
      color: "sage",
      kind: "custom",
      supplies: [],
    };
    const customProfile = createHobbyProfile();
    customProfile.activityLocation = "Inside";
    const [suggestion] = recommendActivities(
      preferencesFor([custom.id], { [custom.id]: customProfile }, [custom]),
      "inside",
      60,
      2,
    );
    assert.equal(suggestion.hobbyId, custom.id);
    assert.equal(suggestion.resourceUrl, undefined);
    assert.ok(suggestion.duration <= 60);
    assert.deepEqual(recommendActivities(
      preferencesFor([custom.id], { [custom.id]: customProfile }, [custom]),
      "outside",
      60,
      2,
    ), []);
    customProfile.activityLocation = "Outside";
    assert.equal(recommendActivities(
      preferencesFor([custom.id], { [custom.id]: customProfile }, [custom]),
      "outside",
      60,
      2,
    )[0]?.place, "outside");
  });

  it("keeps a custom hobby eligible in either setting when optional location is unanswered", () => {
    const custom: Hobby = {
      id: "custom-calligraphy",
      name: "Calligraphy",
      icon: "🖋️",
      color: "lilac",
      kind: "custom",
      supplies: [],
    };
    const profile = createHobbyProfile();
    for (const place of ["inside", "outside"] as const) {
      const suggestions = recommendActivities(
        preferencesFor([custom.id], { [custom.id]: profile }, [custom]),
        place,
        30,
        3,
      );
      assert.equal(suggestions[0]?.hobbyId, custom.id);
      assert.equal(suggestions[0]?.place, place);
    }
  });

  it("returns fewer than three when explicit exclusions leave fewer eligible candidates", () => {
    const profile = createHobbyProfile();
    profile.excludedActivityIds = ["fallback-reading", "read-chapter"];
    const result = recommendActivities(
      preferencesFor(["reading"], { reading: profile }),
      "inside",
      15,
      3,
      { includeAll: true },
    );
    assert.equal(result.length, 0);
  });

  it("explains through its candidate count when only two activities remain eligible", () => {
    const readingProfile = createHobbyProfile();
    readingProfile.excludedActivityIds = ["read-outside", "reading-current-book"];
    const customProfile = createHobbyProfile();
    customProfile.activityLocation = "Inside";
    const custom: Hobby = {
      id: "custom-calligraphy",
      name: "Calligraphy",
      icon: "✒️",
      color: "sage",
      kind: "custom",
      supplies: [],
    };
    const results = recommendActivities(
      preferencesFor(
        ["reading", custom.id],
        { reading: readingProfile, [custom.id]: customProfile },
        [custom],
      ),
      "inside",
      30,
      3,
      { includeAll: true },
    );
    assert.equal(results.length, 2);
    assert.equal(recommendActivities(
      preferencesFor(
        ["reading", custom.id],
        { reading: readingProfile, [custom.id]: customProfile },
        [custom],
      ),
      "inside",
      30,
      3,
    ).length, 2);
  });

  it("refreshes the shortlist from other eligible candidates", () => {
    const ids = ["yoga", "pilates", "puzzles", "journaling"];
    const prefs = preferencesFor(ids);
    const first = recommendActivities(prefs, "inside", 30, 3);
    const refreshed = recommendActivities(prefs, "inside", 30, 3, { candidateOffset: 3 });
    assert.equal(first.length, 3);
    assert.equal(refreshed.length, 3);
    assert.equal(new Set(refreshed.map((activity) => activity.hobbyId)).size, 3);
    assert.ok(refreshed.some((activity) => !first.some((previous) => previous.id === activity.id)));
  });

  it("uses the chosen card duration for the timer and preserves verified video duration", () => {
    const journal: Activity = {
      id: "journal-page",
      hobbyId: "journaling",
      title: "Write",
      description: "",
      duration: 8,
      place: "inside",
      energy: 1,
      materials: [],
    };
    assert.equal(getActivityDurationSeconds(journal), 8 * 60);

    const verifiedVideo: Activity = {
      id: "verified-video",
      hobbyId: "yoga",
      title: "Saved practice",
      description: "",
      duration: 20,
      durationSeconds: 1200,
      availableTimeMinutes: 30,
      place: "inside",
      energy: 2,
      materials: [],
      durationVerified: true,
      verifiedVideo: true,
    };
    assert.equal(getActivityDurationSeconds(verifiedVideo), 1200);
    assert.equal(
      recommendActivities(preferencesFor(["yoga"]), "inside", 30, 3, {
        videoRecommendations: [verifiedVideo],
      }).find((activity) => activity.id === "verified-video")?.durationSeconds,
      1200,
    );
    assert.equal(
      recommendActivities(preferencesFor(["yoga"]), "inside", 15, 3, {
        videoRecommendations: [verifiedVideo],
      }).some((activity) => activity.id === "verified-video"),
      false,
    );
  });
});
