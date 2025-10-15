// index.js
const { addonBuilder } = require("stremio-addon-sdk");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

const AANIME_TITLE = "Detective Conan";
const MAL_OR_ANILIST_ID = 235; // AniList id for Meitantei Conan
const LIST_URL = "https://www.animefillerlist.com/shows/detective-conan";
const ANILIST_API = "https://graphql.anilist.co";

const builder = new addonBuilder({
  id: "org.yourname.stremio.conan-nonfiller",
  version: "1.0.1",
  name: "Case Closed (Detective Conan) — All Episodes (Filler Marked)",
  description: "Lists all Detective Conan episodes and marks filler episodes in the title.",
  resources: ["catalog", "meta", "manifest"],
  types: ["tv"],
  idPrefixes: ["conan-ep-"]
});

// Simple in-memory cache
let cache = {
  episodeCount: null,
  fillerSet: null,
  lastFetch: 0
};

// helper: fetch episode count from AniList (Media id)
async function fetchEpisodeCount() {
  // cache for 10 minutes
  if (cache.episodeCount && (Date.now() - cache.lastFetch) < 10 * 60 * 1000) return cache.episodeCount;

  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id
        title { romaji english native }
        episodes
        status
      }
    }`;

  const res = await fetch(ANILIST_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({ query, variables: { id: MAL_OR_ANILIST_ID } })
  });

  const json = await res.json();
  const episodes = json && json.data && json.data.Media && json.data.Media.episodes ? json.data.Media.episodes : null;

  cache.episodeCount = episodes || 1200; // fallback large number
  cache.lastFetch = Date.now();
  return cache.episodeCount;
}

// helper: parse AnimeFillerList page for filler episodes
async function fetchFillerSet() {
  // cache for 10 minutes
  if (cache.fillerSet && (Date.now() - cache.lastFetch) < 10 * 60 * 1000) return cache.fillerSet;

  const html = await fetch(LIST_URL).then(r => r.text());
  const $ = cheerio.load(html);

  let fillerText = "";
  $("h2, h3, h4, strong").each((i, el) => {
    const txt = $(el).text().trim().toLowerCase();
    if (txt.includes("filler")) {
      let sib = $(el).next();
      let collected = "";
      for (let j = 0; j < 10 && sib && sib.length; j++) {
        const tag = sib.get(0).tagName ? sib.get(0).tagName.toLowerCase() : "";
        if (tag.match(/^h[1-6]$/)) break;
        collected += $(sib).text() + "\n";
        sib = sib.next();
      }
      fillerText += collected + "\n";
    }
  });

  if (!fillerText) {
    $("li, p, td").each((i, el) => {
      const t = $(el).text().trim();
      if (/filler/i.test(t)) fillerText += t + "\n";
    });
  }

  const fillerSet = new Set();
  const ranges = fillerText.match(/\d+(\s*-\s*\d+)?/g);
  if (ranges) {
    ranges.forEach(r => {
      if (r.includes("-")) {
        const [a, b] = r.split("-").map(x => parseInt(x.trim(), 10));
        if (!isNaN(a) && !isNaN(b)) {
          for (let k = a; k <= b; k++) fillerSet.add(k);
        }
      } else {
        const n = parseInt(r.trim(), 10);
        if (!isNaN(n)) fillerSet.add(n);
      }
    });
  }

  cache.fillerSet = fillerSet;
  cache.lastFetch = Date.now();
  return fillerSet;
}

// Catalog handler - ALL episodes, mark filler in title
builder.defineCatalogHandler(async () => {
  try {
    const episodeCount = await fetchEpisodeCount();
    const fillerSet = await fetchFillerSet();

    const metas = [];
    for (let ep = 1; ep <= episodeCount; ep++) {
      const isFiller = fillerSet.has(ep);

      metas.push({
        id: `conan-ep-${ep}`,
        type: "tv",
        name: isFiller ? `Episode ${ep} (FILLER)` : `Episode ${ep}`,
        poster: null,
        posterShape: "landscape",
        releaseInfo: "JP",
        description: `Detective Conan — Episode ${ep} — ${isFiller ? "Filler" : "Canon"}.`,
        info: { episode: ep, season: 1 }
      });

      if (metas.length >= 1500) break;
    }

    return { metas };
  } catch (err) {
    console.error("Catalog error:", err);
    return { metas: [] };
  }
});

// Meta handler
builder.defineMetaHandler(async (args) => {
  try {
    const id = args.id;
    const match = id.match(/^conan-ep-(\d+)$/);
    if (!match) return { meta: null };

    const ep = parseInt(match[1], 10);
    const fillerSet = await fetchFillerSet();
    const isFiller = fillerSet.has(ep);

    const meta = {
      id,
      type: "tv",
      name: isFiller ? `Episode ${ep} (FILLER)` : `Episode ${ep}`,
      poster: null,
      description: `Detective Conan — Episode ${ep}. ${isFiller ? "Marked as FILLER" : "Canon / story episode"}.`,
      streams: [],
      extra: [
        { name: "Episode", value: String(ep) },
        { name: "IsFiller", value: String(isFiller) }
      ]
    };

    return { meta };
  } catch (err) {
    console.error("Meta error:", err);
    return { meta: null };
  }
});

const addonInterface = builder.getInterface();
const PORT = process.env.PORT || 7000;
require("http").createServer(addonInterface).listen(PORT, () => {
  console.log(`Addon running on http://localhost:${PORT}/manifest.json`);
});
