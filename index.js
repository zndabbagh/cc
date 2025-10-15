// index.js
const { addonBuilder } = require("stremio-addon-sdk");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

const MAL_OR_ANILIST_ID = 235; // AniList id for Detective Conan
const LIST_URL = "https://www.animefillerlist.com/shows/detective-conan";
const ANILIST_API = "https://graphql.anilist.co";

const builder = new addonBuilder({
  id: "org.yourname.stremio.conan-filler",
  version: "1.0.3",
  name: "Case Closed (Detective Conan) — All Episodes (Filler Marked)",
  description: "Marks filler episodes in the title. Crash-proof for cloud hosting.",
  resources: ["catalog", "meta", "manifest"],
  types: ["tv"],
  idPrefixes: ["conan-ep-"]
});

// In-memory cache
let cache = {
  episodeCount: 1200, // fallback if AniList fails
  fillerSet: new Set(),
  lastFetch: 0
};

// Safe fetch for AniList episode count (lazy)
async function fetchEpisodeCount() {
  try {
    if (cache.episodeCount && (Date.now() - cache.lastFetch < 10*60*1000)) return cache.episodeCount;

    const query = `
      query ($id: Int) {
        Media(id: $id, type: ANIME) {
          episodes
        }
      }`;

    const res = await fetch(ANILIST_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ query, variables: { id: MAL_OR_ANILIST_ID } })
    });

    const json = await res.json();
    const episodes = json?.data?.Media?.episodes;
    if (episodes) cache.episodeCount = episodes;
  } catch (err) {
    console.error("AniList fetch failed:", err);
  }
  cache.lastFetch = Date.now();
  return cache.episodeCount;
}

// Safe fetch for filler list (lazy)
async function fetchFillerSet() {
  try {
    if (cache.fillerSet.size > 0 && (Date.now() - cache.lastFetch < 10*60*1000)) return cache.fillerSet;

    const html = await fetch(LIST_URL).then(r => r.text());
    const $ = cheerio.load(html);
    let fillerText = "";

    $("h2, h3, h4, strong").each((i, el) => {
      const txt = $(el).text().trim().toLowerCase();
      if (txt.includes("filler")) {
        let sib = $(el).next();
        for (let j = 0; j < 10 && sib && sib.length; j++) {
          const tag = sib.get(0).tagName ? sib.get(0).tagName.toLowerCase() : "";
          if (tag.match(/^h[1-6]$/)) break;
          fillerText += $(sib).text() + "\n";
          sib = sib.next();
        }
      }
    });

    const fillerSet = new Set();
    const ranges = fillerText.match(/\d+(\s*-\s*\d+)?/g);
    if (ranges) ranges.forEach(r => {
      if (r.includes("-")) {
        const [a,b] = r.split("-").map(x => parseInt(x.trim(),10));
        for(let k=a;k<=b;k++) fillerSet.add(k);
      } else {
        const n = parseInt(r.trim(),10);
        if(!isNaN(n)) fillerSet.add(n);
      }
    });

