export type Hobby = {
  id: string;
  name: string;
  icon: string;
  color: string;
  supplies: string[];
  kind?: "reading" | "yoga" | "pilates" | "running" | "cooking" | "craft" | "journaling" | "custom" | "general";
};

export type CurrentFrequency = "Never" | "Rarely" | "About once a week" | "Several times a week" | "Daily";
export type DesiredFrequency = "Occasionally" | "Once a week" | "A few times a week" | "Daily";
export type PracticeLocation = "At home" | "In a studio" | "Both";
export type VideoPreference = "From favourites" | "Discover new instructors" | "Both" | "No";
export type ResourceLink = { name: string; url: string };
export type JournalingPromptPreference = "Yes, give me prompts." | "Sometimes, let me choose." | "No thanks, I prefer free writing.";
export type JournalingPromptCategory = "Morning reflection" | "Evening reflection" | "Gratitude" | "Personal reflection" | "Creative writing";
export type JournalingPrompt = { id: string; category: JournalingPromptCategory; text: string };
export type ActivityLocation = "Inside" | "Outside" | "Both";
export type YouTubeVideo = {
  id: string;
  title: string;
  channelTitle: string;
  channelId: string;
  thumbnailUrl: string;
  url: string;
  durationSeconds: number;
  source: "saved" | "favourite" | "discovery";
};

export type Activity = {
  id: string;
  hobbyId: string;
  title: string;
  description: string;
  duration: number;
  durationSeconds?: number;
  availableTimeMinutes?: number;
  place: "inside" | "outside" | "either";
  energy: number;
  materials: string[];
  activityType?: string;
  resourceUrl?: string;
  resourceLabel?: string;
  thumbnailUrl?: string;
  videoChannel?: string;
  videoSource?: YouTubeVideo["source"] | "fallback";
  durationVerified?: boolean;
  verifiedVideo?: boolean;
  journalPrompt?: JournalingPrompt;
};

export type HobbyProfile = {
  supplies: string[];
  enjoyment: number | null;
  frequency: string | null;
  notes: string;
  books?: BookRecord[];
  currentFrequency: CurrentFrequency | null;
  desiredFrequency: DesiredFrequency | null;
  readingFormats?: string[];
  currentBookTitle?: string;
  practiceLocation?: PracticeLocation | null;
  favoriteInstructors?: ResourceLink[];
  savedVideos?: ResourceLink[];
  videoPreference?: VideoPreference | null;
  preferredDurations?: number[];
  runningActivities?: string[];
  runningLocation?: "Outside" | "On a treadmill" | "Both" | null;
  runningDurations?: string[];
  cookingInterests?: string[];
  cookingStyle?: "Following recipes" | "Improvising" | "Both" | null;
  saveRecipeLinks?: boolean | null;
  recipeLinks?: ResourceLink[];
  projectInProgress?: boolean | null;
  projectName?: string;
  patternLink?: string;
  continueProject?: boolean | null;
  customActivity?: string;
  customMaterials?: string;
  customResources?: ResourceLink[];
  activityLocation?: ActivityLocation | null;
  excludedActivityIds?: string[];
  journalingPromptPreference?: JournalingPromptPreference | null;
  journalingSessionMode?: "prompt" | "free";
};

export type BookStatus = "Want to read" | "Currently reading" | "Read";

export type BookRecord = {
  id: string;
  title: string;
  author: string;
  status: BookStatus;
  coverUrl?: string;
};

export type Preferences = {
  profiles: Record<string, HobbyProfile>;
  preferredTimes: string[];
  completed: boolean;
  customHobbies?: Hobby[];
  selectedHobbyIds?: string[];
  schemaVersion?: 2;
};

export function createHobbyProfile(): HobbyProfile {
  return {
    supplies: [],
    enjoyment: null,
    frequency: null,
    notes: "",
    currentFrequency: null,
    desiredFrequency: null,
    readingFormats: [],
    favoriteInstructors: [],
    savedVideos: [],
    videoPreference: null,
    preferredDurations: [],
    runningActivities: [],
    runningLocation: null,
    runningDurations: [],
    cookingInterests: [],
    cookingStyle: null,
    saveRecipeLinks: null,
    recipeLinks: [],
    projectInProgress: null,
    continueProject: null,
    customResources: [],
    activityLocation: null,
    journalingPromptPreference: null,
  };
}

export function migratePreferences(value: unknown): Preferences {
  if (!value || typeof value !== "object") {
    return { profiles: {}, preferredTimes: [], completed: false, customHobbies: [], selectedHobbyIds: [], schemaVersion: 2 };
  }
  const parsed = value as Partial<Preferences>;
  const profiles = parsed.profiles && typeof parsed.profiles === "object" ? parsed.profiles : {};
  const isCurrentSchema = parsed.schemaVersion === 2;
  const migratedProfiles = Object.fromEntries(
    Object.entries(profiles).map(([id, stored]) => {
      const profile = stored as Partial<HobbyProfile>;
      return [id, {
        ...createHobbyProfile(),
        ...profile,
        supplies: Array.isArray(profile.supplies) ? profile.supplies : [],
        enjoyment: isCurrentSchema && typeof profile.enjoyment === "number" ? profile.enjoyment : null,
        frequency: isCurrentSchema ? profile.frequency ?? null : null,
        notes: typeof profile.notes === "string" ? profile.notes : "",
        currentFrequency: isCurrentSchema ? profile.currentFrequency ?? null : null,
        desiredFrequency: isCurrentSchema ? profile.desiredFrequency ?? null : null,
        activityLocation: profile.activityLocation === "Inside" || profile.activityLocation === "Outside" || profile.activityLocation === "Both"
          ? profile.activityLocation
          : null,
        excludedActivityIds: Array.isArray(profile.excludedActivityIds)
          ? profile.excludedActivityIds.filter((activityId): activityId is string => typeof activityId === "string")
          : [],
        books: profile.books ?? [],
      } satisfies HobbyProfile];
    }),
  );
  const customHobbies = Array.isArray(parsed.customHobbies) ? parsed.customHobbies : [];
  const selectedHobbyIds = Array.isArray(parsed.selectedHobbyIds)
    ? parsed.selectedHobbyIds.filter((id): id is string => typeof id === "string")
    : Object.keys(migratedProfiles);
  return {
    ...parsed,
    profiles: migratedProfiles,
    preferredTimes: Array.isArray(parsed.preferredTimes) ? parsed.preferredTimes : [],
    completed: parsed.completed === true,
    customHobbies,
    selectedHobbyIds,
    schemaVersion: 2,
  };
}

export const hobbies: Hobby[] = [
  { id: "reading", name: "Reading", icon: "📚", color: "lilac", kind: "reading", supplies: [] },
  { id: "knitting", name: "Knitting", icon: "🧶", color: "peach", kind: "craft", supplies: [] },
  { id: "crochet", name: "Crochet", icon: "🪡", color: "sage", kind: "craft", supplies: [] },
  { id: "running", name: "Running", icon: "👟", color: "sky", kind: "running", supplies: [] },
  { id: "yoga", name: "Yoga", icon: "🧘", color: "lilac", kind: "yoga", supplies: [] },
  { id: "pilates", name: "Pilates", icon: "🤸", color: "peach", kind: "pilates", supplies: [] },
  { id: "pottery", name: "Pottery", icon: "🏺", color: "peach", kind: "craft", supplies: [] },
  { id: "drawing", name: "Drawing", icon: "✏️", color: "sage", kind: "general", supplies: [] },
  { id: "cooking", name: "Cooking", icon: "🍋", color: "sky", kind: "cooking", supplies: [] },
  { id: "photography", name: "Photography", icon: "📷", color: "peach", kind: "general", supplies: [] },
  { id: "walking", name: "Walking", icon: "🌿", color: "sage", kind: "general", supplies: [] },
  { id: "journaling", name: "Journaling", icon: "📓", color: "lilac", kind: "journaling", supplies: [] },
  { id: "puzzles", name: "Puzzles", icon: "🧩", color: "sky", kind: "general", supplies: [] },
  { id: "cross-stitch", name: "Cross-stitch", icon: "🪡", color: "peach", kind: "craft", supplies: [] },
  { id: "gardening", name: "Gardening", icon: "🪴", color: "sage", kind: "general", supplies: [] },
];

export function getAllowedActivityLocations(hobby: Hobby, profile: HobbyProfile): ("inside" | "outside")[] {
  if (hobby.kind === "custom" && !profile.activityLocation) return ["inside", "outside"];
  if (hobby.kind === "running") {
    if (profile.runningLocation === "On a treadmill") return ["inside"];
    if (profile.runningLocation === "Both") return ["inside", "outside"];
    return ["outside"];
  }
  if (profile.activityLocation) {
    if (profile.activityLocation === "Both") return ["inside", "outside"];
    return [profile.activityLocation.toLowerCase() as "inside" | "outside"];
  }
  if (hobby.kind === "yoga" || hobby.kind === "pilates" || hobby.kind === "cooking") return ["inside"];
  if (hobby.id === "walking") return ["outside"];
  if (hobby.id === "puzzles") return ["inside"];
  return ["inside", "outside"];
}

export const preferredTimes = [
  "Weekday mornings",
  "Weekday evenings",
  "Weekend mornings",
  "Weekend afternoons",
  "Weekend evenings",
];

export const activities: Activity[] = [
  { id: "read-chapter", hobbyId: "reading", title: "A chapter & a cup of tea", description: "Settle in with a book or reading you already have nearby.", duration: 15, place: "inside", energy: 1, materials: [] },
  { id: "read-outside", hobbyId: "reading", title: "Read somewhere sunny", description: "Take reading you already have to a comfortable outdoor spot.", duration: 30, place: "outside", energy: 1, materials: [] },
  { id: "knit-swatch", hobbyId: "knitting", title: "Knit a tiny swatch", description: "Pick a stitch you love and make a little square just for practice.", duration: 30, place: "inside", energy: 2, materials: ["Yarn", "Knitting needles"] },
  { id: "knit-row", hobbyId: "knitting", title: "Add a few rows", description: "Pick up your current project and enjoy the familiar rhythm.", duration: 15, place: "either", energy: 1, materials: ["Yarn", "Knitting needles"] },
  { id: "crochet-square", hobbyId: "crochet", title: "Crochet a little square", description: "Practice a stitch or add a square to a larger project.", duration: 30, place: "inside", energy: 2, materials: ["Yarn", "Crochet hook"] },
  { id: "crochet-coaster", hobbyId: "crochet", title: "Make a quick coaster", description: "A small, satisfying project you can finish in one sitting.", duration: 30, place: "either", energy: 2, materials: ["Yarn", "Crochet hook"] },
  { id: "easy-run", hobbyId: "running", title: "Take the scenic loop", description: "Head out for an easy-paced loop and notice what’s blooming.", duration: 30, place: "outside", energy: 4, materials: [], activityType: "Easy runs" },
  { id: "run-strides", hobbyId: "running", title: "A few happy strides", description: "Warm up with a walk, then add a handful of relaxed strides.", duration: 15, place: "outside", energy: 4, materials: [], activityType: "Intervals" },
  { id: "pottery-pinch", hobbyId: "pottery", title: "Shape a pinch pot", description: "Let your hands lead and make a small bowl with no need for perfection.", duration: 30, place: "inside", energy: 2, materials: ["Clay"] },
  { id: "pottery-sketch", hobbyId: "pottery", title: "Sketch a ceramic idea", description: "Collect shapes and details for the next thing you’d love to make.", duration: 15, place: "either", energy: 1, materials: ["Notebook"] },
  { id: "draw-still-life", hobbyId: "drawing", title: "Sketch something at home", description: "Choose an object around you and sketch its shape using materials you already have, if any.", duration: 30, place: "inside", energy: 2, materials: [] },
  { id: "draw-doodles", hobbyId: "drawing", title: "Fill a page with doodles", description: "Draw whatever comes to mind with materials you already have, if any.", duration: 15, place: "inside", energy: 1, materials: [] },
  { id: "draw-outside", hobbyId: "drawing", title: "Sketch a detail in the park", description: "Find a shape or view outdoors and sketch it using materials you already have, if any.", duration: 20, place: "outside", energy: 1, materials: [] },
  { id: "cook-lunch", hobbyId: "cooking", title: "Make a colorful lunch", description: "Turn a few fresh ingredients into something lovely and simple.", duration: 30, place: "inside", energy: 3, materials: [], activityType: "Dinner meals" },
  { id: "cook-something-new", hobbyId: "cooking", title: "Try one new flavor", description: "Pick a spice or ingredient you rarely use and make a small snack.", duration: 15, place: "inside", energy: 2, materials: [], activityType: "Snacks" },
  { id: "photo-textures", hobbyId: "photography", title: "Take a neighbourhood colour walk", description: "Notice a few colours or details outdoors and capture them with a device you already use, if you have one.", duration: 30, place: "outside", energy: 2, materials: [] },
  { id: "photo-light", hobbyId: "photography", title: "Try a still-life photo challenge", description: "Arrange a few everyday objects or notice the light at home; use a device you already have, if any.", duration: 15, place: "inside", energy: 1, materials: [] },
  { id: "photo-outside-challenge", hobbyId: "photography", title: "Try a neighbourhood photo challenge", description: "Look for a shape, colour, and texture outdoors and capture them with a device you already use, if you have one.", duration: 15, place: "outside", energy: 1, materials: [] },
  { id: "walk-neighborhood", hobbyId: "walking", title: "Take the long way home", description: "Choose a street you don’t usually take and wander without a destination.", duration: 30, place: "outside", energy: 2, materials: ["Comfortable shoes"] },
  { id: "walk-reset", hobbyId: "walking", title: "A little fresh-air reset", description: "Step outside, leave your phone in your pocket, and walk for a bit.", duration: 15, place: "outside", energy: 1, materials: ["Comfortable shoes"] },
  { id: "journal-page", hobbyId: "journaling", title: "Write freely for a little while", description: "Set a timer, follow your thoughts, and stop whenever your time is up.", duration: 15, place: "inside", energy: 1, materials: [] },
  { id: "puzzle-session", hobbyId: "puzzles", title: "Find the edge pieces", description: "Put on a gentle playlist and settle into a few pieces at a time.", duration: 30, place: "inside", energy: 1, materials: ["A puzzle"] },
  { id: "puzzle-break", hobbyId: "puzzles", title: "A puzzle-sized pause", description: "Give yourself a short, screen-free break with your current puzzle.", duration: 15, place: "inside", energy: 1, materials: ["A puzzle"] },
  { id: "stitch-motif", hobbyId: "cross-stitch", title: "Stitch a tiny motif", description: "Choose a simple shape and enjoy a few neat, colorful stitches.", duration: 30, place: "inside", energy: 1, materials: [], activityType: "Cross-stitch" },
  { id: "stitch-colors", hobbyId: "cross-stitch", title: "Pick your next colors", description: "Play with a few thread combinations for your next little project.", duration: 15, place: "inside", energy: 1, materials: ["Embroidery floss"] },
  { id: "garden-indoor-plant", hobbyId: "gardening", title: "Repot or check on a houseplant", description: "If you have a houseplant, give it a quick check-in; otherwise plan a spot for one you'd enjoy growing.", duration: 15, place: "inside", energy: 1, materials: [] },
  { id: "garden-propagate", hobbyId: "gardening", title: "Plan a plant propagation", description: "If you have a suitable plant, consider a cutting; otherwise learn which plants can be propagated at home.", duration: 20, place: "inside", energy: 1, materials: [] },
  { id: "garden-herbs", hobbyId: "gardening", title: "Explore indoor herb care", description: "Check on herbs you already grow, or choose one herb and learn what it needs indoors.", duration: 15, place: "inside", energy: 1, materials: [] },
  { id: "garden-flowers", hobbyId: "gardening", title: "Plan a patch of flowers", description: "If you have a garden bed, tend it; otherwise sketch a simple flower plan for an outdoor space.", duration: 20, place: "outside", energy: 2, materials: [] },
  { id: "garden-bed", hobbyId: "gardening", title: "Tend a garden bed", description: "Spend a few minutes caring for an outdoor bed if you have one, or note what you'd like to grow there.", duration: 15, place: "outside", energy: 1, materials: [] },
  { id: "garden-balcony", hobbyId: "gardening", title: "Check in on balcony planters", description: "Care for any balcony planters you have, or plan a small container garden for the future.", duration: 15, place: "outside", energy: 1, materials: [] },
];

export const journalingPromptLibrary: ReadonlyArray<{
  category: JournalingPromptCategory;
  prompts: readonly { id: string; text: string }[];
}> = [
  {
    category: "Morning reflection",
    prompts: [
      { id: "morning-good-day", text: "What would make today feel like a good day?" },
      { id: "morning-looking-forward", text: "What's one thing you're looking forward to?" },
      { id: "morning-how-feel", text: "How would you like to feel by the end of today?" },
    ],
  },
  {
    category: "Evening reflection",
    prompts: [
      { id: "evening-smile", text: "What was one moment today that made you smile?" },
      { id: "evening-learned", text: "What did you learn about yourself today?" },
      { id: "evening-leave-behind", text: "What's something you'd like to leave behind before tomorrow?" },
    ],
  },
  {
    category: "Gratitude",
    prompts: [
      { id: "gratitude-small-things", text: "What are three small things you've appreciated recently?" },
      { id: "gratitude-person", text: "Who made your week better, and how?" },
    ],
  },
  {
    category: "Personal reflection",
    prompts: [
      { id: "reflection-make-time", text: "What have you been wanting to make more time for?" },
      { id: "reflection-proud", text: "What's something you're proud of that you rarely acknowledge?" },
    ],
  },
  {
    category: "Creative writing",
    prompts: [
      { id: "creative-slow-sunday", text: "Describe your ideal slow Sunday." },
      { id: "creative-future-letter", text: "Write a letter to yourself one year from now." },
    ],
  },
];

export const journalingPrompts: JournalingPrompt[] = journalingPromptLibrary.flatMap(
  ({ category, prompts }) => prompts.map((prompt) => ({ ...prompt, category })),
);

export function getJournalingPrompt(localHour: number, promptIndex = 0): JournalingPrompt {
  const timeCategory: JournalingPromptCategory = localHour >= 5 && localHour < 11
    ? "Morning reflection"
    : localHour >= 17 && localHour < 22
      ? "Evening reflection"
      : "Personal reflection";
  const categories: JournalingPromptCategory[] = [
    timeCategory,
    "Gratitude",
    "Creative writing",
    "Personal reflection",
    "Morning reflection",
    "Evening reflection",
  ];
  const category = categories[promptIndex % categories.length];
  const prompts = journalingPrompts.filter((prompt) => prompt.category === category);
  return prompts[Math.floor(promptIndex / categories.length) % prompts.length];
}

export type LocalTimeContext = "morning" | "daytime" | "evening" | "late-night";

export function getLocalTimeContext(localHour: number): LocalTimeContext {
  if (localHour >= 5 && localHour < 11) return "morning";
  if (localHour >= 11 && localHour < 17) return "daytime";
  if (localHour >= 17 && localHour < 22) return "evening";
  return "late-night";
}

export function getJournalingDurationRange(availableMinutes: number): [number, number] {
  if (availableMinutes <= 15) return [5, 10];
  if (availableMinutes <= 30) return [10, 15];
  return [15, 20];
}

export function getSuggestedJournalingDuration(availableMinutes: number): number {
  return getJournalingDurationRange(availableMinutes)[1];
}

export function getSuggestedActivityDuration(activity: Activity, availableMinutes: number): number {
  if (activity.durationSeconds !== undefined) return activity.durationSeconds / 60;
  if (activity.hobbyId === "journaling") return getSuggestedJournalingDuration(availableMinutes);
  if (activity.hobbyId === "reading") {
    return Math.min(availableMinutes, availableMinutes <= 15 ? 15 : availableMinutes <= 30 ? 25 : 45);
  }
  if (activity.hobbyId === "yoga" || activity.hobbyId === "pilates") {
    return Math.min(availableMinutes, availableMinutes <= 15 ? 12 : availableMinutes <= 30 ? 25 : 45);
  }
  return Math.min(activity.duration, availableMinutes);
}

export function getActivityDurationSeconds(activity: Activity): number {
  return Math.max(1, Math.round(activity.durationSeconds ?? activity.duration * 60));
}

export function recommendActivities(
  preferences: Preferences,
  place: "inside" | "outside",
  minutes: number,
  energy: number,
  options: {
    localHour?: number;
    promptIndex?: number;
    includeUnverifiedVideoFallback?: boolean;
    videoRecommendations?: Activity[];
    candidateOffset?: number;
    includeAll?: boolean;
    recentHobbyIds?: string[];
  } = {},
): Activity[] {
  const localHour = options.localHour ?? 12;
  const timeContext = getLocalTimeContext(localHour);
  const selectedIds = [...new Set(preferences.selectedHobbyIds ?? Object.keys(preferences.profiles))];
  if (selectedIds.length === 0) return [];

  const selectedHobbies = [...hobbies, ...(preferences.customHobbies ?? [])]
    .filter((hobby) => selectedIds.includes(hobby.id));
  const hobbyById = new Map(selectedHobbies.map((hobby) => [hobby.id, hobby]));
  const matches: Activity[] = activities.flatMap((activity) => {
    const hobby = hobbyById.get(activity.hobbyId);
    return selectedIds.includes(activity.hobbyId) &&
      (activity.place === place || activity.place === "either") &&
      hobby !== undefined &&
      getAllowedActivityLocations(hobby, preferences.profiles[activity.hobbyId] ?? createHobbyProfile()).includes(place)
      ? [activity]
      : [];
  });
  if (options.videoRecommendations) {
    matches.push(...options.videoRecommendations.flatMap((activity) => {
      const hobby = hobbyById.get(activity.hobbyId);
      return selectedIds.includes(activity.hobbyId) &&
        (activity.place === place || activity.place === "either") &&
        hobby !== undefined &&
        getAllowedActivityLocations(hobby, preferences.profiles[activity.hobbyId] ?? createHobbyProfile()).includes(place)
        ? [activity]
        : [];
    }));
  }

  for (const hobby of selectedHobbies) {
    const profile = preferences.profiles[hobby.id] ?? createHobbyProfile();

    if (hobby.kind === "running") {
      const locationMatches = getAllowedActivityLocations(hobby, profile).includes(place);
      const filtered = matches.filter((activity) => activity.hobbyId !== hobby.id || (
        locationMatches &&
        (!profile.runningActivities?.length || profile.runningActivities.includes(activity.activityType ?? "")) &&
        (!profile.runningDurations?.length || profile.runningDurations.some((duration) => duration === "60+ minutes" ? activity.duration >= 60 : duration === `${activity.duration} minutes`))
      ));
      matches.splice(0, matches.length, ...filtered);

      const requestedDurations = profile.runningDurations?.map((duration) =>
        duration === "60+ minutes" ? 60 : Number.parseInt(duration, 10),
      ).filter((duration) => duration <= minutes) ?? [];
      const runDuration = profile.runningDurations?.length
        ? requestedDurations.length ? Math.max(...requestedDurations) : 0
        : Math.min(minutes, 30);
      const runActivities = profile.runningActivities ?? [];
      const runningPlace = profile.runningLocation === "On a treadmill"
        ? "inside"
        : profile.runningLocation === "Outside"
          ? "outside"
          : profile.runningLocation === "Both"
            ? place
            : "outside";

      if (runningPlace === place && runDuration > 0 && runActivities.length === 0 && !matches.some((activity) => activity.hobbyId === hobby.id)) {
        matches.push({
          id: `running-easy-${place}-${runDuration}`,
          hobbyId: hobby.id,
          title: profile.runningLocation === "On a treadmill" ? "Take an easy treadmill run" : "Take an easy outdoor run",
          description: "Choose an easy pace that feels comfortable for the time you have.",
          duration: runDuration,
          place: runningPlace,
          energy: 3,
          materials: [],
        });
      }

      if (locationMatches && runDuration > 0) {
        runActivities.forEach((activityType) => {
          if (matches.some((activity) => activity.hobbyId === hobby.id && activity.activityType === activityType)) return;
          matches.push({
            id: `running-${activityType.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}-${runDuration}`,
            hobbyId: hobby.id,
            title: `${activityType} for ${runDuration} minutes`,
            description: `Choose a ${activityType.toLowerCase()} route or session that fits your day and preferred setting.`,
            duration: runDuration,
            place: runningPlace,
            energy: activityType === "Intervals" ? 4 : 3,
            materials: [],
            activityType,
          });
        });
      }
    }

    if (hobby.kind === "cooking" && profile.cookingInterests?.length) {
      const filtered = matches.filter((activity) => activity.hobbyId !== hobby.id || profile.cookingInterests?.includes(activity.activityType ?? ""));
      matches.splice(0, matches.length, ...filtered);

      profile.cookingInterests.forEach((interest) => {
        if (matches.some((activity) => activity.hobbyId === hobby.id && activity.activityType === interest)) return;
        const styleDescription = profile.cookingStyle === "Following recipes"
          ? "Follow a recipe you already enjoy."
          : profile.cookingStyle === "Improvising"
            ? "Use what sounds good and improvise as you go."
            : "Follow a recipe or improvise, whichever feels right today.";
        matches.push({
          id: `cooking-${interest.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`,
          hobbyId: hobby.id,
          title: `Make something for ${interest.toLowerCase()}`,
          description: `${styleDescription} Choose an idea that fits the time you have.`,
          duration: Math.min(minutes, 30),
          place,
          energy: 2,
          materials: [],
          activityType: interest,
        });
      });
    }

    if (hobby.kind === "craft" && profile.continueProject === true && profile.projectInProgress === true) {
      matches.push({
        id: `${hobby.id}-continue-project`,
        hobbyId: hobby.id,
        title: profile.projectName ? `Continue ${profile.projectName}` : `Pick up your ${hobby.name.toLowerCase()} project`,
        description: "Return to the project you said you’d like to continue, and make one small bit of progress.",
        duration: Math.min(minutes, 30),
        place,
        energy: 2,
        materials: [],
        resourceUrl: profile.patternLink,
        resourceLabel: profile.patternLink ? "Open saved pattern" : undefined,
      });
    }

    if (hobby.kind === "craft" && profile.patternLink && !(profile.projectInProgress && profile.continueProject)) {
      matches.push({
        id: `${hobby.id}-saved-pattern`,
        hobbyId: hobby.id,
        title: `Explore your saved ${hobby.name.toLowerCase()} pattern`,
        description: "Use the pattern or tutorial you saved to choose a manageable next step.",
        duration: Math.min(minutes, 30),
        place,
        energy: 2,
        materials: [],
        resourceUrl: profile.patternLink,
        resourceLabel: "Open saved pattern",
      });
    }

    if (hobby.kind === "reading" && profile.currentBookTitle?.trim()) {
      const currentBookAction = profile.readingFormats?.includes("Audiobooks") ? "Listen to" : "Read";
      matches.push({
        id: "reading-current-book",
        hobbyId: hobby.id,
        title: `${currentBookAction} a little more of ${profile.currentBookTitle.trim()}`,
        description: "Settle in with the book you’re already enjoying and stop whenever your time is up.",
        duration: Math.min(minutes, 30),
        place,
        energy: 1,
        materials: [],
      });
    }

    if (hobby.kind === "cooking" && profile.saveRecipeLinks === true) {
      profile.recipeLinks?.forEach((resource, index) => {
        matches.push({
          id: `saved-recipe-${index}-${resource.name}`,
          hobbyId: hobby.id,
          title: `Revisit ${resource.name}`,
          description: "Use your saved link for inspiration, and check its own prep time before you begin.",
          duration: minutes,
          place,
          energy: 2,
          materials: [],
          resourceUrl: resource.url,
          resourceLabel: "Open saved recipe",
        });
      });
    }

    if (hobby.kind === "yoga" || hobby.kind === "pilates") {
      const locationAllowsPractice = getAllowedActivityLocations(hobby, profile).includes(place);
      if (locationAllowsPractice && !matches.some((activity) => activity.hobbyId === hobby.id)) {
        matches.push({
          id: `${hobby.id}-unguided-flow-${place}`,
          hobbyId: hobby.id,
          title: hobby.kind === "yoga"
            ? place === "outside" ? "Take a mindful yoga flow outdoors" : "Try a short yoga flow"
            : place === "outside" ? "Try a Pilates reset outdoors" : "Try a short Pilates reset",
          description: "Move through a few familiar stretches or exercises at your own pace; no video or equipment is required.",
          duration: Math.min(minutes, hobby.kind === "yoga" || hobby.kind === "pilates" ? 15 : minutes),
          place,
          energy: 2,
          materials: [],
        });
      }
      const favoriteRecommendation = profile.videoPreference !== "No" &&
        (profile.videoPreference === "From favourites" || profile.videoPreference === "Both" ||
          Boolean(profile.favoriteInstructors?.length) || Boolean(profile.savedVideos?.length));
      const discoverRecommendation = profile.videoPreference === "Discover new instructors" || profile.videoPreference === "Both";
      const hasSavedVideoLinks = Boolean(profile.savedVideos?.length);
      const durationFiltered = matches.filter((activity) =>
        activity.hobbyId !== hobby.id ||
        !profile.preferredDurations?.length ||
        activity.durationSeconds === undefined ||
        profile.preferredDurations.some((duration) =>
          activity.durationSeconds !== undefined && activity.durationSeconds <= duration * 60,
        ),
      );
      matches.splice(0, matches.length, ...durationFiltered);
      if (place === "inside" && options.includeUnverifiedVideoFallback !== false && (favoriteRecommendation || discoverRecommendation || hasSavedVideoLinks)) {
        const contextTerms = timeContext === "morning"
          ? "morning energizing flow"
          : timeContext === "evening"
            ? "evening relaxing unwind flow"
            : timeContext === "late-night"
              ? "bedtime gentle wind down"
              : "practice";
        const requestedDuration = profile.preferredDurations?.filter((duration) => duration <= minutes).length
          ? Math.max(...profile.preferredDurations.filter((duration) => duration <= minutes))
          : minutes;
        if (favoriteRecommendation || hasSavedVideoLinks) {
          profile.savedVideos?.forEach((video, index) => {
            if (!video.url) return;
            matches.push({
              id: `fallback-saved-video-${hobby.id}-${index}`,
              hobbyId: hobby.id,
              title: video.name || "Your saved video link",
              description: "Saved link; video title and duration are unverified until YouTube API access is configured.",
              duration: Math.min(minutes, 30),
              place: "inside",
              energy: 2,
              materials: [],
              resourceUrl: video.url,
              resourceLabel: "Open saved link (length unverified)",
              durationVerified: false,
              videoSource: "fallback",
            });
          });
          profile.favoriteInstructors?.forEach((instructor, index) => {
            if (profile.videoPreference === "No") return;
            const query = encodeURIComponent(`${hobby.name} ${instructor.name} ${contextTerms} ${requestedDuration} minute`);
            matches.push({
              id: `fallback-favourite-${hobby.id}-${index}`,
              hobbyId: hobby.id,
              title: `Search ${instructor.name} for a ${hobby.name.toLowerCase()} session`,
              description: `A YouTube search for ${instructor.name} and ${contextTerms}. Search results are not verified video recommendations.`,
              duration: Math.min(minutes, 30),
              place: "inside",
              energy: 2,
              materials: [],
              resourceUrl: `https://www.youtube.com/results?search_query=${query}`,
              resourceLabel: "Search YouTube (fallback)",
              durationVerified: false,
              videoSource: "fallback",
            });
          });
        }
        if (discoverRecommendation) {
          const query = encodeURIComponent(`${hobby.name} ${contextTerms} ${requestedDuration} minute`);
          matches.push({
            id: `fallback-discovery-${hobby.id}`,
            hobbyId: hobby.id,
            title: `Search YouTube for a ${hobby.name.toLowerCase()} session`,
            description: `A YouTube search for ${contextTerms}. Search results are not verified video recommendations.`,
            duration: Math.min(minutes, 30),
            place: "inside",
            energy: 2,
            materials: [],
            resourceUrl: `https://www.youtube.com/results?search_query=${query}`,
            resourceLabel: "Search YouTube (fallback)",
            durationVerified: false,
            videoSource: "fallback",
          });
        }
      }
    }

    if (hobby.kind === "custom") {
      const customTitle = profile.customActivity?.trim();
      if (getAllowedActivityLocations(hobby, profile).includes(place)) {
        matches.push({
          id: `custom-activity-${hobby.id}`,
          hobbyId: hobby.id,
          title: customTitle || profile.projectName?.trim() || `Spend a little time with ${hobby.name}`,
          description: customTitle
            ? "Try your own saved idea at your pace."
            : profile.projectName?.trim()
              ? `Continue your ${profile.projectName.trim()} project at your pace.`
              : `Choose a small, enjoyable next step in ${hobby.name.toLowerCase()}.`,
          duration: Math.min(minutes, 30),
          place,
          energy: 2,
          materials: (profile.customMaterials ?? "").split(/[,;\n]/).map((material) => material.trim()).filter(Boolean),
        });
      }
      profile.customResources?.forEach((resource, index) => {
        if (!resource.url || !getAllowedActivityLocations(hobby, profile).includes(place)) return;
        matches.push({
          id: `custom-resource-${hobby.id}-${index}`,
          hobbyId: hobby.id,
          title: `Explore ${resource.name}`,
          description: `Use your saved resource to choose a next step in ${hobby.name.toLowerCase()}.`,
          duration: Math.min(minutes, 30),
          place,
          energy: 2,
          materials: [],
          resourceUrl: resource.url,
          resourceLabel: "Open saved resource",
        });
      });
    }
  }

  for (const hobby of selectedHobbies) {
    const profile = preferences.profiles[hobby.id] ?? createHobbyProfile();
    if (matches.some((activity) =>
      activity.hobbyId === hobby.id &&
      (activity.place === place || activity.place === "either") &&
      getAllowedActivityLocations(hobby, profile).includes(place),
    )) continue;
    if (!getAllowedActivityLocations(hobby, profile).includes(place)) continue;
    const compatibleRunDurations = profile.runningDurations?.map((duration) =>
      duration === "60+ minutes" ? 60 : Number.parseInt(duration, 10),
    ).filter((duration) => Number.isFinite(duration) && duration <= minutes) ?? [];
    if (hobby.kind === "running" && profile.runningDurations?.length && compatibleRunDurations.length === 0) continue;

    const activityId = hobby.kind === "custom" ? `custom-activity-${hobby.id}` : `fallback-${hobby.id}`;
    if (profile.excludedActivityIds?.includes(activityId)) continue;
    matches.push({
      id: activityId,
      hobbyId: hobby.id,
      title: hobby.kind === "custom"
        ? profile.customActivity?.trim() || `Spend a little time with ${hobby.name}`
        : hobby.kind === "journaling"
          ? "Write freely for a little while"
          : hobby.kind === "yoga"
            ? place === "outside" ? "Take a mindful yoga flow outdoors" : "Try a short yoga flow"
            : hobby.kind === "pilates"
              ? place === "outside" ? "Try a Pilates reset outdoors" : "Try a short Pilates reset"
              : hobby.kind === "running"
                ? place === "inside" ? "Take an easy treadmill run" : "Take an easy outdoor run"
          : `Spend a little time with ${hobby.name.toLowerCase()}`,
      description: hobby.kind === "custom"
        ? "Choose a small, enjoyable next step using what you already have."
        : hobby.kind === "journaling"
          ? "Set a gentle timer, follow your thoughts, and stop whenever your time is up."
          : hobby.kind === "yoga" || hobby.kind === "pilates"
            ? "Move through a few familiar stretches or exercises at your own pace; no video or equipment is required."
          : `Choose a small next step in ${hobby.name.toLowerCase()} that works in this setting.`,
      duration: hobby.kind === "journaling"
        ? getSuggestedJournalingDuration(minutes)
        : hobby.kind === "running" && compatibleRunDurations.length
          ? Math.max(...compatibleRunDurations)
        : Math.min(minutes, 30),
      place,
      energy: hobby.kind === "running" ? 3 : 2,
      materials: hobby.kind === "custom"
        ? (profile.customMaterials ?? "").split(/[,;\n]/).map((material) => material.trim()).filter(Boolean)
        : [],
    });
  }

  const timedMatches = [...new Map(matches.map((activity) => [activity.id, activity])).values()]
    .filter((activity) => {
      const hobby = hobbyById.get(activity.hobbyId);
      return selectedIds.includes(activity.hobbyId) &&
        (activity.place === place || activity.place === "either") &&
        hobby !== undefined &&
        getAllowedActivityLocations(hobby, preferences.profiles[activity.hobbyId] ?? createHobbyProfile()).includes(place) &&
        (activity.durationSeconds === undefined || activity.durationSeconds <= minutes * 60) &&
        !preferences.profiles[activity.hobbyId]?.excludedActivityIds?.includes(activity.id);
    })
    .map((activity) => {
    if (activity.durationSeconds !== undefined) {
      return { ...activity, availableTimeMinutes: minutes };
    }
    const duration = getSuggestedActivityDuration(activity, minutes);
    const durationTitle = activity.title.replace(/\bfor \d+ minutes\b/i, `for ${duration} minutes`);
    const profile = preferences.profiles[activity.hobbyId] ?? createHobbyProfile();
    const usesPrompt = activity.hobbyId === "journaling" &&
      (profile?.journalingPromptPreference === "Yes, give me prompts." ||
        profile?.journalingPromptPreference === "Sometimes, let me choose.") &&
      profile.journalingSessionMode !== "free";
    const prompt = usesPrompt ? getJournalingPrompt(localHour, options.promptIndex ?? 0) : undefined;
    return {
      ...activity,
      title: activity.hobbyId === "journaling"
        ? prompt ? "Write with a little inspiration" : "Write freely for a little while"
        : durationTitle,
      duration,
      availableTimeMinutes: minutes,
      description: prompt
        ? "Use this prompt as a starting point, or follow it wherever your thoughts lead."
        : activity.hobbyId === "journaling"
          ? "Set a timer, follow your thoughts, and stop whenever your time is up."
          : activity.description,
      journalPrompt: activity.hobbyId === "journaling" ? prompt : activity.journalPrompt,
    };
  });

  const ranked = timedMatches
    .map((activity) => {
      const profile = preferences.profiles[activity.hobbyId] ?? createHobbyProfile();
      const currentLevel: Record<CurrentFrequency, number> = {
        Never: 0,
        Rarely: 0.5,
        "About once a week": 1,
        "Several times a week": 3,
        Daily: 7,
      };
      const desiredLevel: Record<DesiredFrequency, number> = {
        Occasionally: 0.5,
        "Once a week": 1,
        "A few times a week": 3,
        Daily: 7,
      };
      const frequencyGap = profile.currentFrequency && profile.desiredFrequency
        ? Math.max(0, desiredLevel[profile.desiredFrequency] - currentLevel[profile.currentFrequency])
        : 0;
      const preferredVideoDuration = profile.preferredDurations?.filter((duration) => duration <= minutes).length
        ? Math.max(...profile.preferredDurations.filter((duration) => duration <= minutes))
        : minutes;
      const videoTimeMatch = activity.durationSeconds === undefined ? 0 : contextTitleScore(activity.title, timeContext);
      const videoDurationFit = activity.durationSeconds === undefined
        ? 0
        : Math.max(0, 15 - Math.abs(preferredVideoDuration * 60 - activity.durationSeconds) / 60 * 0.35);
      const videoPriority = activity.videoSource === "saved"
        ? videoTimeMatch > 0 ? 65 : 12
        : activity.videoSource === "favourite"
          ? 45
          : activity.videoSource === "discovery"
            ? 10
            : activity.videoSource === "fallback"
              ? activity.id.startsWith("fallback-saved-video-")
                ? 55
                : activity.id.startsWith("fallback-favourite-")
                  ? 30
                  : -5
              : 0;
      return {
        activity,
        score:
          (profile.enjoyment === null ? 0 : (profile.enjoyment - 3) * 1.5) -
          Math.abs(activity.energy - energy) * 1.5 -
          0 +
          frequencyGap * 0.4 +
          videoPriority +
          videoTimeMatch * 4 +
          videoDurationFit +
          (activity.journalPrompt ? 2 : 0) +
          (options.recentHobbyIds?.includes(activity.hobbyId) ? -8 : 0) +
          contextTitleScore(activity.title, timeContext),
      };
    })
    .sort((first, second) => second.score - first.score || first.activity.id.localeCompare(second.activity.id));

  const groupedCandidates = new Map<string, Activity[]>();
  for (const { activity } of ranked) {
    const group = groupedCandidates.get(activity.hobbyId) ?? [];
    group.push(activity);
    groupedCandidates.set(activity.hobbyId, group);
  }
  const hobbyOrder = [...groupedCandidates.keys()];
  const diversified = [
    ...hobbyOrder.flatMap((hobbyId) => {
      const firstActivity = groupedCandidates.get(hobbyId)?.[0];
      return firstActivity ? [firstActivity] : [];
    }),
    ...ranked.map(({ activity }) => activity).filter((activity) =>
      groupedCandidates.get(activity.hobbyId)?.[0].id !== activity.id,
    ),
  ];
  if (options.includeAll) return diversified;
  if (diversified.length === 0) return [];
  const offset = Math.max(0, Math.trunc(options.candidateOffset ?? 0));
  const hobbyOffset = offset % hobbyOrder.length;
  const variationRound = Math.floor(offset / hobbyOrder.length);
  const rotatedHobbies = [...hobbyOrder.slice(hobbyOffset), ...hobbyOrder.slice(0, hobbyOffset)];
  const recommendations = rotatedHobbies.map((hobbyId) => {
    const group = groupedCandidates.get(hobbyId) ?? [];
    return group[variationRound % group.length];
  }).slice(0, 3);
  if (recommendations.length < 3) {
    for (const activity of diversified) {
      if (!recommendations.some((recommendation) => recommendation.id === activity.id)) {
        recommendations.push(activity);
      }
      if (recommendations.length === 3) break;
    }
  }
  return recommendations;
}

function contextTitleScore(title: string, context: LocalTimeContext) {
  const normalized = title.toLowerCase();
  if (context === "morning" && /morning|wake|energ/.test(normalized)) return 3;
  if (context === "evening" && /evening|unwind|relax|wind down/.test(normalized)) return 3;
  if (context === "late-night" && /bedtime|sleep|gentle|night/.test(normalized)) return 3;
  return 0;
}