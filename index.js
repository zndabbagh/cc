// index.js
const { addonBuilder } = require("stremio-addon-sdk");
const fillerSet = new Set(require("./filler.json"));

const EPISODE_COUNT = 1200; // total episodes
const PER_PAGE = 100; // number of episodes per catalog page

const builder = new addonBuilder({
  id: "org.yourname.stremio.conan-filler",
  version: "1.0.5",
  name: "Case Closed (Detective Conan) — All Episodes (Filler Marked)",
  description: "All episodes with filler marked. Pagination included for fast loading.",
  resources: ["catalog", "meta", "manifest"],
  types: ["tv"],
  idPrefixes: ["conan-ep-"]
});

// Catalog handler with pagination
builder.defineCatalogHandler(async (args) => {
  // Determine page number
  const page = args.extra?.page ? parseInt(args.extra.page, 10) : 1;
  const start = (page - 1) * PER_PAGE + 1;
  const end = Math.min(start + PER_PAGE - 1, EPISODE_COUNT);

  const metas = [];
  for (let ep = start; ep <= end; ep++) {
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
