const { addonBuilder } = require("stremio-addon-sdk");
const fillerSet = new Set(require("./filler.json"));

const EPISODE_COUNT = 100; // limited to 100 for Render free tier

const builder = new addonBuilder({
  id: "org.yourname.stremio.conan-filler",
  version: "1.0.6",
  name: "Case Closed (Detective Conan) — 100 Episodes (Filler Marked)",
  description: "Limited to 100 episodes for free Render hosting. Filler episodes are marked.",
  resources: ["catalog", "meta", "manifest"],
  types: ["tv"],
  idPrefixes: ["conan-ep-"]
});

// Catalog handler
builder.defineCatalogHandler(async () => {
  const metas = [];
  for (let ep = 1; ep <= EPISODE_COUNT; ep++) {
    const isFiller = fillerSet.has(ep);
    metas.push({
      id: `conan-ep-${ep}`,
      type: "tv",
      name: isFiller ? `Episode ${ep} (FILLER)` : `Episode ${ep}`,
      poster: null,
      description: `Detective Conan — Episode ${ep} — ${isFiller ? "Filler" : "Canon"}.`,
      info: { episode: ep, season: 1 }
    });
  }
  return { metas };
});

// Meta handler
builder.defineMetaHandler(async (args) => {
  const match = args.id.match(/^conan-ep-(\d+)$/);
  if (!match) return { meta: null };
  const ep = parseInt(match[1], 10);
  const isFiller = fillerSet.has(ep);
  return {
    meta: {
      id: args.id,
      type: "tv",
      name: isFiller ? `Episode ${ep} (FILLER)` : `Episode ${ep}`,
      poster: null,
      description: `Detective Conan — Episode ${ep}. ${isFiller ? "Marked as FILLER" : "Canon / story episode"}.`,
      streams: [],
      extra: [
        { name: "Episode", value: String(ep) },
        { name: "IsFiller", value: String(isFiller) }
      ]
    }
  };
});

// Start server
const addonInterface = builder.getInterface();
const PORT = process.env.PORT || 7000;
require("http").createServer(addonInterface).listen(PORT, () => {
  console.log(`Addon running on port ${PORT}. Manifest at /manifest.json`);
});
