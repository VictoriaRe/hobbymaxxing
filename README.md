This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## YouTube video recommendations

Public video discovery uses the YouTube Data API v3 from the server route at `/api/youtube/recommendations`. The route calls `search.list` for videos, resolves instructor channels with `channels.list`, and verifies returned titles and ISO-8601 durations with `videos.list`. It does not require a YouTube account connection.

1. Create a Google Cloud project, enable **YouTube Data API v3**, and create an API key.
2. Copy `.env.example` to `.env.local` and set `YOUTUBE_API_KEY` to the key. This variable is server-only; do not add a `NEXT_PUBLIC_` prefix or commit the key.
3. Restart the Next.js server.

For Vercel, add `YOUTUBE_API_KEY` in the project's **Settings → Environment Variables** and redeploy. It is optional: without it, saved video links and clearly labelled search fallbacks remain available, but verified YouTube discovery is disabled. Restrict the key to the YouTube Data API. The route has bounded result counts but consumes Google API quota, especially for `search.list`.

When the key is absent or the endpoint is unavailable, the app uses saved video links and clearly labelled instructor-specific YouTube search links. These fallbacks do not claim a verified video title or duration. If a user chooses favourites only but no favourite instructor is saved, no generic instructor search is shown.

## Push notification setup

Push delivery is **not operational by default**. This repository does not contain production Supabase or VAPID credentials, and notifications have not been verified on a real device. The client never receives the Supabase service-role key or VAPID private key.

1. Create a Supabase project. In its SQL editor, run [`supabase/notifications.sql`](./supabase/notifications.sql). The tables store device-specific push subscriptions, schedules, and delivery deduplication keys. Row-level security is enabled and direct `anon`/`authenticated` access is revoked; only the server-side service role can access them.
2. Generate a VAPID key pair with `npx web-push generate-vapid-keys`. Keep the private key secret. Set `VAPID_SUBJECT` to a contact address such as `mailto:you@example.com`.
3. In Vercel **Settings → Environment Variables**, set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and a long random `CRON_SECRET`. Only the public VAPID key is public; do not add `NEXT_PUBLIC_` to any other secret.
4. Deploy the project with [`vercel.json`](./vercel.json). It schedules `/api/notifications/cron` every five minutes. Vercel sends the configured `CRON_SECRET` as a bearer token. Use a Vercel plan that supports this cadence; otherwise configure an external scheduler to call the same HTTPS endpoint with `Authorization: Bearer <CRON_SECRET>`.
5. After confirming the SQL schema, environment variables, and scheduled job are live, set `PUSH_NOTIFICATIONS_ENABLED=true` in Vercel and redeploy. This deliberate gate keeps the UI from claiming delivery is configured before the backend is ready.
6. On an HTTPS deployment, open **Notification settings** and explicitly enable notifications. On iPhone, use Safari **Share → Add to Home Screen**, open that installed app on iOS 16.4 or later, and enable from there. Send a test notification and verify it arrives with the app closed before announcing push as operational.

The settings support selected days, a local reminder time, weekly recap day/time, optional inactivity nudges (off by default), quiet hours, and an editable IANA timezone. Onboarding availability supplies suggested reminder days and time. The cron uses the selected timezone and quiet hours and records unique delivery keys. Test notifications can only target the device presenting its random device token; there is no endpoint for sending a message to an arbitrary subscriber. If a browser permission is denied, change it in system/browser settings; Hobbymaxxing does not repeatedly prompt.

Subscriptions and schedules are device-specific. There is no authentication or account synchronization. Diary entries and photos remain local to the browser; weekly recap notifications link back to that local diary and do not upload its contents. Inactivity nudges use the last app-open heartbeat from the opted-in device.

## Install on iPhone

Deploy Hobbymaxxing to an HTTPS origin before installing it. Open the deployed site in Safari on iPhone, tap **Share**, choose **Add to Home Screen**, then confirm with **Add**. The app includes a web manifest, standalone display settings, and Apple touch icon.

The app's icon assets are generated from [`public/app-icon.svg`](./public/app-icon.svg) by running `npm run icons:generate`. The timer uses persisted timestamps and can restore an active session after a refresh or reopening the app. iOS may suspend web apps while they are in the background, so background timers are not guaranteed.

Activity sessions and diary entries are currently stored in this browser on this device. Optional activity photos are resized and stored locally only after consent; they are not uploaded. Supabase authentication and private Storage are not configured in this project. Browser storage can be cleared by the user or browser, so it is not an account backup.

The hobby diary can create weekly photo collages from completed sessions with locally saved photos. The collage is rendered on-device as a 1080 × 1920 Story-size or 1080 × 1080 square PNG. Sharing uses the browser's native file share when supported, otherwise it downloads the PNG; it does not post to Instagram. Journaling uses an original ordered prompt library with stable IDs for morning, evening, gratitude, personal reflection, and creative writing.

Recommendation locations use hobby-specific defaults; custom hobbies require an explicit indoor/outdoor/both preference, and users can override the standard locations in onboarding. Flexible activity durations adapt to available time and can be adjusted on the recommendation card. Verified Yoga/Pilates videos retain their actual durations; YouTube search links are labelled as unverified, not as specific videos.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

1. Commit and push the project to a GitHub repository. Ensure the project files, `package.json`, and `package-lock.json` are included; `.env*` files other than `.env.example` are ignored by Git.
2. In [Vercel](https://vercel.com/new), choose **Add New → Project**, connect GitHub, and import the repository. Select the app's repository root as the **Root Directory**. Vercel detects Next.js and the `npm run build` command automatically.
3. No environment variable is required for the core app. Optionally add `YOUTUBE_API_KEY` under **Settings → Environment Variables** to enable verified video discovery, then redeploy. Do not add it as a `NEXT_PUBLIC_` variable. Follow [Push notification setup](#push-notification-setup) separately before enabling push delivery.
4. Deploy. Vercel provisions HTTPS for the deployment URL; after deployment, open that live URL and verify the homepage and `/manifest.webmanifest`. Add a custom domain from the project's **Settings → Domains** if desired.

For local production-mode verification before pushing, run `npm run build` and `npm run start`. A successful local build or preview is not a live deployment; test the Vercel URL after publishing.

The app's preferences, bookshelf, timer session, diary entries, and photos are stored in browser `localStorage`, not on a server. They remain on the device and browser where they were created. Browser storage on `localhost` is isolated from storage on the Vercel HTTPS domain, so existing local data is not automatically copied to the deployed site. No authentication, Supabase, or other database is configured; cross-device sync and account-backed/private photo storage require a backend integration.

The manifest and generated icons make the app installable. A service worker is registered only when the user explicitly enables push; it handles incoming notifications and clicks but does not cache the app for offline use. The PWA does not promise offline use. Push still needs Vercel/Supabase/VAPID setup and a real-device delivery test.

See [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
