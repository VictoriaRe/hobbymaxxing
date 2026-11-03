"use client";

import { useEffect, useMemo, useState } from "react";
import type { DiaryEntry } from "./activity-experience";
import {
  formatWeekLabel,
  getCollageDimensions,
  getCollageWeekOptions,
  getPhotosForWeek,
  getWeekStart,
  type CollageFormat,
} from "./collage-utils";

type CollageLayout = "classic" | "scrapbook" | "minimal";

type WeeklyCollageProps = {
  entries: DiaryEntry[];
  onBack: () => void;
};

const layouts: { id: CollageLayout; label: string; description: string }[] = [
  { id: "classic", label: "Classic Grid", description: "A tidy, balanced grid" },
  { id: "scrapbook", label: "Scrapbook", description: "Tilted prints on warm paper" },
  { id: "minimal", label: "Minimal", description: "One photo takes the lead" },
];

type PhotoImage = { entry: DiaryEntry; image: HTMLImageElement };

function loadImage(entry: DiaryEntry): Promise<PhotoImage> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ entry, image });
    image.onerror = () => reject(new Error(`Could not load the photo for ${entry.activityTitle}.`));
    image.src = entry.photoDataUrl ?? "";
  });
}

function drawCroppedImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function drawHeader(
  context: CanvasRenderingContext2D,
  width: number,
  title: string,
  weekLabel: string,
  includeWeek: boolean,
  headerHeight: number,
) {
  context.textAlign = "center";
  if (title.trim()) {
    context.fillStyle = "#312d32";
    context.font = "500 56px Georgia, serif";
    context.fillText(title.trim(), width / 2, 92, width - 100);
  }
  if (includeWeek) {
    context.fillStyle = "#756d6d";
    context.font = "24px Arial, sans-serif";
    context.fillText(weekLabel, width / 2, title.trim() ? 139 : 104, width - 120);
  }
  context.textAlign = "left";
  return headerHeight;
}

function drawSignature(context: CanvasRenderingContext2D, width: number, height: number, enabled: boolean) {
  if (!enabled) return;
  context.fillStyle = "rgba(70, 63, 70, 0.62)";
  context.textAlign = "right";
  context.font = "18px Arial, sans-serif";
  context.fillText("a little more life, offline · hobbymaxxing", width - 42, height - 31);
  context.textAlign = "left";
}

function drawGrid(context: CanvasRenderingContext2D, photos: PhotoImage[], width: number, top: number, bottom: number) {
  const padding = 44;
  const gap = 16;
  const columns = photos.length === 1 ? 1 : 2;
  const rows = Math.ceil(photos.length / columns);
  const cellWidth = (width - padding * 2 - gap * (columns - 1)) / columns;
  const cellHeight = (bottom - top - gap * (rows - 1)) / rows;
  photos.forEach(({ image }, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = padding + column * (cellWidth + gap);
    const y = top + row * (cellHeight + gap);
    context.save();
    context.beginPath();
    context.rect(x, y, cellWidth, cellHeight);
    context.clip();
    drawCroppedImage(context, image, x, y, cellWidth, cellHeight);
    context.restore();
  });
}

function drawScrapbook(context: CanvasRenderingContext2D, photos: PhotoImage[], width: number, top: number, bottom: number) {
  const padding = 48;
  const gap = 20;
  const columns = photos.length === 1 ? 1 : 2;
  const rows = Math.ceil(photos.length / columns);
  const cardWidth = (width - padding * 2 - gap * (columns - 1)) / columns;
  const cardHeight = (bottom - top - gap * (rows - 1)) / rows;
  photos.forEach(({ image }, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const cellX = padding + column * (cardWidth + gap);
    const cellY = top + row * (cardHeight + gap);
    const tilt = ((index % 3) - 1) * 0.035;
    context.save();
    context.translate(cellX + cardWidth / 2, cellY + cardHeight / 2);
    context.rotate(tilt);
    context.fillStyle = "#fffdfa";
    context.shadowColor = "rgba(49, 45, 50, 0.16)";
    context.shadowBlur = 14;
    context.shadowOffsetY = 7;
    context.fillRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight);
    context.shadowColor = "transparent";
    drawCroppedImage(context, image, -cardWidth / 2 + 12, -cardHeight / 2 + 12, Math.max(1, cardWidth - 24), Math.max(1, cardHeight - 24));
    context.restore();
  });
}

function drawMinimal(context: CanvasRenderingContext2D, photos: PhotoImage[], width: number, top: number, bottom: number) {
  const padding = 50;
  const gap = 14;
  const contentHeight = bottom - top;
  if (photos.length === 1) {
    drawCroppedImage(context, photos[0].image, padding, top, width - padding * 2, contentHeight);
    return;
  }
  const heroHeight = contentHeight * 0.66;
  drawCroppedImage(context, photos[0].image, padding, top, width - padding * 2, heroHeight);
  const remaining = photos.slice(1);
  const columns = Math.min(5, remaining.length);
  const rows = Math.ceil(remaining.length / columns);
  const cellWidth = (width - padding * 2 - gap * (columns - 1)) / columns;
  const cellHeight = (contentHeight - heroHeight - gap * (rows - 1)) / rows;
  remaining.forEach(({ image }, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    drawCroppedImage(context, image, padding + column * (cellWidth + gap), top + heroHeight + row * (cellHeight + gap), cellWidth, cellHeight);
  });
}

async function createCollage(
  entries: DiaryEntry[],
  options: {
    format: CollageFormat;
    layout: CollageLayout;
    title: string;
    weekLabel: string;
    includeWeek: boolean;
    includeSignature: boolean;
  },
) {
  const { width, height } = getCollageDimensions(options.format);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not create the collage canvas.");
  const photos = await Promise.all(entries.map(loadImage));
  const top = options.format === "story" ? 205 : 170;
  const bottom = height - (options.includeSignature ? 100 : 54);
  context.fillStyle = options.layout === "scrapbook" ? "#eee9dc" : "#f7f4ec";
  context.fillRect(0, 0, width, height);
  drawHeader(context, width, options.title, options.weekLabel, options.includeWeek, top);
  if (options.layout === "scrapbook") drawScrapbook(context, photos, width, top, bottom);
  else if (options.layout === "minimal") drawMinimal(context, photos, width, top, bottom);
  else drawGrid(context, photos, width, top, bottom);
  drawSignature(context, width, height, options.includeSignature);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Your browser could not export this collage.")), "image/png");
  });
  return { blob, preview: canvas.toDataURL("image/png"), width, height };
}

export default function WeeklyCollage({ entries, onBack }: WeeklyCollageProps) {
  const [weekStart, setWeekStart] = useState("");
  const [referenceTime, setReferenceTime] = useState(0);
  const [selectionWeek, setSelectionWeek] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [layout, setLayout] = useState<CollageLayout>("classic");
  const [format, setFormat] = useState<CollageFormat>("story");
  const [title, setTitle] = useState("");
  const [includeWeek, setIncludeWeek] = useState(true);
  const [includeSignature, setIncludeSignature] = useState(true);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setReferenceTime(Date.now()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const weekOptions = useMemo(
    () => getCollageWeekOptions(entries, referenceTime || entries[0]?.finishedAt || 0),
    [entries, referenceTime],
  );
  const activeWeekStart = weekStart || (referenceTime ? getWeekStart(referenceTime) : weekOptions[0] ?? "");
  const weekPhotos = useMemo(() => getPhotosForWeek(entries, activeWeekStart), [entries, activeWeekStart]);
  const effectiveSelectedIds = selectionWeek === activeWeekStart ? selectedIds : weekPhotos.map((entry) => entry.id);
  const selectedPhotos = useMemo(() => {
    const selected = new Set(effectiveSelectedIds);
    return weekPhotos.filter((entry) => selected.has(entry.id)).sort((first, second) => effectiveSelectedIds.indexOf(first.id) - effectiveSelectedIds.indexOf(second.id));
  }, [effectiveSelectedIds, weekPhotos]);

  function togglePhoto(id: string) {
    setSelectionWeek(activeWeekStart);
    setSelectedIds(effectiveSelectedIds.includes(id)
      ? effectiveSelectedIds.filter((entryId) => entryId !== id)
      : [...effectiveSelectedIds, id]);
    setPreviewUrl("");
  }

  function movePhoto(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= selectedPhotos.length) return;
    setSelectionWeek(activeWeekStart);
    setSelectedIds(() => {
      const selected = [...effectiveSelectedIds];
      const firstId = selectedPhotos[index].id;
      const secondId = selectedPhotos[nextIndex].id;
      const firstIndex = selected.indexOf(firstId);
      const secondIndex = selected.indexOf(secondId);
      [selected[firstIndex], selected[secondIndex]] = [selected[secondIndex], selected[firstIndex]];
      return selected;
    });
    setPreviewUrl("");
  }

  async function renderPreview() {
    if (selectedPhotos.length === 0) return;
    setWorking(true);
    setError("");
    setMessage("");
    try {
      const collage = await createCollage(selectedPhotos, {
        format,
        layout,
        title,
        weekLabel: formatWeekLabel(activeWeekStart),
        includeWeek,
        includeSignature,
      });
      setPreviewUrl(collage.preview);
      setMessage(`Preview ready · ${collage.width} × ${collage.height} px`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The collage preview could not be created.");
    } finally {
      setWorking(false);
    }
  }

  async function exportCollage(share: boolean) {
    if (selectedPhotos.length === 0) return;
    setWorking(true);
    setError("");
    setMessage("");
    try {
      const collage = await createCollage(selectedPhotos, {
        format,
        layout,
        title,
        weekLabel: formatWeekLabel(activeWeekStart),
        includeWeek,
        includeSignature,
      });
      const fileName = `hobbymaxxing-week-${activeWeekStart}-${format}.png`;
      const file = new File([collage.blob], fileName, { type: "image/png" });
      const shareMethod: unknown = Reflect.get(navigator, "share");
      const canShareMethod: unknown = Reflect.get(navigator, "canShare");
      let supportsFileShare = false;
      if (share && typeof shareMethod === "function" && typeof canShareMethod === "function") {
        try {
          supportsFileShare = canShareMethod.call(navigator, { files: [file] }) === true;
        } catch {
          supportsFileShare = false;
        }
      }
      if (supportsFileShare && typeof shareMethod === "function") {
        try {
          await shareMethod.call(navigator, { files: [file], title: title.trim() || "My hobby week" });
          setMessage("Shared from your device. Nothing was posted publicly by Hobbymaxxing.");
          return;
        } catch (reason) {
          if (reason instanceof DOMException && reason.name === "AbortError") return;
        }
      }
      const url = URL.createObjectURL(collage.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setPreviewUrl(collage.preview);
      setMessage(share
        ? "File sharing isn’t available here, so the collage was downloaded instead."
        : "Your collage was downloaded as a PNG.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The collage could not be exported.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="weekly-collage" aria-labelledby="collage-title">
      <div className="collage-heading">
        <div><p className="eyebrow">A week worth remembering</p><h1 id="collage-title">Create your <em>weekly collage.</em></h1><p>Choose photos saved with completed sessions, then make something lovely to keep or share.</p></div>
        <button className="quiet-button" type="button" onClick={onBack}>← Back to diary</button>
      </div>

      <div className="collage-controls">
        <label className="collage-field">Choose a week
          <select value={activeWeekStart} onChange={(event) => { setWeekStart(event.target.value); setPreviewUrl(""); setMessage(""); }}>
            {weekOptions.map((week) => <option value={week} key={week}>{formatWeekLabel(week)}</option>)}
          </select>
        </label>
        <label className="collage-field">Collage title <span>Optional</span>
          <input value={title} maxLength={70} onChange={(event) => { setTitle(event.target.value); setPreviewUrl(""); }} placeholder="A week of little joys" />
        </label>
        <fieldset className="collage-options">
          <legend>Include on your collage</legend>
          <label><input type="checkbox" checked={includeWeek} onChange={(event) => { setIncludeWeek(event.target.checked); setPreviewUrl(""); }} /> Week and dates</label>
          <label><input type="checkbox" checked={includeSignature} onChange={(event) => { setIncludeSignature(event.target.checked); setPreviewUrl(""); }} /> Subtle Hobbymaxxing signature</label>
        </fieldset>
      </div>

      {weekPhotos.length === 0 ? (
        <div className="empty-state collage-empty"><span aria-hidden="true">📷</span><h2>No saved photos for this week yet.</h2><p>Complete an activity and choose to save a photo, then it’ll be ready to add here.</p><p className="local-only-note">This collage uses photos stored in this browser on this device.</p></div>
      ) : (
        <>
          <div className="collage-photo-picker">
            <div className="collage-section-heading"><div><p className="eyebrow">Your saved moments</p><h2>Choose and arrange photos</h2></div><span>{selectedPhotos.length} selected</span></div>
            <div className="collage-photo-list">
              {weekPhotos.map((entry) => {
                const selectedIndex = selectedPhotos.findIndex((photo) => photo.id === entry.id);
                return (
                  <article className={`collage-photo-item ${selectedIndex >= 0 ? "selected" : ""}`} key={entry.id}>
                    <label className="collage-photo-choice">
                      <input type="checkbox" checked={selectedIndex >= 0} onChange={() => togglePhoto(entry.id)} />
                      {/* Photos are local data URLs created by the user's session diary. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={entry.photoDataUrl} alt={`Photo from ${entry.activityTitle}`} />
                      <span>{entry.activityTitle}</span>
                    </label>
                    {selectedIndex >= 0 && <div className="photo-order-actions"><span>{selectedIndex + 1}</span><button aria-label={`Move ${entry.activityTitle} earlier`} type="button" disabled={selectedIndex === 0} onClick={() => movePhoto(selectedIndex, -1)}>↑</button><button aria-label={`Move ${entry.activityTitle} later`} type="button" disabled={selectedIndex === selectedPhotos.length - 1} onClick={() => movePhoto(selectedIndex, 1)}>↓</button></div>}
                  </article>
                );
              })}
            </div>
          </div>

          <fieldset className="collage-layout-fieldset">
            <legend>Choose a layout</legend>
            <div className="collage-choice-grid">
              {layouts.map((option) => <button className={`collage-layout-choice ${layout === option.id ? "active" : ""}`} type="button" aria-pressed={layout === option.id} key={option.id} onClick={() => { setLayout(option.id); setPreviewUrl(""); }}><strong>{option.label}</strong><span>{option.description}</span></button>)}
            </div>
          </fieldset>

          <fieldset className="collage-layout-fieldset">
            <legend>Export size</legend>
            <div className="collage-choice-grid format-choice-grid">
              <button className={`collage-layout-choice ${format === "story" ? "active" : ""}`} type="button" aria-pressed={format === "story"} onClick={() => { setFormat("story"); setPreviewUrl(""); }}><strong>Instagram Story · 9:16</strong><span>1080 × 1920 px PNG</span></button>
              <button className={`collage-layout-choice ${format === "square" ? "active" : ""}`} type="button" aria-pressed={format === "square"} onClick={() => { setFormat("square"); setPreviewUrl(""); }}><strong>Square · 1:1</strong><span>1080 × 1080 px PNG</span></button>
            </div>
          </fieldset>

          <div className="collage-actions">
            <button className="secondary-button" type="button" disabled={working || selectedPhotos.length === 0} onClick={renderPreview}>{working ? "Working…" : "Preview collage"}</button>
            <button className="primary-button" type="button" disabled={working || selectedPhotos.length === 0} onClick={() => exportCollage(false)}>Download / Save PNG <span aria-hidden="true">↓</span></button>
            <button className="secondary-button" type="button" disabled={working || selectedPhotos.length === 0} onClick={() => exportCollage(true)}>Share… <span aria-hidden="true">↗</span></button>
          </div>
          {error && <p className="experience-error" role="alert">{error}</p>}
          {message && <p className="collage-message" role="status">{message}</p>}
          <p className="collage-privacy-note">Export stays on your device unless you choose to share it. Hobbymaxxing does not post to Instagram or upload the collage publicly.</p>
          {previewUrl && <div className="collage-preview"><p className="eyebrow">Preview · {format === "story" ? "9:16 Story" : "1:1 Square"}</p>
            {/* The preview is the generated collage data URL. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Preview of your generated hobby photo collage" /><button className="secondary-button" type="button" onClick={() => exportCollage(true)}>Share this collage</button></div>}
        </>
      )}
    </section>
  );
}
