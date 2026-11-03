"use client";

import { useState } from "react";
import type {
  CurrentFrequency,
  DesiredFrequency,
  Hobby,
  HobbyProfile,
  JournalingPromptPreference,
  ResourceLink,
  VideoPreference,
} from "./hobby-data";

type HobbyQuestionsProps = {
  hobby: Hobby;
  profile: HobbyProfile;
  position: number;
  total: number;
  onChange: (updates: Partial<HobbyProfile>) => void;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  onOpenBookshelf?: () => void;
};

const currentFrequencies: CurrentFrequency[] = ["Never", "Rarely", "About once a week", "Several times a week", "Daily"];
const desiredFrequencies: DesiredFrequency[] = ["Occasionally", "Once a week", "A few times a week", "Daily"];
const sessionDurations = [10, 15, 20, 30, 45, 60];
const instructorPreferences: VideoPreference[] = ["From favourites", "Discover new instructors", "Both", "No"];
const runningOptions = ["Easy runs", "Long runs", "Intervals", "Trail running"];
const cookingOptions = ["Dinner meals", "Breakfast/brunch", "Baking", "Desserts", "Snacks", "Meal prep"];
const readingOptions = ["Physical books", "Kindle/e-reader", "Audiobooks"];
const locations = ["At home", "In a studio", "Both"] as const;
const runningLocations = ["Outside", "On a treadmill", "Both"] as const;
const cookingStyles = ["Following recipes", "Improvising", "Both"] as const;
const activityLocations = ["Use the default", "Inside", "Outside", "Both"] as const;
const customActivityLocations = ["Inside", "Outside", "Both"] as const;

export default function HobbyQuestions({
  hobby,
  profile,
  position,
  total,
  onChange,
  onBack,
  onNext,
  onSkip,
  onOpenBookshelf,
}: HobbyQuestionsProps) {
  const [instructorName, setInstructorName] = useState("");
  const [instructorUrl, setInstructorUrl] = useState("");
  const [videoName, setVideoName] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [recipeName, setRecipeName] = useState("");
  const [recipeUrl, setRecipeUrl] = useState("");
  const [resourceName, setResourceName] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  function updateAnswers(updates: Partial<Pick<HobbyProfile, "enjoyment" | "currentFrequency" | "desiredFrequency">>) {
    onChange(updates);
  }

  function toggleListValue(key: "readingFormats" | "preferredDurations" | "runningActivities" | "runningDurations" | "cookingInterests", value: string | number) {
    const current = (profile[key] ?? []) as (string | number)[];
    const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
    onChange({ [key]: next });
  }

  function addResource(kind: "instructors" | "videos" | "recipes" | "custom") {
    const name = kind === "instructors" ? instructorName.trim() : kind === "videos" ? videoName.trim() : kind === "recipes" ? recipeName.trim() : resourceName.trim();
    const url = kind === "instructors" ? instructorUrl.trim() : kind === "videos" ? videoUrl.trim() : kind === "recipes" ? recipeUrl.trim() : resourceUrl.trim();
    if (!name && !url) return;
    if (kind === "videos" && !url) return;
    const listKey = kind === "instructors" ? "favoriteInstructors" : kind === "videos" ? "savedVideos" : kind === "recipes" ? "recipeLinks" : "customResources";
    const list = (profile[listKey] ?? []) as ResourceLink[];
    onChange({ [listKey]: [...list, { name: name || url, url }] });
    if (kind === "instructors") { setInstructorName(""); setInstructorUrl(""); }
    if (kind === "videos") { setVideoName(""); setVideoUrl(""); }
    if (kind === "recipes") { setRecipeName(""); setRecipeUrl(""); }
    if (kind === "custom") { setResourceName(""); setResourceUrl(""); }
  }

  function removeResource(listKey: "favoriteInstructors" | "savedVideos" | "recipeLinks" | "customResources", index: number) {
    onChange({ [listKey]: (profile[listKey] ?? []).filter((_, itemIndex) => itemIndex !== index) });
  }

  return (
    <div className="hobby-question-screen">
      <div className="hobby-question-progress">
        <div><p className="eyebrow">A little about this one</p><p className="hobby-progress-label">Hobby {position} of {total}</p></div>
        <div className="question-progress-track" aria-hidden="true"><span style={{ width: `${(position / total) * 100}%` }} /></div>
      </div>

      <article className="hobby-question-card">
        <div className="hobby-question-title"><span className={`mini-icon ${hobby.color}`} aria-hidden="true">{hobby.icon}</span><div><h1 id="hobby-question-title">{hobby.name}</h1><p>Skip anything you’d rather leave for later.</p></div></div>

        <fieldset className="question-fieldset">
          <legend>How much do you enjoy {hobby.name.toLowerCase()}?</legend>
          <div className="question-hearts" role="group" aria-label={`${hobby.name} enjoyment rating`}>
            {[1, 2, 3, 4, 5].map((rating) => <button type="button" className={profile.enjoyment !== null && rating <= profile.enjoyment ? "filled" : ""} aria-label={`${rating} out of 5 hearts`} aria-pressed={profile.enjoyment === rating} key={rating} onClick={() => updateAnswers({ enjoyment: profile.enjoyment === rating ? null : rating })}>♥</button>)}
            {profile.enjoyment !== null && <button className="clear-answer" type="button" onClick={() => updateAnswers({ enjoyment: null })}>Clear</button>}
          </div>
        </fieldset>

        <ChoiceGroup label="How often do you currently do it?" options={currentFrequencies} value={profile.currentFrequency} onSelect={(value) => updateAnswers({ currentFrequency: value === "" ? null : value as CurrentFrequency })} />
        <ChoiceGroup label="How often would you like to do it?" options={desiredFrequencies} value={profile.desiredFrequency} onSelect={(value) => updateAnswers({ desiredFrequency: value === "" ? null : value as DesiredFrequency })} />

        {hobby.kind === "reading" && (
          <div className="hobby-specific-fields">
            <ChoiceGroup label="How do you prefer reading?" options={readingOptions} value={profile.readingFormats ?? []} multiple onSelect={(value) => toggleListValue("readingFormats", value)} />
            <label className="question-input-label">Are you currently reading anything? <span>Optional</span><input type="text" value={profile.currentBookTitle ?? ""} onChange={(event) => onChange({ currentBookTitle: event.target.value })} placeholder="A book you have open right now" /></label>
            <div className="bookshelf-shortcut"><div><strong>Your personal bookshelf</strong><span>Search, import a list, or keep track of what you’ve read.</span></div><button className="secondary-button" type="button" onClick={onOpenBookshelf}>Open bookshelf</button></div>
          </div>
        )}

        {hobby.kind === "journaling" && (
          <div className="hobby-specific-fields">
            <ChoiceGroup
              label="Would you like some journaling inspiration?"
              options={["Yes, give me prompts.", "Sometimes, let me choose.", "No thanks, I prefer free writing."]}
              value={profile.journalingPromptPreference ?? null}
              onSelect={(value) => onChange({ journalingPromptPreference: value === "" ? null : value as JournalingPromptPreference })}
            />
          </div>
        )}

        {(hobby.kind === "yoga" || hobby.kind === "pilates") && (
          <div className="hobby-specific-fields">
            <ChoiceGroup label={`Where should ${hobby.name.toLowerCase()} activities be suggested?`} options={activityLocations} value={profile.activityLocation ?? "Use the default"} onSelect={(value) => onChange({ activityLocation: value === "Use the default" ? null : value as HobbyProfile["activityLocation"] })} />
            <ChoiceGroup label={`Do you practise ${hobby.name.toLowerCase()} at home or in a studio?`} options={locations} value={profile.practiceLocation ?? null} onSelect={(value) => onChange({ practiceLocation: value === "" ? null : value as HobbyProfile["practiceLocation"] })} />
            <ResourceEditor title={`Favourite YouTube ${hobby.name.toLowerCase()} instructors`} emptyText="Your saved instructor names and links can inform future recommendations." name={instructorName} url={instructorUrl} resources={profile.favoriteInstructors ?? []} namePlaceholder="Channel or instructor name" onNameChange={setInstructorName} onUrlChange={setInstructorUrl} onAdd={() => addResource("instructors")} onRemove={(index) => removeResource("favoriteInstructors", index)} />
            <ResourceEditor title={`Saved ${hobby.name.toLowerCase()} video links`} emptyText="Saved video URLs are checked for their real title and duration when the API is configured." name={videoName} url={videoUrl} resources={profile.savedVideos ?? []} namePlaceholder="Optional video note" onNameChange={setVideoName} onUrlChange={setVideoUrl} onAdd={() => addResource("videos")} onRemove={(index) => removeResource("savedVideos", index)} />
            <ChoiceGroup label={`Would you like YouTube ${hobby.name.toLowerCase()} recommendations?`} options={instructorPreferences} value={profile.videoPreference ?? null} onSelect={(value) => onChange({ videoPreference: value === "" ? null : value as VideoPreference })} />
            <ChoiceGroup label="Preferred session durations" options={sessionDurations.map((duration) => `${duration} minutes`)} value={(profile.preferredDurations ?? []).map((duration) => `${duration} minutes`)} multiple onSelect={(value) => toggleListValue("preferredDurations", Number.parseInt(value, 10))} />
          </div>
        )}

        {hobby.kind === "running" && (
          <div className="hobby-specific-fields">
            <ChoiceGroup label="What running activities do you enjoy?" options={runningOptions} value={profile.runningActivities ?? []} multiple onSelect={(value) => toggleListValue("runningActivities", value)} />
            <ChoiceGroup label="Where do you prefer to run?" options={runningLocations} value={profile.runningLocation ?? null} onSelect={(value) => onChange({ runningLocation: value === "" ? null : value as HobbyProfile["runningLocation"] })} />
            <ChoiceGroup label="Preferred durations" options={["15 minutes", "30 minutes", "45 minutes", "60+ minutes"]} value={profile.runningDurations ?? []} multiple onSelect={(value) => toggleListValue("runningDurations", value)} />
          </div>
        )}

        {hobby.kind !== "custom" && hobby.kind !== "running" && hobby.kind !== "yoga" && hobby.kind !== "pilates" && (
          <ChoiceGroup
            label={`Where should ${hobby.name.toLowerCase()} activities be suggested?`}
            options={activityLocations}
            value={profile.activityLocation ?? "Use the default"}
            onSelect={(value) => onChange({ activityLocation: value === "Use the default" ? null : value as HobbyProfile["activityLocation"] })}
          />
        )}

        {hobby.kind === "cooking" && (
          <div className="hobby-specific-fields">
            <ChoiceGroup label="What do you enjoy making?" options={cookingOptions} value={profile.cookingInterests ?? []} multiple onSelect={(value) => toggleListValue("cookingInterests", value)} />
            <ChoiceGroup label="Do you prefer following recipes or improvising?" options={cookingStyles} value={profile.cookingStyle ?? null} onSelect={(value) => onChange({ cookingStyle: value === "" ? null : value as HobbyProfile["cookingStyle"] })} />
            <ChoiceGroup label="Would you like to save favourite recipes, sites, creators, or links?" options={["Yes", "No"]} value={profile.saveRecipeLinks === null || profile.saveRecipeLinks === undefined ? null : profile.saveRecipeLinks ? "Yes" : "No"} onSelect={(value) => onChange({ saveRecipeLinks: value === "" ? null : value === "Yes" })} />
            {profile.saveRecipeLinks && <ResourceEditor title="Saved recipe links" emptyText="Add links you’d like to come back to." name={recipeName} url={recipeUrl} resources={profile.recipeLinks ?? []} namePlaceholder="Recipe or site name" onNameChange={setRecipeName} onUrlChange={setRecipeUrl} onAdd={() => addResource("recipes")} onRemove={(index) => removeResource("recipeLinks", index)} />}
          </div>
        )}

        {hobby.kind === "craft" && (
          <div className="hobby-specific-fields">
            <ChoiceGroup label="Are you currently working on a project?" options={["Yes", "No"]} value={profile.projectInProgress === null || profile.projectInProgress === undefined ? null : profile.projectInProgress ? "Yes" : "No"} onSelect={(value) => onChange({ projectInProgress: value === "" ? null : value === "Yes" })} />
            {profile.projectInProgress && <>
              <label className="question-input-label">Project name <span>Optional</span><input type="text" value={profile.projectName ?? ""} onChange={(event) => onChange({ projectName: event.target.value })} placeholder="What are you making?" /></label>
              <ChoiceGroup label="Would you like to continue this unfinished project?" options={["Yes", "No"]} value={profile.continueProject === null || profile.continueProject === undefined ? null : profile.continueProject ? "Yes" : "No"} onSelect={(value) => onChange({ continueProject: value === "" ? null : value === "Yes" })} />
            </>}
            <label className="question-input-label">Pattern or tutorial link <span>Optional</span><input type="url" value={profile.patternLink ?? ""} onChange={(event) => onChange({ patternLink: event.target.value })} placeholder="https://" /></label>
          </div>
        )}

        {hobby.kind === "custom" && (
          <div className="hobby-specific-fields">
            <ChoiceGroup label={`Where can you do ${hobby.name.toLowerCase()}?`} options={customActivityLocations} value={profile.activityLocation ?? null} onSelect={(value) => onChange({ activityLocation: value === "" ? null : value as HobbyProfile["activityLocation"] })} />
            <label className="question-input-label">What would you like to do within {hobby.name.toLowerCase()}? <span>Optional</span><textarea value={profile.customActivity ?? ""} onChange={(event) => onChange({ customActivity: event.target.value })} placeholder="A small activity or idea" /></label>
            <label className="question-input-label">Materials or resources <span>Optional</span><textarea value={profile.customMaterials ?? ""} onChange={(event) => onChange({ customMaterials: event.target.value })} placeholder="Anything useful to have nearby" /></label>
            <ResourceEditor title="Tutorial or resource links" emptyText="Save links that help you get started." name={resourceName} url={resourceUrl} resources={profile.customResources ?? []} namePlaceholder="Resource name" onNameChange={setResourceName} onUrlChange={setResourceUrl} onAdd={() => addResource("custom")} onRemove={(index) => removeResource("customResources", index)} />
          </div>
        )}
      </article>

      <div className="hobby-question-actions">
        <button className="quiet-button" type="button" onClick={onBack}>Back</button>
        <button className="skip-button" type="button" onClick={onSkip}>Skip</button>
        <button className="primary-button" type="button" onClick={onNext}>{position === total ? "Continue" : "Next"}<span aria-hidden="true">→</span></button>
      </div>
    </div>
  );
}

function ChoiceGroup({
  label,
  options,
  value,
  multiple = false,
  onSelect,
}: {
  label: string;
  options: readonly string[];
  value: string | string[] | null;
  multiple?: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <fieldset className="question-fieldset">
      <legend>{label}</legend>
      <div className="question-choices" role="group" aria-label={label}>
        {options.map((option) => {
          const selected = Array.isArray(value) ? value.includes(option) : value === option;
          return <button type="button" className={`question-choice ${selected ? "selected" : ""}`} aria-pressed={selected} key={option} onClick={() => onSelect(option)}>{selected && <span aria-hidden="true">✓ </span>}{option}</button>;
        })}
        {!multiple && value !== null && value !== "" && <button className="clear-answer" type="button" onClick={() => onSelect("")}>Clear</button>}
      </div>
    </fieldset>
  );
}

function ResourceEditor({
  title,
  emptyText,
  name,
  url,
  resources,
  namePlaceholder,
  onNameChange,
  onUrlChange,
  onAdd,
  onRemove,
}: {
  title: string;
  emptyText: string;
  name: string;
  url: string;
  resources: ResourceLink[];
  namePlaceholder: string;
  onNameChange: (value: string) => void;
  onUrlChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="resource-editor">
      <div className="resource-editor-heading"><strong>{title}</strong><span>Optional</span></div>
      {resources.map((resource, index) => <div className="saved-resource" key={`${resource.name}-${index}`}><span>{resource.name}</span>{resource.url && <a href={resource.url} target="_blank" rel="noreferrer" aria-label={`Open ${resource.name}`}>↗</a>}<button type="button" className="remove-resource" aria-label={`Remove ${resource.name}`} onClick={() => onRemove(index)}>×</button></div>)}
      {resources.length === 0 && <p className="resource-empty">{emptyText}</p>}
      <div className="resource-inputs"><input type="text" value={name} onChange={(event) => onNameChange(event.target.value)} placeholder={namePlaceholder} /><input type="url" value={url} onChange={(event) => onUrlChange(event.target.value)} placeholder="Optional YouTube or website URL" /></div>
      <button type="button" className="add-resource-button" onClick={onAdd} disabled={!name.trim() && !url.trim()}>+ Add another</button>
    </div>
  );
}