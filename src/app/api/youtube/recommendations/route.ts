import type { ResourceLink, YouTubeVideo } from "../../../hobby-data";

type HobbyId = "yoga" | "pilates";
type TimeContext = "morning" | "daytime" | "evening" | "late-night";
type RequestBody = {
  hobbyId?: HobbyId;
  minutes?: number;
  timeContext?: TimeContext;
  videoPreference?: "From favourites" | "Discover new instructors" | "Both" | "No" | null;
  favoriteInstructors?: ResourceLink[];
  savedVideos?: ResourceLink[];
};

type ChannelItem = { id: string; snippet?: { title?: string } };
type SearchItem = {
  id?: { videoId?: string; channelId?: string };
  snippet?: { title?: string; channelTitle?: string; channelId?: string; thumbnails?: Record<string, { url?: string }> };
};
type VideoItem = {
  id: string;
  snippet?: {
    title?: string;
    channelTitle?: string;
    channelId?: string;
    thumbnails?: Record<string, { url?: string }>;
  };
  contentDetails?: { duration?: string };
};

const apiRoot = "https://www.googleapis.com/youtube/v3";
const maxInstructorCount = 4;

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function titleMatchScore(requestedName: string, channelTitle: string) {
  const requested = normalizeName(requestedName);
  const actual = normalizeName(channelTitle);
  if (!requested || !actual) return 0;
  if (requested === actual) return 100;
  if (actual.includes(requested) || requested.includes(actual)) return 85;
  const requestedTokens = requested.split(" ").filter((token) => !["yoga", "pilates", "official", "channel"].includes(token));
  if (!requestedTokens.length) return 0;
  const matchCount = requestedTokens.filter((token) => actual.includes(token)).length;
  const ratio = matchCount / requestedTokens.length;
  return ratio >= 0.75 ? Math.round(ratio * 70) : 0;
}

function extractChannelId(urlValue: string) {
  try {
    const url = new URL(urlValue);
    if (!/(^|\.)youtube\.com$/i.test(url.hostname)) return null;
    return url.pathname.match(/^\/channel\/(UC[a-zA-Z0-9_-]{20,})/)?.[1] ?? null;
  } catch {
    return null;
  }
}

function extractHandle(urlValue: string) {
  try {
    const url = new URL(urlValue);
    if (!/(^|\.)youtube\.com$/i.test(url.hostname)) return null;
    const handle = url.pathname.match(/^\/@([a-zA-Z0-9._-]+)/)?.[1];
    return handle ?? null;
  } catch {
    return null;
  }
}

function extractVideoId(urlValue: string) {
  try {
    const url = new URL(urlValue);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return url.pathname.slice(1).match(/^[a-zA-Z0-9_-]{11}/)?.[0] ?? null;
    if (host !== "youtube.com" && host !== "m.youtube.com") return null;
    const pathId = url.pathname.match(/^\/(?:shorts|embed)\/([a-zA-Z0-9_-]{11})/)?.[1];
    return pathId ?? url.searchParams.get("v")?.match(/^[a-zA-Z0-9_-]{11}$/)?.[0] ?? null;
  } catch {
    return null;
  }
}

function durationInSeconds(value: string) {
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

function contextTerms(context: TimeContext) {
  if (context === "morning") return ["morning", "wake up", "energizing", "energy", "sunrise"];
  if (context === "evening") return ["evening", "unwind", "relaxing", "wind down", "after work"];
  if (context === "late-night") return ["bedtime", "sleep", "gentle", "night", "wind down"];
  return ["flow", "practice", "session"];
}

function contextScore(title: string, context: TimeContext) {
  const normalized = normalizeName(title);
  return contextTerms(context).reduce((score, term) => score + (normalized.includes(normalizeName(term)) ? 3 : 0), 0);
}

function thumbnailUrl(item: VideoItem) {
  const thumbnails = item.snippet?.thumbnails;
  return thumbnails?.maxres?.url ?? thumbnails?.high?.url ?? thumbnails?.medium?.url ?? thumbnails?.default?.url ?? "";
}

async function googleApi<T>(resource: string, params: Record<string, string>, key: string): Promise<T> {
  const url = new URL(`${apiRoot}/${resource}`);
  Object.entries({ ...params, key }).forEach(([name, value]) => url.searchParams.set(name, value));
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`YouTube API request failed (${response.status}).`);
  return response.json() as Promise<T>;
}

async function resolveInstructor(instructor: ResourceLink, hobbyId: HobbyId, key: string) {
  const directId = instructor.url ? extractChannelId(instructor.url) : null;
  const handle = instructor.url ? extractHandle(instructor.url) : null;

  if (directId) {
    const result = await googleApi<{ items?: ChannelItem[] }>("channels", { part: "snippet", id: directId, maxResults: "1" }, key);
    const channel = result.items?.[0];
    if (channel?.id && channel.snippet?.title && titleMatchScore(instructor.name, channel.snippet.title) > 0) {
      return { id: channel.id, title: channel.snippet.title };
    }
  }

  if (handle) {
    const result = await googleApi<{ items?: ChannelItem[] }>("channels", { part: "snippet", forHandle: handle, maxResults: "1" }, key);
    const channel = result.items?.[0];
    if (channel?.id && channel.snippet?.title && titleMatchScore(instructor.name, channel.snippet.title) > 0) {
      return { id: channel.id, title: channel.snippet.title };
    }
  }

  const search = await googleApi<{ items?: SearchItem[] }>("search", {
    part: "snippet",
    type: "channel",
    q: instructor.name,
    maxResults: "5",
  }, key);
  const ids = [...new Set((search.items ?? []).map((item) => item.id?.channelId).filter((id): id is string => Boolean(id)))];
  if (!ids.length) return null;

  const channels = await googleApi<{ items?: ChannelItem[] }>("channels", {
    part: "snippet",
    id: ids.join(","),
    maxResults: String(ids.length),
  }, key);
  const verified = (channels.items ?? [])
    .map((channel) => ({ id: channel.id, title: channel.snippet?.title ?? "", score: titleMatchScore(instructor.name, channel.snippet?.title ?? "") }))
    .filter((channel) => channel.title && channel.score > 0)
    .sort((first, second) => second.score - first.score)[0];
  return verified ? { id: verified.id, title: verified.title } : null;
}

async function getVideoDetails(ids: string[], key: string) {
  if (!ids.length) return [];
  const result = await googleApi<{ items?: VideoItem[] }>("videos", {
    part: "snippet,contentDetails",
    id: [...new Set(ids)].slice(0, 50).join(","),
    maxResults: "50",
  }, key);
  return result.items ?? [];
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = await request.json() as RequestBody;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (body.hobbyId !== "yoga" && body.hobbyId !== "pilates") {
    return Response.json({ error: "Choose Yoga or Pilates." }, { status: 400 });
  }
  const minutes = Number(body.minutes);
  if (!Number.isFinite(minutes) || minutes < 10 || minutes > 180) {
    return Response.json({ error: "Choose an available duration between 10 and 180 minutes." }, { status: 400 });
  }
  const timeContext = body.timeContext;
  if (!timeContext || !["morning", "daytime", "evening", "late-night"].includes(timeContext)) {
    return Response.json({ error: "Choose a valid local time context." }, { status: 400 });
  }
  if (body.videoPreference === "No" || (!body.videoPreference && !(body.savedVideos?.length || body.favoriteInstructors?.length))) {
    return Response.json({ configured: true, videos: [], resolvedInstructors: [] });
  }

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return Response.json({ configured: false, videos: [], resolvedInstructors: [] });

  const instructors = (body.favoriteInstructors ?? [])
    .filter((item) => typeof item.name === "string" && item.name.trim())
    .slice(0, maxInstructorCount);
  const savedLinks = (body.savedVideos ?? []).filter((item) => typeof item.url === "string").slice(0, 20);
  const useFavourites = body.videoPreference === "From favourites" || body.videoPreference === "Both" ||
    (!body.videoPreference && Boolean(body.favoriteInstructors?.length));
  const useDiscovery = body.videoPreference === "Discover new instructors" || body.videoPreference === "Both";

  try {
    const savedIds = savedLinks.map((item) => extractVideoId(item.url)).filter((id): id is string => Boolean(id));
    const [savedDetails, resolvedPairs] = await Promise.all([
      getVideoDetails(savedIds, key),
      useFavourites ? Promise.all(instructors.map(async (instructor) => ({ instructor, channel: await resolveInstructor(instructor, body.hobbyId!, key) }))) : Promise.resolve([]),
    ]);
    const resolved = resolvedPairs.filter((item) => item.channel !== null) as { instructor: ResourceLink; channel: { id: string; title: string } }[];
    const searches: Promise<{ source: "favourite" | "discovery"; channelTitle?: string; channelId?: string; items?: SearchItem[] }>[] = [];
    const contextQuery = timeContext === "morning"
      ? "morning energizing flow"
      : timeContext === "evening"
        ? "evening relaxing unwind flow"
        : timeContext === "late-night"
          ? "bedtime gentle wind down flow"
          : "beginner friendly practice";

    if (useFavourites) {
      for (const { channel } of resolved) {
        searches.push(googleApi<{ items?: SearchItem[] }>("search", {
          part: "snippet",
          type: "video",
          channelId: channel.id,
          q: `${body.hobbyId} ${contextQuery}`,
          maxResults: "8",
          videoEmbeddable: "true",
          videoSyndicated: "true",
          order: "relevance",
        }, key).then((result) => ({ source: "favourite" as const, channelTitle: channel.title, channelId: channel.id, items: result.items })));
      }
    }

    if (useDiscovery) {
      searches.push(googleApi<{ items?: SearchItem[] }>("search", {
        part: "snippet",
        type: "video",
        q: `${body.hobbyId} ${contextQuery}`,
        maxResults: "10",
        videoEmbeddable: "true",
        videoSyndicated: "true",
        order: "relevance",
      }, key).then((result) => ({ source: "discovery" as const, items: result.items })));
    }

    const searchResults = await Promise.all(searches);
    const searchCandidates = searchResults.flatMap((result) => (result.items ?? []).flatMap((item) => {
      const id = item.id?.videoId;
      if (!id) return [];
      return [{ id, source: result.source, expectedChannelTitle: result.channelTitle, expectedChannelId: result.channelId }];
    }));
    const details = await getVideoDetails(searchCandidates.map((item) => item.id), key);
    const savedVideos: YouTubeVideo[] = savedDetails.flatMap((item) => {
      const durationSeconds = durationInSeconds(item.contentDetails?.duration ?? "");
      if (!item.id || !item.snippet?.title || durationSeconds > minutes * 60) return [];
      return [{
        id: item.id,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle ?? "",
        channelId: item.snippet.channelId ?? "",
        thumbnailUrl: thumbnailUrl(item),
        url: `https://www.youtube.com/watch?v=${item.id}`,
        durationSeconds,
        source: "saved" as const,
      }];
    });
    const verifiedCandidates = details.flatMap((item) => {
      const candidate = searchCandidates.find((result) => result.id === item.id);
      const durationSeconds = durationInSeconds(item.contentDetails?.duration ?? "");
      if (!candidate || !item.snippet?.title || !item.snippet.channelId || durationSeconds <= 0 || durationSeconds > minutes * 60) return [];
      if (candidate.source === "favourite" && item.snippet.channelId !== candidate.expectedChannelId) return [];
      return [{
        id: item.id,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle ?? "",
        channelId: item.snippet.channelId,
        thumbnailUrl: thumbnailUrl(item),
        url: `https://www.youtube.com/watch?v=${item.id}`,
        durationSeconds,
        source: candidate.source,
      } satisfies YouTubeVideo];
    });
    const scores = (video: YouTubeVideo) =>
      (video.source === "saved" ? 100 : video.source === "favourite" ? 40 : 0) +
      contextScore(video.title, timeContext) -
      Math.abs(minutes * 60 - video.durationSeconds) / 300;
    const videos = [...savedVideos, ...verifiedCandidates]
      .sort((first, second) => scores(second) - scores(first))
      .filter((video, index, list) => list.findIndex((candidate) => candidate.id === video.id) === index)
      .slice(0, 8);

    return Response.json({
      configured: true,
      videos,
      resolvedInstructors: resolved.map(({ instructor, channel }) => ({ requested: instructor.name, verified: channel.title, channelId: channel.id })),
    });
  } catch {
    return Response.json({ configured: true, videos: [], resolvedInstructors: [], error: "YouTube discovery is temporarily unavailable." }, { status: 502 });
  }
}
