"use client";

import { useState, type ChangeEvent } from "react";
import type { Activity } from "./hobby-data";

export type ActivitySession = {
  id: string;
  activity: Activity;
  hobby: { id: string; name: string; icon: string; color: string };
  plannedSeconds: number;
  phase: "details" | "preparing" | "running" | "paused" | "review";
  preparationEndsAt?: number;
  runStartedAt?: number;
  activityStartedAt?: number;
  elapsedBeforeRunSeconds: number;
  actualElapsedSeconds?: number;
  finishReason?: "timer" | "early";
  savedResource?: { label: string; title: string; url?: string };
};

export type DiaryEntry = {
  id: string;
  hobbyId?: string;
  activityTitle: string;
  hobbyName: string;
  hobbyIcon: string;
  plannedSeconds: number;
  actualElapsedSeconds: number;
  startedAt: number;
  finishedAt: number;
  status: "completed" | "unfinished";
  resourceLabel?: string;
  resourceTitle?: string;
  availableTimeMinutes?: number;
  journalPrompt?: { id?: string; category: string; text: string };
  photoDataUrl?: string;
};

type ActivityExperienceProps = {
  session: ActivitySession;
  now: number;
  onCancel: () => void;
  onStartPreparation: () => void;
  onSkipPreparation: () => void;
  onPause: () => void;
  onResume: () => void;
  onEndEarly: () => void;
  onSave: (status: DiaryEntry["status"], photoDataUrl?: string) => boolean;
  onOpenDiary: () => void;
};

function remainingSeconds(session: ActivitySession, now: number) {
  if (session.phase === "preparing") {
    return Math.max(0, Math.ceil(((session.preparationEndsAt ?? now) - now) / 1000));
  }
  if (session.phase === "paused") {
    return Math.max(0, Math.ceil(session.plannedSeconds - session.elapsedBeforeRunSeconds));
  }
  if (session.phase === "running") {
    const elapsed = session.elapsedBeforeRunSeconds + Math.max(0, now - (session.runStartedAt ?? now)) / 1000;
    return Math.max(0, Math.ceil(session.plannedSeconds - elapsed));
  }
  return session.plannedSeconds;
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes === 0) return `${remainder} seconds`;
  return remainder ? `${minutes} min ${remainder} sec` : `${minutes} min`;
}

function resizePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(imageUrl);
      const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Your browser could not prepare this photo."));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.76));
    };
    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error("This photo could not be opened. Try another image."));
    };
    image.src = imageUrl;
  });
}

export default function ActivityExperience({
  session,
  now,
  onCancel,
  onStartPreparation,
  onSkipPreparation,
  onPause,
  onResume,
  onEndEarly,
  onSave,
  onOpenDiary,
}: ActivityExperienceProps) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoConsent, setPhotoConsent] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [saveError, setSaveError] = useState("");
  const isReview = session.phase === "review";
  const secondsLeft = remainingSeconds(session, now);
  const elapsed = session.phase === "paused"
    ? session.elapsedBeforeRunSeconds
    : session.phase === "running"
      ? session.elapsedBeforeRunSeconds + Math.max(0, now - (session.runStartedAt ?? now)) / 1000
      : 0;
  const progress = session.phase === "preparing"
    ? 1 - secondsLeft / 300
    : Math.min(1, Math.max(0, elapsed / session.plannedSeconds));

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPhotoError("");
    if (!file.type.startsWith("image/")) {
      setPhotoError("Choose an image file to add a photo.");
      return;
    }
    try {
      setPhoto(await resizePhoto(file));
      setPhotoConsent(false);
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "This photo could not be prepared.");
    }
  }

  function saveEntry(status: DiaryEntry["status"]) {
    setSaveError("");
    if (status === "completed" && photo && !photoConsent) {
      setSaveError("Please confirm before saving this photo, or remove it to save without a photo.");
      return;
    }
    if (!onSave(status, status === "completed" && photoConsent ? photo ?? undefined : undefined)) {
      setSaveError("Your diary could not be saved in this browser. Remove the photo and try again.");
    }
  }

  return (
    <section className="activity-experience" aria-labelledby="activity-experience-title">
      <div className="experience-topline">
        <button className="quiet-button" type="button" onClick={isReview ? onOpenDiary : onCancel}>
          {isReview ? "View diary" : "← Back to ideas"}
        </button>
        <span className="eyebrow">{session.hobby.name} · a little time for you</span>
      </div>

      {session.phase === "details" && (
        <article className="activity-detail-panel">
          <span className={`mini-icon ${session.hobby.color}`} aria-hidden="true">{session.hobby.icon}</span>
          <p className="eyebrow">{session.hobby.name}</p>
          <h1 id="activity-experience-title">{session.activity.title}</h1>
          <p className="activity-detail-description">{session.activity.description}</p>
          <div className="detail-meta"><span>◷ &nbsp;{formatDuration(session.plannedSeconds)} activity</span>{session.activity.availableTimeMinutes !== undefined && session.activity.availableTimeMinutes * 60 !== session.plannedSeconds && <span>{session.activity.availableTimeMinutes} min available</span>}{session.activity.materials.length > 0 && <span>Bring: {session.activity.materials.join(", ")}</span>}</div>
          {session.activity.journalPrompt && <div className="session-journal-prompt"><span>{session.activity.journalPrompt.category}</span><p>{session.activity.journalPrompt.text}</p></div>}
          {session.savedResource && (
            <div className="session-resource">
              <span aria-hidden="true">✦</span>
              <div><small>{session.savedResource.label}</small><strong>{session.savedResource.title}</strong></div>
              {session.savedResource.url && <a href={session.savedResource.url} target="_blank" rel="noreferrer">Open ↗</a>}
            </div>
          )}
          {session.activity.resourceUrl && (
            <a
              className={session.activity.videoSource ? "session-resource-link youtube-watch-link" : "session-resource-link"}
              href={session.activity.resourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              {session.activity.videoSource === "fallback"
                ? "Search YouTube results · unverified ↗"
                : session.activity.verifiedVideo
                  ? "Watch on YouTube ↗"
                  : `${session.activity.resourceLabel ?? "Open saved resource"} ↗`}
            </a>
          )}
          <div className="experience-actions">
            <button className="secondary-button" type="button" onClick={onStartPreparation}>Start with 5-minute prep</button>
            <button className="primary-button" type="button" onClick={onSkipPreparation}>Start activity now <span aria-hidden="true">→</span></button>
          </div>
          <button className="discard-session-button" type="button" onClick={onCancel}>Not right now</button>
        </article>
      )}

      {session.phase === "preparing" && (
        <article className="timer-panel" aria-live="polite">
          <p className="eyebrow">Take a moment to get ready</p>
          <h1 id="activity-experience-title">Preparation time</h1>
          <p className="timer-activity-name">{session.activity.title}</p>
          <p className="timer-duration-note">{formatDuration(session.plannedSeconds)} activity time{session.activity.availableTimeMinutes !== undefined && session.activity.availableTimeMinutes * 60 !== session.plannedSeconds ? ` · ${session.activity.availableTimeMinutes} min available` : ""}</p>
          {session.activity.journalPrompt && <div className="session-journal-prompt"><span>Your prompt · {session.activity.journalPrompt.category}</span><p>{session.activity.journalPrompt.text}</p></div>}
          <div className="timer-clock preparation-clock" role="timer" aria-label={`${formatTime(secondsLeft)} preparation remaining`}>
            <span>{formatTime(secondsLeft)}</span><small>minutes to prepare</small>
          </div>
          <div className="timer-actions">
            <button className="secondary-button" type="button" onClick={onSkipPreparation}>Skip prep &amp; start</button>
            <button className="primary-button" type="button" onClick={onSkipPreparation}>Start activity <span aria-hidden="true">→</span></button>
          </div>
          <button className="discard-session-button" type="button" onClick={onCancel}>Cancel this activity</button>
        </article>
      )}

      {(session.phase === "running" || session.phase === "paused") && (
        <article className="timer-panel" aria-live="polite">
          <p className="eyebrow">{session.phase === "paused" ? "A little pause is okay" : "You’re right where you need to be"}</p>
          <h1 id="activity-experience-title">{session.phase === "paused" ? "Paused" : "Your time, now."}</h1>
          <p className="timer-activity-name">{session.activity.title}</p>
          <p className="timer-duration-note">{formatDuration(session.plannedSeconds)} activity time{session.activity.availableTimeMinutes !== undefined && session.activity.availableTimeMinutes * 60 !== session.plannedSeconds ? ` · ${session.activity.availableTimeMinutes} min available` : ""}</p>
          {session.activity.journalPrompt && <div className="session-journal-prompt"><span>Your prompt · {session.activity.journalPrompt.category}</span><p>{session.activity.journalPrompt.text}</p></div>}
          <div className="timer-clock" role="timer" aria-label={`${formatTime(secondsLeft)} remaining`}>
            <svg className="timer-progress" viewBox="0 0 220 220" aria-hidden="true">
              <circle className="timer-progress-track" cx="110" cy="110" r="99" />
              <circle className="timer-progress-value" cx="110" cy="110" r="99" style={{ strokeDashoffset: `${2 * Math.PI * 99 * (1 - progress)}` }} />
            </svg>
            <span>{formatTime(secondsLeft)}</span><small>remaining</small>
          </div>
          <div className="timer-actions">
            {session.phase === "running"
              ? <button className="secondary-button" type="button" onClick={onPause}>Pause</button>
              : <button className="primary-button" type="button" onClick={onResume}>Resume <span aria-hidden="true">→</span></button>}
            <button className="end-early-button" type="button" onClick={onEndEarly}>End early</button>
          </div>
        </article>
      )}

      {isReview && (
        <article className="completion-panel">
          <span className="completion-spark" aria-hidden="true">{session.finishReason === "timer" ? "✦" : "✿"}</span>
          <p className="eyebrow">{session.finishReason === "timer" ? "Your time is up" : "Every little bit counts"}</p>
          <h1 id="activity-experience-title">You did it! Want to capture the moment?</h1>
          <p className="completion-summary">{session.activity.title} · {formatDuration(session.actualElapsedSeconds ?? 0)} of {formatDuration(session.plannedSeconds)}</p>
          <div className="photo-choice-row">
            <label className="photo-choice">
              <span aria-hidden="true">📷</span><strong>Take a photo</strong><small>Open your camera</small>
              <input aria-label="Take a photo" type="file" accept="image/*" capture="environment" onChange={handlePhoto} />
            </label>
            <label className="photo-choice">
              <span aria-hidden="true">▧</span><strong>Choose from library</strong><small>Select an existing photo</small>
              <input aria-label="Choose from photo library" type="file" accept="image/*" onChange={handlePhoto} />
            </label>
          </div>
          {photo && (
            <div className="completion-photo-preview">
              {/* This locally-created preview is never uploaded to a service. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt="Preview of your selected activity photo" />
              <div className="photo-preview-actions">
                <label className="photo-replace-button">Replace photo<input type="file" accept="image/*" onChange={handlePhoto} /></label>
                <button type="button" onClick={() => { setPhoto(null); setPhotoConsent(false); }}>Remove</button>
              </div>
            </div>
          )}
          {photo && (
            <label className="photo-consent">
              <input type="checkbox" checked={photoConsent} onChange={(event) => setPhotoConsent(event.target.checked)} />
              <span>I’m happy to save this photo in this browser on this device. It won’t be uploaded to an account.</span>
            </label>
          )}
          {photoError && <p className="experience-error" role="alert">{photoError}</p>}
          {saveError && <p className="experience-error" role="alert">{saveError}</p>}
          <p className="local-photo-note">Photos are optional. Supabase photo storage isn’t configured, so a saved photo stays only in this browser.</p>
          <button className="skip-photo-button" type="button" onClick={() => { setPhoto(null); setPhotoConsent(false); }}>Skip photo</button>
          <div className="completion-actions">
            <button className="primary-button" type="button" disabled={Boolean(photo && !photoConsent)} onClick={() => saveEntry("completed")}>Save as completed <span aria-hidden="true">✓</span></button>
            <button className="secondary-button" type="button" onClick={() => saveEntry("unfinished")}>Save as unfinished</button>
          </div>
        </article>
      )}
    </section>
  );
}
