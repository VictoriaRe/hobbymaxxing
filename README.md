# Hobbymaxxing

### Less scrolling, more doing the things you love. 🌿

Hobbymaxxing is a mobile-first hobby recommendation app that turns a little free time into a low-pressure idea for doing something you enjoy.

**[Try the live demo](https://hobbymaxxing-phi.vercel.app/)** · [GitHub repository](https://github.com/VictoriaRe/hobbymaxxing)

## The idea

It is easy to open your phone for a quick break and lose far more time to doomscrolling than you meant to. Hobbymaxxing offers a gentler next step: choose a hobby, say what fits your energy, place, and available time, then explore a few practical activities. The goal is not to optimize your day—it is to make reconnecting with something you enjoy feel easy.

## Features

- **Personalized hobby onboarding:** Choose from supported hobbies and share preferences such as interests, supplies, experience, and preferred activities.
- **Make it yours:** Add custom hobbies and set activity-location preferences for them.
- **Fit the moment:** Filter activities by staying in or going out, energy level, and available time. Hobby-specific preferences further shape recommendations.
- **Swipeable activity cards:** Browse a horizontal, touch-friendly set of activity ideas and ask for different suggestions.
- **Yoga and Pilates video links:** Use saved links, instructor preferences, and—when configured—YouTube video discovery. Without an API key, the app uses clearly labelled search links rather than claiming an unverified video is a recommendation.
- **Preparation and activity timers:** Start with a preparation countdown or begin right away; track an activity and save its outcome.
- **Optional photo check-ins:** Add a photo to a completed activity after confirming it will be saved on this device only.
- **Hobby diary and weekly collage:** Review activity entries and create a square or story-sized photo collage in the browser.
- **Installable mobile PWA:** Includes a web manifest, app icons, and a push-capable service worker. **Offline app caching is not implemented.**
- **Notification settings:** Configure device-level notification preferences and, after server setup, manage a push subscription or send a test notification. **Scheduled reminders, recaps, and inactivity nudges are disabled; saved times do not currently trigger notifications.**

## How it works

1. Choose hobbies and tell the app about your preferences.
2. Choose whether to stay in or go out.
3. Select your current energy level.
4. Choose how much time you have.
5. Swipe or scroll through activity recommendations.
6. Lock in an activity and choose whether to prepare first or start now.
7. Complete the activity and optionally save a photo check-in to your diary.

## Tech stack

- **Next.js 16** App Router and **React 19**
- **TypeScript**
- **Tailwind CSS 4** tooling and custom CSS
- **YouTube Data API v3** for optional server-side video discovery
- **Web Push** APIs and `web-push` for the optional, currently unconfigured push infrastructure
- **GitHub** for source control and **Vercel** for the live deployment

## Architecture

- The Next.js app provides the mobile-first UI and API routes for YouTube recommendations and optional notification operations.
- Activity suggestions come from a **rule-based recommendation engine** in [`src/app/hobby-data.ts`](./src/app/hobby-data.ts); no AI or machine-learning model is used.
- Preferences, sessions, diary entries, notification settings, and optional photos are stored in the browser's `localStorage`. They are not synced to an account or another device.
- The PWA manifest and icons support installation. [`public/sw.js`](./public/sw.js) handles push events when a user enables notifications; it does not cache the app for offline use.
- [`src/app/api/youtube/recommendations/route.ts`](./src/app/api/youtube/recommendations/route.ts) calls YouTube Data API v3 when `YOUTUBE_API_KEY` is configured. Without it, saved video links and labelled search fallbacks remain available.
- Notification settings, subscription, heartbeat, test-push, and scheduled-delivery routes exist. Push delivery needs Supabase and VAPID credentials configured in the deployment. **Scheduled delivery is explicitly disabled until an external scheduler is chosen and configured; no Vercel cron is enabled.**

## Development roadmap

### Phase 1 — Improve mobile experience and recommendation quality

- [x] Build a step-by-step activity flow and touch-friendly recommendation cards.
- [x] Filter suggestions by location, energy, available time, and hobby preferences.
- [ ] Continue refining mobile usability, accessibility, and the usefulness and variety of suggestions.

### Phase 2 — Add accounts and secure cloud storage

- [ ] Implement Supabase authentication and per-user access controls.
- [ ] Store user data securely in the cloud; configure private photo storage.

### Phase 3 — Migrate data and sync devices

- [ ] Migrate existing local preferences, sessions, diary entries, and photos without losing user data.
- [ ] Support reliable cross-device synchronization.

### Phase 4 — Complete opt-in push notifications

- [ ] Configure push credentials and verify opt-in delivery on supported devices.
- [ ] Select and configure a suitable free or low-cost scheduler for user-selected reminder times.
- [ ] Keep scheduled delivery disabled until reliable scheduling is in place.

### Phase 5 — Explore deeper personalization

- [ ] Explore more personalized recommendations, potentially including an ML-based approach.
- [ ] Evaluate additional cloud engineering components as the product needs them.

## Local development

Requirements: Node.js compatible with Next.js 16 and npm.

```bash
git clone https://github.com/VictoriaRe/hobbymaxxing.git
cd hobbymaxxing
npm ci
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No environment variables are required for the core app. To enable YouTube video discovery locally, add a server-only `YOUTUBE_API_KEY` to `.env.local` and restart the dev server. See [`.env.example`](./.env.example) for optional notification variables; push requires external Supabase/VAPID setup, and scheduled delivery remains disabled by default.

Useful checks:

```bash
npm run lint
npm test
npm run build
```

## Deployment

The live demo is hosted on Vercel. To deploy your own instance, import the [GitHub repository](https://github.com/VictoriaRe/hobbymaxxing) into Vercel and select the repository root. Vercel detects the Next.js app and uses `npm run build`; pushes to the connected Git branch can trigger deployments.

The core app needs no environment variables. Add `YOUTUBE_API_KEY` in Vercel's project environment settings only if you want verified YouTube video discovery, then redeploy. Push notification functionality requires separate Supabase and VAPID configuration; scheduled delivery also requires an external scheduler and is not enabled by default.

## Privacy and security

Hobbymaxxing currently has no user accounts or cloud sync. Preferences, activity sessions, diary entries, and optional photos live in this browser's `localStorage`; they can be lost if browser data is cleared and are not available on another device. Photos are resized locally and saved only after consent; they are not uploaded.

Push subscription storage can use server-side Supabase credentials if configured. The VAPID private key and Supabase service-role key must remain server-side. The repository does not include production credentials, and scheduled notification delivery is disabled. Authentication, user-specific access controls, cloud migration, and private photo storage remain planned work.

## Project status

Hobbymaxxing is an **actively developed prototype**, not a finished production-ready multi-user service. The live demo is useful for exploring the current local-first experience; accounts, cloud sync, offline support, and scheduled reminders are not yet available.

## Built by

**Victoria Reshetnikova** · [GitHub](https://github.com/VictoriaRe)
