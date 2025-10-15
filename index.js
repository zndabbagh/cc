// index.js
const { addonBuilder } = require("stremio-addon-sdk");
const fillerSet = new Set(require("./filler.json"));

const EPISODE_COUNT = 1200; // hardcoded total episodes

const builder = new addonBuilder({
  id: "org.yourname.stremio.conan-filler",
  version: "1.0.4",
  name: "Case Closed (Detective Conan) — All Episodes (Filler Marked)",
  description: "All episodes, with filler marked in title. Crash-proof for Render.com",
  resources: ["catalog", "meta", "manifest"],
  types: ["tv"],
  idPrefixes: ["conan-ep-"]
});

// Catalog handler — all episodes, mark filler
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
    if (metas.length >= 1500) break; // limit for performance
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

// Start server immediately
const addonInterface = builder.getInterface();
const PORT = process.env.PORT || 7000;
require("http").createServer(addonInterface).listen(PORT, () => {
  console.log(`Addon running on port ${PORT}. Manifest at /manifest.json`);
});
