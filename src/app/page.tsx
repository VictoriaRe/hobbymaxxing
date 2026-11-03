"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  hobbies,
  preferredTimes,
  recommendActivities,
  createHobbyProfile,
  getLocalTimeContext,
  getActivityDurationSeconds,
  getJournalingDurationRange,
  migratePreferences,
  type Activity,
  type HobbyProfile,
  type Hobby,
  type Preferences,
  type YouTubeVideo,
} from "./hobby-data";
import Bookshelf from "./bookshelf";
import HobbyQuestions from "./hobby-questions";
import ActivityExperience, { type ActivitySession, type DiaryEntry } from "./activity-experience";
import WeeklyCollage from "./weekly-collage";
import NotificationSettings from "./notifications-settings";

type Screen = "welcome" | "hobbies" | "details" | "bookshelf" | "times" | "activity-flow" | "dashboard" | "activity" | "diary" | "collage" | "notifications";
type YouTubeResponse = { configured: boolean; videos: YouTubeVideo[]; error?: string };

const STORAGE_KEY = "hobbymaxxing-preferences";
const SESSION_KEY = "hobbymaxxing-active-session";
const DIARY_KEY = "hobbymaxxing-diary";
const initialPreferences: Preferences = {
  profiles: {},
  preferredTimes: [],
  completed: false,
  customHobbies: [],
  selectedHobbyIds: [],
  schemaVersion: 2,
};

export default function Home() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [preferences, setPreferences] = useState<Preferences>(initialPreferences);
  const [place, setPlace] = useState<"inside" | "outside">("inside");
  const [minutes, setMinutes] = useState(30);
  const [energy, setEnergy] = useState(3);
  const [activityFlowStep, setActivityFlowStep] = useState(0);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [bookshelfOpen, setBookshelfOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customEmoji, setCustomEmoji] = useState("✨");
  const [customHobbyMessage, setCustomHobbyMessage] = useState("");
  const [showCustomHobbyForm, setShowCustomHobbyForm] = useState(false);
  const [localHour, setLocalHour] = useState(12);
  const [journalPromptIndex, setJournalPromptIndex] = useState(0);
  const [recommendationOffset, setRecommendationOffset] = useState(0);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [activityDurationOverrides, setActivityDurationOverrides] = useState<Record<string, number>>({});
  const [youtubeRecommendations, setYoutubeRecommendations] = useState<Record<string, { requestKey: string; configured: boolean; videos: YouTubeVideo[]; error?: string }>>({});
  const [currentSession, setCurrentSession] = useState<ActivitySession | null>(null);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const diaryEntriesRef = useRef<DiaryEntry[]>([]);
  const recommendationRailRef = useRef<HTMLDivElement>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [timerNow, setTimerNow] = useState(0);

  useEffect(() => {
    const restorePreferences = window.setTimeout(() => {
      let completedOnboarding = false;
      const deepLink = new URLSearchParams(window.location.search).get("view");
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = migratePreferences(JSON.parse(saved));
          if (parsed.profiles && parsed.preferredTimes) {
            setPreferences(parsed);
            completedOnboarding = parsed.completed;
            if (parsed.completed) setScreen("dashboard");
            else if ((parsed.selectedHobbyIds ?? []).length > 0) setScreen("hobbies");
          }
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      try {
        const savedSession = window.localStorage.getItem(SESSION_KEY);
        const savedDiary = window.localStorage.getItem(DIARY_KEY);
        if (savedSession) {
          const parsed = JSON.parse(savedSession) as ActivitySession;
          if (parsed.id && parsed.activity && parsed.hobby && parsed.plannedSeconds > 0) {
            setCurrentSession(parsed);
            setScreen("activity");
          }
        }
        if (savedDiary) {
          const parsed = JSON.parse(savedDiary) as DiaryEntry[];
          if (Array.isArray(parsed)) {
            const uniqueEntries = parsed.filter((entry, index) =>
              entry && typeof entry.id === "string" && parsed.findIndex((item) => item?.id === entry.id) === index,
            );
            diaryEntriesRef.current = uniqueEntries;
            setDiaryEntries(uniqueEntries);
          }
        }
      } catch {
        window.localStorage.removeItem(SESSION_KEY);
        window.localStorage.removeItem(DIARY_KEY);
      }
      if (deepLink === "diary") setScreen("diary");
      else if (deepLink === "ideas" && completedOnboarding) setScreen("dashboard");
      if (deepLink) {
        const url = new URL(window.location.href);
        url.searchParams.delete("view");
        window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      }
      setTimerNow(Date.now());
      setSessionLoaded(true);
      setHasLoaded(true);
    }, 0);
    return () => window.clearTimeout(restorePreferences);
  }, []);

  useEffect(() => {
    if (!sessionLoaded) return;
    if (currentSession) window.localStorage.setItem(SESSION_KEY, JSON.stringify(currentSession));
    else window.localStorage.removeItem(SESSION_KEY);
  }, [currentSession, sessionLoaded]);

  useEffect(() => {
    if (!sessionLoaded) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setTimerNow(now);
      setCurrentSession((session) => {
        if (!session) return session;
        if (session.phase === "preparing" && session.preparationEndsAt && now >= session.preparationEndsAt) {
          return {
            ...session,
            phase: "running",
            runStartedAt: session.preparationEndsAt,
            activityStartedAt: session.preparationEndsAt,
            elapsedBeforeRunSeconds: 0,
          };
        }
        if (session.phase === "running" && session.runStartedAt) {
          const elapsed = session.elapsedBeforeRunSeconds + Math.max(0, now - session.runStartedAt) / 1000;
          if (elapsed >= session.plannedSeconds) {
            return {
              ...session,
              phase: "review",
              actualElapsedSeconds: session.plannedSeconds,
              finishReason: "timer",
              runStartedAt: undefined,
            };
          }
        }
        return session;
      });
    }, 250);
    return () => window.clearInterval(timer);
  }, [sessionLoaded]);

  useEffect(() => {
    const updateLocalHour = () => setLocalHour(new Date().getHours());
    const initialUpdate = window.setTimeout(updateLocalHour, 0);
    const updateInterval = window.setInterval(updateLocalHour, 60_000);
    return () => {
      window.clearTimeout(initialUpdate);
      window.clearInterval(updateInterval);
    };
  }, []);

  useEffect(() => {
    if (hasLoaded) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    }
  }, [hasLoaded, preferences]);

  useEffect(() => {
    if (!hasLoaded) return;
    const updateLastActive = async () => {
      let token: string | null;
      try {
        token = window.localStorage.getItem("hobbymaxxing-push-device-token");
      } catch (error) {
        console.error("Could not read the notification device token.", error);
        return;
      }
      if (!token || !("Notification" in window) || Notification.permission !== "granted") return;
      try {
        const response = await fetch("/api/notifications/heartbeat", {
          method: "POST",
          headers: { authorization: `Bearer ${token}` },
        });
        if (!response.ok) console.error("Could not update notification activity:", response.status);
      } catch (error) {
        console.error("Could not update notification activity.", error);
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void updateLastActive();
    };
    void updateLastActive();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [hasLoaded]);

  const allHobbies = [...hobbies, ...(preferences.customHobbies ?? [])];
  const selectedHobbyIds = preferences.selectedHobbyIds ?? Object.keys(preferences.profiles);
  const selectedHobbies = allHobbies.filter((hobby) => selectedHobbyIds.includes(hobby.id));
  const activeHobby = selectedHobbies[questionIndex];
  const videoRequests = selectedHobbies.flatMap((hobby) => {
    if (hobby.kind !== "yoga" && hobby.kind !== "pilates") return [];
    const profile = preferences.profiles[hobby.id] ?? createHobbyProfile();
    if (profile.videoPreference === "No") return [];
    if (!profile.videoPreference && !(profile.savedVideos?.length || profile.favoriteInstructors?.length)) return [];
    const preferredDurations = profile.preferredDurations ?? [];
    const compatibleDurations = preferredDurations.filter((duration) => duration <= minutes);
    return [{
      hobbyId: hobby.id as "yoga" | "pilates",
      minutes: compatibleDurations.length ? Math.max(...compatibleDurations) : minutes,
      timeContext: getLocalTimeContext(localHour),
      videoPreference: profile.videoPreference,
      favoriteInstructors: profile.favoriteInstructors ?? [],
      savedVideos: profile.savedVideos ?? [],
    }];
  });
  const videoRequestKey = JSON.stringify(videoRequests);

  useEffect(() => {
    if (!hasLoaded || screen !== "dashboard") return;
    const requests = JSON.parse(videoRequestKey) as typeof videoRequests;
    if (requests.length === 0) return;
    const controller = new AbortController();
    requests.forEach((request) => {
      const requestKey = JSON.stringify(request);
      fetch("/api/youtube/recommendations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("YouTube recommendations are unavailable.");
          return await response.json() as YouTubeResponse;
        })
        .then((result) => setYoutubeRecommendations((current) => ({
          ...current,
          [request.hobbyId]: { requestKey, configured: result.configured, videos: result.videos ?? [], error: result.error },
        })))
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setYoutubeRecommendations((current) => ({
            ...current,
            [request.hobbyId]: { requestKey, configured: false, videos: [], error: "Video discovery is unavailable right now." },
          }));
        });
    });
    return () => controller.abort();
  }, [hasLoaded, screen, videoRequestKey]);

  const videoActivities: Activity[] = videoRequests.flatMap((request) => {
    const result = youtubeRecommendations[request.hobbyId];
    if (!result || result.requestKey !== JSON.stringify(request)) return [];
    return result.videos.map((video) => ({
      id: `youtube-${video.id}`,
      hobbyId: request.hobbyId,
      title: video.title,
      description: `${video.channelTitle} · ${video.source === "saved" ? "Your saved video" : video.source === "favourite" ? "Verified favourite instructor" : "YouTube discovery"}`,
      duration: video.durationSeconds / 60,
      durationSeconds: video.durationSeconds,
      place: "inside",
      energy: getLocalTimeContext(localHour) === "morning" ? 3 : 1,
      materials: [],
      resourceUrl: video.url,
      resourceLabel: "Watch this video",
      thumbnailUrl: video.thumbnailUrl,
      videoChannel: video.channelTitle,
      durationVerified: true,
      videoSource: video.source,
      verifiedVideo: true,
    }));
  });
  const allowFallbackVideoLinks = videoRequests.some((request) => {
    const result = youtubeRecommendations[request.hobbyId];
    return result?.requestKey === JSON.stringify(request) && !result.configured;
  });
  const videoDiscoveryLoading = videoRequests.some((request) =>
    youtubeRecommendations[request.hobbyId]?.requestKey !== JSON.stringify(request),
  );

  const recentHobbyIds = [...new Set(diaryEntries.slice(0, 8).map((entry) =>
    entry.hobbyId ?? allHobbies.find((hobby) => hobby.name === entry.hobbyName)?.id,
  ).filter((id): id is string => Boolean(id)))];
  const recommendationOptions = {
    localHour,
    promptIndex: journalPromptIndex,
    includeUnverifiedVideoFallback: allowFallbackVideoLinks,
    videoRecommendations: videoActivities,
    recentHobbyIds,
  };
  const allSuitableActivities = recommendActivities(preferences, place, minutes, energy, {
    ...recommendationOptions,
    includeAll: true,
  });
  const recommendations = recommendActivities(preferences, place, minutes, energy, {
    ...recommendationOptions,
    candidateOffset: recommendationOffset,
  });
  const recommendationActivities = (showAllActivities ? allSuitableActivities : recommendations).map((activity) =>
    activity.durationSeconds !== undefined
      ? activity
      : {
          ...activity,
          duration: Math.min(minutes, Math.max(1, activityDurationOverrides[activity.id] ?? activity.duration)),
          title: activity.title.replace(
            /\bfor \d+ minutes\b/i,
            `for ${Math.min(minutes, Math.max(1, activityDurationOverrides[activity.id] ?? activity.duration))} minutes`,
          ),
        },
  );
  const steps: Screen[] = ["hobbies", "details", "times"];
  const stepIndex = steps.indexOf(screen);

  function toggleHobby(id: string) {
    setPreferences((current) => {
      const currentSelection = current.selectedHobbyIds ?? Object.keys(current.profiles);
      const selectedHobbyIds = currentSelection.includes(id)
        ? currentSelection.filter((hobbyId) => hobbyId !== id)
        : [...currentSelection, id];
      return {
        ...current,
        selectedHobbyIds,
        profiles: current.profiles[id] ? current.profiles : { ...current.profiles, [id]: createHobbyProfile() },
      };
    });
  }

  function updateProfile(id: string, updates: Partial<HobbyProfile>) {
    setPreferences((current) => ({
      ...current,
      profiles: {
        ...current.profiles,
        [id]: { ...createHobbyProfile(), ...current.profiles[id], ...updates },
      },
    }));
  }

  function adjustActivityDuration(activity: Activity, change: number) {
    const currentDuration = activityDurationOverrides[activity.id] ?? activity.duration;
    setActivityDurationOverrides((current) => ({
      ...current,
      [activity.id]: Math.min(minutes, Math.max(1, currentDuration + change)),
    }));
  }

  function addCustomHobby(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = customName.trim();
    if (!name) return;
    const existing = allHobbies.find((hobby) => hobby.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      setCustomHobbyMessage(`“${existing.name}” is already in your hobbies.`);
      return;
    }
    const hobby: Hobby = {
      id: `custom-${globalThis.crypto.randomUUID()}`,
      name,
      icon: customEmoji.trim() || "✨",
      color: ["lilac", "sage", "peach", "sky"][allHobbies.length % 4],
      kind: "custom",
      supplies: [],
    };
    setPreferences((current) => ({
      ...current,
      customHobbies: [...(current.customHobbies ?? []), hobby],
      selectedHobbyIds: [...(current.selectedHobbyIds ?? Object.keys(current.profiles)), hobby.id],
      profiles: { ...current.profiles, [hobby.id]: createHobbyProfile() },
    }));
    setCustomName("");
    setCustomEmoji("✨");
    setCustomHobbyMessage("");
    setShowCustomHobbyForm(false);
  }

  function advanceQuestion() {
    if (questionIndex < selectedHobbies.length - 1) setQuestionIndex((index) => index + 1);
    else setScreen("times");
  }

  function openQuestionnaire() {
    setQuestionIndex(0);
    setScreen("details");
  }

  function toggleTime(time: string) {
    setPreferences((current) => ({
      ...current,
      preferredTimes: current.preferredTimes.includes(time)
        ? current.preferredTimes.filter((item) => item !== time)
        : [...current.preferredTimes, time],
    }));
  }

  function finishOnboarding() {
    setPreferences((current) => ({ ...current, completed: true }));
    setActivityFlowStep(0);
    setScreen("activity-flow");
  }

  function openActivityFlow() {
    setActivityFlowStep(0);
    setScreen("activity-flow");
  }

  function showRecommendationCard(index: number) {
    const cards = recommendationRailRef.current?.querySelectorAll<HTMLElement>(".activity-card");
    const card = cards?.[index];
    if (!card || !recommendationRailRef.current) return;
    const rail = recommendationRailRef.current;
    const railLeft = rail.getBoundingClientRect().left;
    recommendationRailRef.current.scrollTo({
      left: rail.scrollLeft + card.getBoundingClientRect().left - railLeft,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
    setActiveCardIndex(index);
  }

  function updateActiveCard() {
    const rail = recommendationRailRef.current;
    if (!rail) return;
    const railLeft = rail.getBoundingClientRect().left;
    const cards = [...rail.querySelectorAll<HTMLElement>(".activity-card")];
    const nearestIndex = cards.reduce((nearest, card, index) => {
      const nearestLeft = cards[nearest]?.getBoundingClientRect().left ?? railLeft;
      return Math.abs(card.getBoundingClientRect().left - railLeft) < Math.abs(nearestLeft - railLeft)
        ? index
        : nearest;
    }, 0);
    setActiveCardIndex(nearestIndex);
  }

  function startOver() {
    window.localStorage.removeItem(STORAGE_KEY);
    setPreferences(initialPreferences);
    setQuestionIndex(0);
    setScreen("welcome");
  }

  function startActivity(activity: Activity, hobby: Hobby) {
    if (currentSession) {
      setScreen("activity");
      return;
    }
    const profile = preferences.profiles[hobby.id];
    const savedBook = profile?.books?.find((book) => book.status === "Currently reading") ?? profile?.books?.[0];
    const savedResource = activity.resourceUrl
      ? undefined
      : hobby.kind === "reading"
        ? savedBook
          ? { label: savedBook.status === "Currently reading" ? "Currently reading" : "From your bookshelf", title: savedBook.title }
          : profile?.currentBookTitle?.trim()
            ? { label: "Your current book", title: profile.currentBookTitle.trim() }
            : undefined
        : undefined;
    const plannedSeconds = getActivityDurationSeconds(activity);
    setCurrentSession({
      id: globalThis.crypto.randomUUID(),
      activity,
      hobby: { id: hobby.id, name: hobby.name, icon: hobby.icon, color: hobby.color },
      plannedSeconds,
      phase: "details",
      elapsedBeforeRunSeconds: 0,
      savedResource,
    });
    setScreen("activity");
  }

  function startPreparation() {
    const now = Date.now();
    setCurrentSession((session) => session ? {
      ...session,
      phase: "preparing",
      preparationEndsAt: now + 5 * 60 * 1000,
    } : session);
    setTimerNow(now);
  }

  function startActivityNow() {
    const now = Date.now();
    setCurrentSession((session) => session ? {
      ...session,
      phase: "running",
      preparationEndsAt: undefined,
      activityStartedAt: now,
      runStartedAt: now,
      elapsedBeforeRunSeconds: 0,
    } : session);
    setTimerNow(now);
  }

  function pauseActivity() {
    const now = Date.now();
    setCurrentSession((session) => {
      if (!session || session.phase !== "running" || !session.runStartedAt) return session;
      const elapsedBeforeRunSeconds = session.elapsedBeforeRunSeconds + Math.max(0, now - session.runStartedAt) / 1000;
      return { ...session, phase: "paused", runStartedAt: undefined, elapsedBeforeRunSeconds };
    });
    setTimerNow(now);
  }

  function resumeActivity() {
    const now = Date.now();
    setCurrentSession((session) => session?.phase === "paused"
      ? { ...session, phase: "running", runStartedAt: now }
      : session);
    setTimerNow(now);
  }

  function endActivityEarly() {
    const now = Date.now();
    setCurrentSession((session) => {
      if (!session || !session.activityStartedAt) return session;
      const elapsed = session.phase === "running" && session.runStartedAt
        ? session.elapsedBeforeRunSeconds + Math.max(0, now - session.runStartedAt) / 1000
        : session.elapsedBeforeRunSeconds;
      return {
        ...session,
        phase: "review",
        runStartedAt: undefined,
        actualElapsedSeconds: Math.min(session.plannedSeconds, Math.floor(elapsed)),
        finishReason: "early",
      };
    });
    setTimerNow(now);
  }

  function cancelActivity() {
    setCurrentSession(null);
    setScreen("dashboard");
  }

  function saveDiaryEntry(status: DiaryEntry["status"], photoDataUrl?: string) {
    if (!currentSession) return false;
    const existing = diaryEntriesRef.current;
    if (existing.some((entry) => entry.id === currentSession.id)) {
      setCurrentSession(null);
      setScreen("diary");
      return true;
    }
    const entry: DiaryEntry = {
      id: currentSession.id,
      hobbyId: currentSession.hobby.id,
      activityTitle: currentSession.activity.title,
      hobbyName: currentSession.hobby.name,
      hobbyIcon: currentSession.hobby.icon,
      plannedSeconds: currentSession.plannedSeconds,
      actualElapsedSeconds: currentSession.actualElapsedSeconds ?? 0,
      startedAt: currentSession.activityStartedAt ?? Date.now(),
      finishedAt: Date.now(),
      status,
      resourceLabel: currentSession.savedResource?.label,
      resourceTitle: currentSession.savedResource?.title,
      availableTimeMinutes: currentSession.activity.availableTimeMinutes,
      journalPrompt: currentSession.activity.journalPrompt,
      photoDataUrl: status === "completed" ? photoDataUrl : undefined,
    };
    const nextEntries = [entry, ...existing];
    try {
      window.localStorage.setItem(DIARY_KEY, JSON.stringify(nextEntries));
    } catch {
      return false;
    }
    diaryEntriesRef.current = nextEntries;
    setDiaryEntries(nextEntries);
    setCurrentSession(null);
    setScreen("diary");
    return true;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#home" onClick={(event) => { event.preventDefault(); setScreen("dashboard"); }} aria-label="Hobbymaxxing home">
          <span className="brand-mark" aria-hidden="true">h</span>
          <span>hobbymaxxing</span>
        </a>
        {currentSession && screen !== "activity" && (
          <button className="text-button return-session-button" type="button" onClick={() => setScreen("activity")}>Return to activity</button>
        )}
        {screen === "activity-flow" && !currentSession && (
          <button className="text-button" type="button" onClick={openActivityFlow}>Restart flow</button>
        )}
        {screen !== "welcome" && screen !== "activity" && screen !== "diary" && screen !== "notifications" && screen !== "activity-flow" && !currentSession && (
          <button className="text-button" type="button" onClick={startOver}>Start over</button>
        )}
      </header>

      {screen === "welcome" && (
        <section className="welcome-screen" aria-labelledby="welcome-title">
          <div className="welcome-copy">
            <p className="eyebrow"><span className="eyebrow-dot" /> A little more life, offline</p>
            <h1 id="welcome-title">Make room for<br /><em>your kind</em> of fun.</h1>
            <p className="welcome-description">Less scrolling, more doing the things that make you feel like you.</p>
            <button className="primary-button welcome-cta" type="button" onClick={() => setScreen("hobbies")}>
              Get started <span aria-hidden="true">↗</span>
            </button>
            <p className="quiet-note">Just you, a little time, and something you love.</p>
          </div>
          <div className="welcome-art" aria-label="A collection of cozy hobby moments">
            <div className="sun-stamp"><span>MAKE<br />SOME<br />ROOM</span><span className="stamp-star" aria-hidden="true">✳</span></div>
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
            <span className="art-spark spark-one" aria-hidden="true">✦</span>
            <span className="art-spark spark-two" aria-hidden="true">✳</span>
            <span className="art-label label-one">a slower kind of Sunday</span>
            <span className="art-label label-two">made by hand</span>
            <span className="hobby-object object-book" aria-hidden="true">📖</span>
            <span className="hobby-object object-yarn" aria-hidden="true">🧶</span>
            <span className="hobby-object object-flower" aria-hidden="true">🌼</span>
            <span className="hobby-object object-tea" aria-hidden="true">🍵</span>
            <span className="art-caption">little joys count, too</span>
          </div>
        </section>
      )}

      {(screen === "hobbies" || screen === "details" || screen === "times") && (
        <section className="onboarding" aria-labelledby={screen === "details" ? bookshelfOpen ? "bookshelf-title" : "hobby-question-title" : "onboarding-title"}>
          {screen !== "details" && <div className="step-heading">
            <p className="eyebrow">A few little things about you</p>
            <div className="step-progress" aria-label={`Step ${stepIndex + 1} of ${steps.length}`}>
              {steps.map((step, index) => <span className={index <= stepIndex ? "progress-dot active" : "progress-dot"} key={step} />)}
              <span className="progress-label">0{stepIndex + 1} / 0{steps.length}</span>
            </div>
          </div>}

          {screen === "hobbies" && (
            <>
              <div className="section-intro">
                <h1 id="onboarding-title">What do you <em>love</em> doing?</h1>
                <p>Pick the hobbies you already enjoy, or the ones you’re curious about.</p>
              </div>
              <div className="hobby-grid" role="group" aria-label="Choose your hobbies">
                {allHobbies.map((hobby) => {
                  const selected = selectedHobbyIds.includes(hobby.id);
                  return (
                    <button className={`hobby-option ${hobby.color} ${selected ? "selected" : ""}`} type="button" aria-pressed={selected} key={hobby.id} onClick={() => toggleHobby(hobby.id)}>
                      <span className="hobby-icon" aria-hidden="true">{hobby.icon}</span>
                      <span>{hobby.name}</span>
                      <span className="selection-mark" aria-hidden="true">{selected ? "✓" : "+"}</span>
                    </button>
                  );
                })}
              </div>
              <button className="add-custom-hobby-toggle" type="button" aria-expanded={showCustomHobbyForm} onClick={() => { setShowCustomHobbyForm((current) => !current); setCustomHobbyMessage(""); }}>+ Add your own hobby</button>
              {showCustomHobbyForm && <form className="custom-hobby-form" onSubmit={addCustomHobby}>
                <label>Hobby name<input required value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="e.g. Model building" /></label>
                <label className="custom-emoji-field">Emoji<input aria-label="Choose an emoji for your hobby" value={customEmoji} onChange={(event) => setCustomEmoji(event.target.value)} maxLength={8} /></label>
                <button className="primary-button" type="submit">Add hobby <span aria-hidden="true">+</span></button>
                {customHobbyMessage && <p className="custom-hobby-message" role="status">{customHobbyMessage}</p>}
              </form>}
              <div className="flow-actions">
                <button className="quiet-button" type="button" onClick={() => setScreen("welcome")}>Back</button>
                <button className="primary-button" type="button" disabled={selectedHobbies.length === 0} onClick={openQuestionnaire}>Continue <span aria-hidden="true">→</span></button>
              </div>
            </>
          )}

          {screen === "details" && (
            bookshelfOpen && activeHobby?.kind === "reading" ? (
              <Bookshelf
                books={preferences.profiles.reading?.books ?? []}
                onChange={(books) => updateProfile("reading", { books })}
                onDone={() => setBookshelfOpen(false)}
              />
            ) : activeHobby ? (
              <HobbyQuestions
                key={activeHobby.id}
                hobby={activeHobby}
                profile={preferences.profiles[activeHobby.id] ?? createHobbyProfile()}
                position={questionIndex + 1}
                total={selectedHobbies.length}
                onChange={(updates) => updateProfile(activeHobby.id, updates)}
                onBack={() => questionIndex > 0 ? setQuestionIndex((index) => index - 1) : setScreen("hobbies")}
                onNext={advanceQuestion}
                onSkip={advanceQuestion}
                onOpenBookshelf={() => setBookshelfOpen(true)}
              />
            ) : (
              <div className="empty-state"><h3>No hobbies selected yet.</h3><button className="secondary-button" type="button" onClick={() => setScreen("hobbies")}>Choose hobbies</button></div>
            )
          )}

          {screen === "times" && (
            <>
              <div className="section-intro">
                <h1 id="onboarding-title">When does <em>you-time</em> happen?</h1>
                <p>Choose the moments that usually feel like they could be yours.</p>
              </div>
              <div className="time-list" role="group" aria-label="Preferred hobby times">
                {preferredTimes.map((time, index) => {
                  const selected = preferences.preferredTimes.includes(time);
                  const icons = ["☼", "☾", "☀", "✿", "☾"];
                  return <button className={`time-option ${selected ? "selected" : ""}`} aria-pressed={selected} type="button" key={time} onClick={() => toggleTime(time)}><span className="time-icon" aria-hidden="true">{icons[index]}</span><span>{time}</span><span className="time-check" aria-hidden="true">{selected ? "✓" : ""}</span></button>;
                })}
              </div>
              <div className="flow-actions">
                <button className="quiet-button" type="button" onClick={() => setScreen("details")}>Back</button>
                <button className="primary-button" type="button" onClick={finishOnboarding}>Find my first idea <span aria-hidden="true">↗</span></button>
              </div>
            </>
          )}
        </section>
      )}

      {screen === "activity-flow" && (
        <section className="activity-flow" aria-labelledby="activity-flow-title">
          <div className="activity-flow-progress" aria-label={`Question ${activityFlowStep + 1} of 3`}>
            <span>{activityFlowStep + 1} of 3</span>
            <div className="flow-progress-track" aria-hidden="true">
              <span style={{ width: `${((activityFlowStep + 1) / 3) * 100}%` }} />
            </div>
          </div>
          <div className="activity-flow-content" key={activityFlowStep} aria-live="polite" aria-atomic="true">
            <p className="eyebrow"><span className="eyebrow-dot" /> A moment for yourself</p>
            <h1 id="activity-flow-title">
              {activityFlowStep === 0
                ? "Staying in or going out?"
                : activityFlowStep === 1
                  ? "How’s your energy?"
                  : "How much time have you got?"}
            </h1>
            <p className="activity-flow-subtitle">
              {activityFlowStep === 0
                ? "We’ll find something lovely that fits where you are."
                : activityFlowStep === 1
                  ? "This helps us order your ideas, not rule anything out."
                  : "Think of this as your maximum; a shorter activity is always welcome."}
            </p>
            {activityFlowStep === 0 && (
              <div className="flow-choice-grid" role="group" aria-label="Choose a location">
                <button className="flow-choice" type="button" aria-pressed={place === "inside"} onClick={() => { setPlace("inside"); setRecommendationOffset(0); setShowAllActivities(false); setActiveCardIndex(0); setActivityFlowStep(1); }}>
                  <span aria-hidden="true">🏡</span><strong>Stay in</strong>
                </button>
                <button className="flow-choice" type="button" aria-pressed={place === "outside"} onClick={() => { setPlace("outside"); setRecommendationOffset(0); setShowAllActivities(false); setActiveCardIndex(0); setActivityFlowStep(1); }}>
                  <span aria-hidden="true">🌿</span><strong>Go out</strong>
                </button>
              </div>
            )}
            {activityFlowStep === 1 && (
              <div className="flow-choice-grid energy-choice-grid" role="group" aria-label="Choose your energy">
                {[
                  { value: 1, icon: "☁️", label: "Low", description: "Something gentle" },
                  { value: 3, icon: "🌷", label: "Some", description: "A little motivation" },
                  { value: 5, icon: "⚡", label: "Lots", description: "Ready to move" },
                ].map((option) => (
                  <button className="flow-choice" type="button" aria-pressed={energy === option.value} key={option.value} onClick={() => { setEnergy(option.value); setRecommendationOffset(0); setShowAllActivities(false); setActiveCardIndex(0); setActivityFlowStep(2); }}>
                    <span aria-hidden="true">{option.icon}</span><strong>{option.label}</strong><small>{option.description}</small>
                  </button>
                ))}
              </div>
            )}
            {activityFlowStep === 2 && (
              <div className="flow-choice-grid time-choice-grid" role="group" aria-label="Choose your maximum available time">
                {[15, 30, 60].map((option) => (
                  <button className="flow-choice" type="button" aria-pressed={minutes === option} key={option} onClick={() => { setMinutes(option); setRecommendationOffset(0); setShowAllActivities(false); setActiveCardIndex(0); setScreen("dashboard"); }}>
                    <span aria-hidden="true">◷</span><strong>{option} minutes</strong>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="activity-flow-actions">
            <button className="quiet-button" type="button" onClick={() => activityFlowStep === 0 ? setScreen("dashboard") : setActivityFlowStep((step) => step - 1)}>
              {activityFlowStep === 0 ? "Back to ideas" : "← Back"}
            </button>
            <button className="quiet-button restart-flow-button" type="button" onClick={openActivityFlow}>Restart flow</button>
          </div>
        </section>
      )}

      {screen === "bookshelf" && (
        <section className="onboarding" aria-labelledby="bookshelf-title">
          <Bookshelf
            books={preferences.profiles.reading?.books ?? []}
            onChange={(books) => updateProfile("reading", { books })}
            onDone={() => setScreen("dashboard")}
          />
        </section>
      )}

      {screen === "activity" && currentSession && (
        <ActivityExperience
          session={currentSession}
          now={timerNow}
          onCancel={cancelActivity}
          onStartPreparation={startPreparation}
          onSkipPreparation={startActivityNow}
          onPause={pauseActivity}
          onResume={resumeActivity}
          onEndEarly={endActivityEarly}
          onSave={saveDiaryEntry}
          onOpenDiary={() => setScreen("diary")}
        />
      )}

      {screen === "diary" && (
        <section className="diary-screen" aria-labelledby="diary-title">
          <div className="diary-heading">
            <div><p className="eyebrow">A collection of little moments</p><h1 id="diary-title">Your hobby <em>diary.</em></h1><p>Every bit of time you make for yourself counts.</p></div>
            <div className="diary-heading-actions"><button className="secondary-button" type="button" onClick={() => setScreen("collage")}>Create weekly collage</button><button className="quiet-button" type="button" onClick={() => setScreen("dashboard")}>Back to ideas</button></div>
          </div>
          {diaryEntries.length ? (
            <div className="diary-list">
              {diaryEntries.map((entry) => (
                <article className="diary-entry" key={entry.id}>
                  {entry.photoDataUrl && (
                    // This image is stored locally in the user's browser, not served from an account.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="diary-photo" src={entry.photoDataUrl} alt={`Photo from ${entry.activityTitle}`} />
                  )}
                  <div className="diary-entry-copy">
                    <span className="diary-hobby">{entry.hobbyIcon} {entry.hobbyName} · {entry.status === "completed" ? "Completed" : "Unfinished"}</span>
                    <h2>{entry.activityTitle}</h2>
                    <p>{new Date(entry.finishedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</p>
                    <strong>{formatDiaryDuration(entry.actualElapsedSeconds)} <small>of {formatDiaryDuration(entry.plannedSeconds)}</small></strong>
                    {entry.availableTimeMinutes && entry.availableTimeMinutes * 60 !== entry.plannedSeconds && <p className="diary-resource">{entry.availableTimeMinutes} min available · {formatDiaryDuration(entry.plannedSeconds)} activity</p>}
                    {entry.resourceTitle && <p className="diary-resource">{entry.resourceLabel}: {entry.resourceTitle}</p>}
                    {entry.journalPrompt && <div className="diary-journal-prompt"><span>{entry.journalPrompt.category}</span><p>{entry.journalPrompt.text}</p></div>}
                    {entry.photoDataUrl && <span className="local-only-badge">Stored in this browser only</span>}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state diary-empty"><span aria-hidden="true">🌱</span><h2>Your moments will live here.</h2><p>Finish or save an activity as unfinished, and it’ll appear in your diary.</p><button className="primary-button" type="button" onClick={() => setScreen("dashboard")}>Find an activity <span aria-hidden="true">→</span></button></div>
          )}
        </section>
      )}

      {screen === "collage" && (
        <section className="diary-screen">
          <WeeklyCollage entries={diaryEntries} onBack={() => setScreen("diary")} />
        </section>
      )}

      {screen === "notifications" && (
        <NotificationSettings
          preferredTimes={preferences.preferredTimes}
          onBack={() => setScreen("dashboard")}
        />
      )}

      {screen === "dashboard" && (
        <section className="dashboard" aria-labelledby="dashboard-title">
          <div className="dashboard-heading">
            <div>
              <p className="eyebrow"><span className="eyebrow-dot" /> A moment for yourself</p>
              <h1 id="dashboard-title">What sounds <em>good?</em></h1>
              <p className="dashboard-subtitle">A little time is all you need to get started.</p>
            </div>
            <div className="day-stamp" aria-hidden="true"><span>YOUR</span><strong>OFFLINE<br />HOUR</strong><span>STARTS HERE</span></div>
          </div>

          <div className="shortlist-context">
            <p><span aria-hidden="true">{place === "inside" ? "🏡" : "🌿"}</span> {place === "inside" ? "Staying in" : "Going out"}</p>
            <p><span aria-hidden="true">{energy === 1 ? "☁️" : energy === 5 ? "⚡" : "🌷"}</span> {energy === 1 ? "Low energy" : energy === 5 ? "Lots of energy" : "Some energy"}</p>
            <p><span aria-hidden="true">◷</span> Up to {minutes} minutes</p>
            <button type="button" onClick={openActivityFlow}>Adjust answers</button>
          </div>

          <div className="recommendation-heading">
            <div><p className="eyebrow">Made for this moment</p><h2>Your little shortlist ✨</h2></div>
            <span className="results-count">{(showAllActivities ? allSuitableActivities : recommendations).length} {(showAllActivities ? allSuitableActivities : recommendations).length === 1 ? "idea" : "ideas"}</span>
          </div>
          {recommendations.length > 0 ? (
            <>
            <div className="recommendation-carousel" role="region" aria-roledescription="carousel" aria-label={showAllActivities ? "All eligible activities" : "Your activity recommendations"}>
            <div className="recommendation-grid" ref={recommendationRailRef} onScroll={updateActiveCard} tabIndex={0} aria-label="Swipe or scroll to browse activity cards">
              {recommendationActivities.map((activity, index) => {
                const hobby = allHobbies.find((item) => item.id === activity.hobbyId);
                if (!hobby) return null;
                const profile = preferences.profiles[activity.hobbyId] ?? createHobbyProfile();
                const missing = activity.materials.filter((material) =>
                  !profile.supplies?.includes(material) &&
                  !profile.notes?.toLowerCase().includes(material.toLowerCase()),
                );
                const customMaterials = hobby.kind === "custom" ? activity.materials : [];
                const actualDurationLabel = activity.durationSeconds !== undefined
                  ? formatDiaryDuration(activity.durationSeconds)
                  : activity.durationVerified === false
                    ? `${activity.duration} min plan · link length unverified`
                    : `${activity.duration} min`;
                const durationLabel = activity.durationSeconds !== undefined && activity.availableTimeMinutes !== undefined &&
                  activity.durationSeconds !== activity.availableTimeMinutes * 60
                  ? `${actualDurationLabel} actual · ${activity.availableTimeMinutes} min available`
                  : activity.durationSeconds !== undefined
                    ? `${actualDurationLabel} video`
                    : activity.availableTimeMinutes !== undefined && activity.duration !== activity.availableTimeMinutes
                      ? `${actualDurationLabel} activity · ${activity.availableTimeMinutes} min available`
                      : actualDurationLabel;
                return (
                  <article className={`activity-card activity-${index + 1}`} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${recommendationActivities.length}`} key={activity.id}>
                    {activity.thumbnailUrl && <a className="activity-thumbnail-link" href={activity.resourceUrl} target="_blank" rel="noreferrer" aria-label={`Watch ${activity.title}`}><Image className="activity-thumbnail" src={activity.thumbnailUrl} alt="" width={480} height={270} unoptimized /></a>}
                    <div className="activity-topline"><span className={`mini-icon ${hobby.color}`} aria-hidden="true">{hobby.icon}</span><span className="activity-duration">{durationLabel}</span></div>
                    <p className="activity-category">{hobby.name} · {activity.place === "either" ? "Anywhere" : activity.place}</p>
                    <h3>{activity.title}</h3>
                    <p className="activity-description">{activity.description}</p>
                    {activity.videoChannel && <p className="video-instructor">Instructor · {activity.videoChannel}</p>}
                    {activity.journalPrompt && <div className="journal-prompt"><span>{activity.journalPrompt.category}</span><p>{activity.journalPrompt.text}</p><button type="button" onClick={() => setJournalPromptIndex((index) => index + 1)}>Give me another prompt <span aria-hidden="true">↻</span></button><button type="button" onClick={() => updateProfile(activity.hobbyId, { journalingSessionMode: "free" })}>Free Writing instead</button></div>}
                    {activity.hobbyId === "journaling" && !activity.journalPrompt && (profile.journalingPromptPreference === "Yes, give me prompts." || profile.journalingPromptPreference === "Sometimes, let me choose.") && <div className="journal-prompt"><span>Free writing</span><p>Follow your own thoughts for {activity.duration} minutes.</p><button type="button" onClick={() => updateProfile(activity.hobbyId, { journalingSessionMode: "prompt" })}>Give me a prompt</button></div>}
                    {activity.durationSeconds === undefined && <div className="activity-duration-control" aria-label={`${hobby.name} session duration, ${activity.duration} minutes`}>
                      <span>{activity.hobbyId === "journaling"
                        ? `Suggested ${getJournalingDurationRange(minutes).join("–")} min · ${minutes} min available`
                        : activity.durationVerified === false
                          ? "Planned session · video length unverified"
                          : `${minutes} min available · adjust session`}</span>
                      <div><button type="button" aria-label={`Shorten ${hobby.name.toLowerCase()} timer by one minute`} disabled={activity.duration <= 1} onClick={() => adjustActivityDuration(activity, -1)}>−</button><strong>{activity.duration} min</strong><button type="button" aria-label={`Lengthen ${hobby.name.toLowerCase()} timer by one minute`} disabled={activity.duration >= minutes} onClick={() => adjustActivityDuration(activity, 1)}>+</button></div>
                    </div>}
                    <div className="activity-footer"><span>{activity.resourceUrl
                      ? <a className={activity.videoSource ? "youtube-action" : ""} href={activity.resourceUrl} target="_blank" rel="noreferrer">
                          {activity.videoSource === "fallback"
                            ? "Search YouTube results · unverified ↗"
                            : activity.verifiedVideo
                              ? "Watch on YouTube ↗"
                              : `${activity.resourceLabel ?? "Open saved link"} ↗`}
                        </a>
                      : customMaterials.length ? `Your notes: ${customMaterials.join(", ")}` : missing.length === 0 ? "A little time for yourself" : `You’ll need: ${missing.join(", ")}`}</span></div>
                    <button className="activity-start-button" type="button" onClick={() => startActivity(activity, hobby)}>Lock this in 💜 <span aria-hidden="true">→</span></button>
                  </article>
                );
              })}
            </div>
            {(showAllActivities ? allSuitableActivities : recommendations).length > 1 && (
              <div className="carousel-controls">
                <button className="carousel-arrow" type="button" aria-label="Previous activity" disabled={activeCardIndex === 0} onClick={() => showRecommendationCard(activeCardIndex - 1)}>←</button>
                <span aria-live="polite">{Math.min(activeCardIndex + 1, (showAllActivities ? allSuitableActivities : recommendations).length)} of {(showAllActivities ? allSuitableActivities : recommendations).length}</span>
                <button className="carousel-arrow" type="button" aria-label="Next activity" disabled={activeCardIndex >= (showAllActivities ? allSuitableActivities : recommendations).length - 1} onClick={() => showRecommendationCard(activeCardIndex + 1)}>→</button>
              </div>
            )}
            </div>
            {allSuitableActivities.length < 3 && <p className="recommendation-limit-note" role="status">Only {allSuitableActivities.length} suitable {allSuitableActivities.length === 1 ? "idea fits" : "ideas fit"} your current setting, time, and activity preferences.</p>}
            <div className="recommendation-actions">
              {allSuitableActivities.length > 3 && <button className="quiet-button" type="button" onClick={() => { setShowAllActivities((showing) => !showing); setActiveCardIndex(0); recommendationRailRef.current?.scrollTo({ left: 0 }); }}>{showAllActivities ? "Show shortlist" : `See all activities (${allSuitableActivities.length})`}</button>}
              {allSuitableActivities.length > 3 && !showAllActivities && <button className="secondary-button" type="button" onClick={() => { setRecommendationOffset((offset) => offset + 3); setActiveCardIndex(0); recommendationRailRef.current?.scrollTo({ left: 0 }); }}>Show me different ideas <span aria-hidden="true">↻</span></button>}
            </div>
            </>
          ) : (
            <div className="empty-state"><span aria-hidden="true">🌱</span><h3>{videoDiscoveryLoading ? "Finding a video that fits…" : "No ideas fit those choices yet."}</h3><p>{videoDiscoveryLoading ? "Checking saved videos and your instructor preferences." : "Try a different setting or more available time, or review any activities you excluded."}</p></div>
          )}
          <footer className="dashboard-footer"><span>Small moments make a life.</span><div className="dashboard-footer-actions">{preferences.profiles.reading && <button type="button" onClick={() => setScreen("bookshelf")}>My bookshelf <span aria-hidden="true">↗</span></button>}<button type="button" onClick={() => setScreen("diary")}>My diary <span aria-hidden="true">↗</span></button><button type="button" onClick={() => setScreen("notifications")}>Notification settings <span aria-hidden="true">↗</span></button><button type="button" onClick={() => { setShowCustomHobbyForm(false); setScreen("hobbies"); }}>Edit my hobbies <span aria-hidden="true">↗</span></button></div></footer>
        </section>
      )}

      {(screen === "dashboard" || screen === "diary") && (
        <nav className="mobile-nav" aria-label="Main navigation">
          <button className={screen === "dashboard" ? "active" : ""} type="button" onClick={() => setScreen("dashboard")}><span aria-hidden="true">⌂</span>Ideas</button>
          <button className={screen === "diary" ? "active" : ""} type="button" onClick={() => setScreen("diary")}><span aria-hidden="true">✦</span>My diary{diaryEntries.length > 0 && <span className="nav-count">{diaryEntries.length}</span>}</button>
          <button type="button" onClick={() => { setShowCustomHobbyForm(false); setScreen("hobbies"); }}><span aria-hidden="true">♡</span>Hobbies</button>
        </nav>
      )}
    </main>
  );
}

function formatDiaryDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes === 0) return `${remainder} sec`;
  return remainder ? `${minutes} min ${remainder} sec` : `${minutes} min`;
}