#!/usr/bin/env node
"use strict";

/**
 * Build the static site (site/index.html + site/feed.xml) from data/repos.json.
 *
 * Usage:
 *   node scripts/build-site.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA_FILE = path.join(ROOT, "data", "repos.json");
const SITE_DIR = path.join(ROOT, "site");
const OUT_FILE = path.join(SITE_DIR, "index.html");

// ---- Site Branding Config ----
const SITE_TITLE = "Handhelds Repo Directory";
const SITE_TAGLINE = "Custom firmware, decomps, recomps, ports & device tools — updated daily.";
const SITE_URL = "https://admyrick.github.io/hhwtf-tests/"; // must end with /
const ACTIONS_URL = "https://github.com/admyrick/hhwtf-tests/actions";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

async function main() {
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`Missing ${DATA_FILE}. Run "node scripts/find-repos.js" first.`);
    process.exit(1);
  }

  let repos = [];
  try {
    repos = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    if (!Array.isArray(repos)) repos = [];
  } catch (err) {
    console.error(`Could not parse ${DATA_FILE}: ${err.message}`);
    process.exit(1);
  }

  const now = Date.now();
  const isFresh = (r) => {
    const ts = r.pushed_at || (r.release && r.release.published_at) || r.created_at;
    return ts && now - new Date(ts).getTime() < WEEK_MS;
  };
  const freshCount = repos.filter(isFresh).length;
  const curatedCount = repos.filter((r) => r.source && r.source !== "search").length;

  const data = {
    generated_at: new Date().toISOString(),
    total: repos.length,
    fresh: freshCount,
    curated: curatedCount,
    repos,
  };

  fs.mkdirSync(SITE_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, render(data));
  fs.writeFileSync(path.join(SITE_DIR, "feed.xml"), renderFeed(data));
  console.log(`Built ${OUT_FILE} + feed.xml (${repos.length} repos, ${freshCount} active this week)`);
}

function renderFeed(data) {
  const escapeXml = (s) =>
    String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const items = data.repos
    .filter((r) => r.added_at)
    .sort((a, b) => (b.added_at || "").localeCompare(a.added_at || ""))
    .slice(0, 30)
    .map((r) => {
      const title = r.full_name || r.html_url || "";
      const link = r.html_url || SITE_URL;
      const updated = r.pushed_at || r.added_at;
      const desc = escapeXml(r.description || "").slice(0, 300);
      return `    <entry>
      <title>${escapeXml(title)}</title>
      <link href="${escapeXml(link)}"/>
      <id>${escapeXml(link)}</id>
      <updated>${new Date(updated).toISOString()}</updated>
      <summary>${desc}</summary>
    </entry>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(SITE_TITLE)} — New Repos</title>
  <link href="${SITE_URL}"/>
  <link href="${SITE_URL}feed.xml" rel="self"/>
  <updated>${new Date(data.generated_at).toISOString()}</updated>
  <id>${SITE_URL}</id>
  <subtitle>${escapeXml(SITE_TAGLINE)}</subtitle>
${items}
</feed>
`;
}

function render(data) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${SITE_TITLE} — ${data.total} projects</title>
<meta name="description" content="${SITE_TAGLINE}">
<meta name="theme-color" content="#f97316">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE_TITLE}">
<meta property="og:title" content="${SITE_TITLE}">
<meta property="og:description" content="${SITE_TAGLINE}">
<meta property="og:url" content="${SITE_URL}">
<style>
  :root {
    --bg: #0b0f14;
    --bg-soft: #10151c;
    --card: #151b24;
    --card-hover: #1a222e;
    --border: #232d3a;
    --text: #e6edf3;
    --muted: #8b98a5;
    --accent: #f97316;
    --accent-2: #fb923c;
    --accent-3: #ea580c;
    --new: #3fb950;
    --archived: #6e7681;
    --radius: 14px;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { color-scheme: dark; }
  body {
    display: flex; flex-direction: column; min-height: 100vh;
    background:
      radial-gradient(1000px 500px at 85% -10%, rgba(249, 115, 22, .12), transparent 60%),
      radial-gradient(900px 500px at -10% 0%, rgba(234, 88, 12, .08), transparent 55%),
      var(--bg);
    color: var(--text);
    font-family: "Segoe UI", system-ui, -apple-system, Roboto, sans-serif;
  }
  header { padding: 52px 24px 36px; text-align: center; }
  .logo { font-size: 38px; font-weight: 800; letter-spacing: -.5px; }
  .logo .grad { background: linear-gradient(90deg, var(--accent), var(--accent-2)); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .tagline { color: var(--muted); margin-top: 10px; font-size: 16px; }
  .stats { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 22px; }
  .stat { background: var(--card); border: 1px solid var(--border); border-radius: 999px; padding: 8px 18px; font-size: 14px; color: var(--muted); }
  .stat b { color: var(--text); font-weight: 700; }

  .toolbar {
    position: sticky; top: 0; z-index: 10;
    display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
    max-width: 1240px; width: 100%; margin: 0 auto 28px; padding: 12px 24px;
    background: rgba(11, 15, 20, .88); backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
  }
  .search-wrap { position: relative; flex: 1 1 200px; min-width: 160px; }
  .search-wrap svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); opacity: .5; }
  #search {
    width: 100%; background: var(--card); color: var(--text);
    border: 1px solid var(--border); border-radius: 10px;
    padding: 10px 14px 10px 38px; font-size: 14.5px; outline: none;
  }
  #search:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(249, 115, 22, .18); }
  select {
    background: var(--card); color: var(--text);
    border: 1px solid var(--border); border-radius: 10px;
    padding: 9px 10px; font-size: 13.5px; outline: none; cursor: pointer;
  }
  .check {
    display: inline-flex; align-items: center; white-space: nowrap;
    color: var(--muted); font-size: 13px; font-weight: 600;
    cursor: pointer; user-select: none; padding: 9px 13px;
    background: var(--card); border: 1px solid var(--border); border-radius: 10px;
  }
  .check:has(input:checked) {
    background: linear-gradient(135deg, var(--accent), var(--accent-3));
    color: #fff; border-color: transparent;
  }
  .check input { position: absolute; opacity: 0; pointer-events: none; }
  #count { margin-left: auto; color: var(--muted); font-size: 13px; white-space: nowrap; }

  main { flex: 1; max-width: 1240px; margin: 0 auto; padding: 0 24px 60px; width: 100%; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); gap: 16px; }
  .card {
    background: var(--card); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 18px; display: flex; flex-direction: column; gap: 12px; cursor: pointer;
    transition: transform .15s ease, border-color .15s ease, background .15s ease;
  }
  .card:hover { transform: translateY(-3px); border-color: #33414f; background: var(--card-hover); }
  .card-top { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .avatar { width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0; background: var(--bg-soft); border: 1px solid var(--border); }
  .card-name { min-width: 0; }
  .card-name a { color: var(--text); text-decoration: none; font-weight: 700; font-size: 15px; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .card-name a:hover { color: var(--accent); }
  .card-owner { color: var(--muted); font-size: 12.5px; }
  .fav-btn { margin-left: auto; align-self: flex-start; border: 0; background: transparent; color: var(--muted); font-size: 18px; cursor: pointer; padding: 2px 4px; }
  .fav-btn.on, .fav-btn:hover { color: #e5484d; }
  .desc { color: #b6c2cf; font-size: 13.5px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; min-height: 61px; }
  .desc:empty::before { content: "No description provided."; color: var(--archived); }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .tag { font-size: 11.5px; padding: 3px 9px; border-radius: 999px; background: var(--bg-soft); color: var(--muted); border: 1px solid var(--border); }
  .tag.hw { background: rgba(249, 115, 22, .12); color: var(--accent-2); border-color: rgba(249, 115, 22, .3); font-weight: 600; }
  .card-foot { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; font-size: 12.5px; color: var(--muted); border-top: 1px solid var(--border); padding-top: 12px; margin-top: auto; }
  .stars { color: var(--text); font-weight: 700; }
  .star-icon { color: #e8b339; }
  .lang { display: inline-flex; align-items: center; gap: 5px; }
  .lang-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--dot, #8b98a5); }
  .updated { margin-left: auto; }
  .badges { display: flex; gap: 6px; flex-wrap: wrap; }
  .badge { font-size: 10.5px; font-weight: 700; padding: 3px 8px; border-radius: 6px; text-transform: uppercase; }
  .badge.cat { background: rgba(56, 189, 248, .12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, .3); }
  .badge.new { background: rgba(63, 185, 80, .15); color: var(--new); border: 1px solid rgba(63, 185, 80, .35); }
  .badge.archived { background: rgba(110, 118, 129, .15); color: var(--archived); border: 1px solid rgba(110, 118, 129, .35); }
  .dl-row { display: flex; gap: 8px; }
  .release-chip {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px; width: 100%;
    font-size: 12.5px; font-weight: 700; color: #fff; background: var(--accent);
    border: 1px solid var(--accent); padding: 8px 12px; border-radius: 8px; text-decoration: none;
  }
  .release-chip:hover { background: var(--accent-3); border-color: var(--accent-3); }
  .release-chip.ghost { background: transparent; color: var(--muted); border-color: var(--border); font-weight: 500; }
  .release-chip.ghost:hover { color: var(--text); border-color: var(--accent); }
  .pager { display: flex; justify-content: center; gap: 10px; margin: 28px auto; }
  .load-more { padding: 12px 30px; background: var(--card); color: var(--text); border: 1px solid var(--border); border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; }
  .load-more:hover { border-color: var(--accent); }
  .empty { text-align: center; color: var(--muted); padding: 60px 0; font-size: 15px; }
  .hidden { display: none; }

  footer { position: sticky; bottom: 0; background: rgba(11, 15, 20, .88); backdrop-filter: blur(12px); border-top: 1px solid var(--border); }
  .footer-inner { max-width: 1240px; margin: 0 auto; display: flex; align-items: center; justify-content: center; gap: 12px; padding: 10px 24px; color: var(--muted); font-size: 12.5px; }
  .footer-inner a { color: var(--accent-2); text-decoration: none; }
  .feed-link { border: 1px solid var(--border); border-radius: 6px; padding: 2px 8px; font-weight: 700; }

  .modal { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 20px; }
  .modal-backdrop { position: absolute; inset: 0; background: rgba(4, 6, 10, .75); backdrop-filter: blur(3px); }
  .modal-card { position: relative; width: min(760px, 100%); max-height: 86vh; background: var(--card); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; }
  .modal-close { position: absolute; top: 12px; right: 12px; z-index: 2; border: 0; background: rgba(255, 255, 255, .08); color: var(--text); width: 34px; height: 34px; border-radius: 50%; font-size: 20px; cursor: pointer; }
  #modal-body { overflow-y: auto; padding: 26px 28px 30px; }
  .m-head { display: flex; gap: 14px; align-items: flex-start; padding-right: 40px; }
  .m-head img { width: 52px; height: 52px; border-radius: 12px; }
  .m-title { font-size: 20px; font-weight: 800; }
  .m-title a { color: var(--accent-2); text-decoration: none; }
  .m-sub { color: var(--muted); font-size: 13px; margin-top: 4px; }
  .m-desc { font-size: 14px; line-height: 1.6; margin: 14px 0; }
  .m-meta { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
  .m-chip { background: var(--bg-soft); border: 1px solid var(--border); border-radius: 8px; padding: 5px 10px; font-size: 12.5px; color: var(--muted); }
  .m-chip b { color: var(--text); }
  .m-assets { margin: 16px 0; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
  .m-assets-head { background: var(--bg-soft); padding: 8px 12px; font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--muted); }
  .m-asset-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 12px; border-top: 1px solid var(--border); font-size: 13px; }
  .m-asset-row a { color: var(--accent-2); text-decoration: none; font-weight: 600; word-break: break-all; }
  .m-asset-row a:hover { text-decoration: underline; }
  .m-asset-meta { color: var(--muted); font-size: 11.5px; white-space: nowrap; }
  .m-actions { display: flex; flex-wrap: wrap; gap: 10px; margin: 14px 0; }
  .m-actions a { padding: 9px 16px; border-radius: 10px; text-decoration: none; font-size: 13.5px; font-weight: 600; background: var(--accent); color: #fff; }
  .m-actions a.ghost { background: transparent; border: 1px solid var(--border); color: var(--muted); }
  .m-readme { margin-top: 18px; border-top: 1px solid var(--border); padding-top: 16px; }
  .m-readme h3 { font-size: 12.5px; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; }
  .m-readme .md { font-size: 14px; line-height: 1.65; }
  .m-readme .md a { color: var(--accent-2); }
  .m-readme .md img { max-width: 100%; border-radius: 8px; }
  .m-readme .md pre { background: var(--bg-soft); border: 1px solid var(--border); border-radius: 8px; padding: 12px; overflow-x: auto; margin: 10px 0; }
  .m-readme .md code { background: var(--bg-soft); padding: 1px 5px; border-radius: 4px; font-size: 12.5px; }
  .m-readme .md pre code { background: none; padding: 0; }
</style>
</head>
<body>
<header id="top">
  <div class="logo"><span class="grad">${SITE_TITLE}</span></div>
  <p class="tagline">${SITE_TAGLINE}</p>
  <div class="stats">
    <span class="stat"><b id="stat-total">0</b> repos</span>
    <span class="stat"><b id="stat-new">0</b> active this week</span>
    <span class="stat">Updated <b id="stat-updated">—</b></span>
  </div>
</header>

<div class="toolbar">
  <div class="search-wrap">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
    <input id="search" type="search" placeholder="Search CFW, decomps, devices, chipsets…" autocomplete="off">
  </div>
  <select id="sort" aria-label="Sort order">
    <option value="updated">Sort: Recently updated</option>
    <option value="stars">Sort: Most stars</option>
    <option value="released">Sort: Latest release</option>
    <option value="added">Sort: Newest added</option>
    <option value="name">Sort: Name A–Z</option>
  </select>
  <select id="category-filter" aria-label="Category filter">
    <option value="all">All categories</option>
  </select>
  <select id="device-filter" aria-label="Device or chipset filter">
    <option value="all">All devices / chipsets</option>
  </select>
  <select id="recency-filter" aria-label="Recency filter">
    <option value="all">Updated: Any time</option>
    <option value="7">Last 7 days</option>
    <option value="30">Last 30 days</option>
    <option value="90">Last 90 days</option>
  </select>
  <label class="check" title="Only show repos with downloadable release assets">
    <input id="dl-only" type="checkbox"> Has downloads
  </label>
  <label class="check" title="Show only starred favorites">
    <input id="fav-only" type="checkbox"> Favorites
  </label>
  <span id="count"></span>
</div>

<main>
  <div id="grid" class="grid"></div>
  <div id="pager" class="pager hidden">
    <button id="load-more" class="load-more">Show more</button>
    <button id="load-all" class="load-more">Load all</button>
  </div>
  <p id="empty" class="empty hidden">No repos match your filters.</p>
</main>

<footer>
  <div class="footer-inner">
    <span>Built with <a href="${ACTIONS_URL}" target="_blank" rel="noopener"><b>GitHub Actions</b></a> on <span id="gen-date"></span></span>
    <a class="feed-link" href="feed.xml" target="_blank" rel="noopener">RSS</a>
  </div>
</footer>

<div id="modal" class="modal hidden" role="dialog" aria-modal="true">
  <div class="modal-backdrop" data-close></div>
  <div class="modal-card">
    <button class="modal-close" data-close aria-label="Close">&#215;</button>
    <div id="modal-body"></div>
  </div>
</div>

<script id="repo-data" type="application/json">${json}</script>
<script>
(function () {
  const DATA = JSON.parse(document.getElementById("repo-data").textContent);
  const LANG_COLORS = {
    C: "#555555", "C++": "#f34b7d", Rust: "#dea584", Python: "#3572A5",
    Shell: "#89e051", Makefile: "#427819", Kotlin: "#a97bff", Java: "#b07219",
    JavaScript: "#f1e05a", TypeScript: "#3178c6", Go: "#00ADD8", "C#": "#178600",
    Lua: "#000080", Assembly: "#6E4C13", CMake: "#DA3434"
  };
  const fmt = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
  const fmtFull = new Intl.NumberFormat("en");

  const el = {
    grid: document.getElementById("grid"),
    empty: document.getElementById("empty"),
    count: document.getElementById("count"),
    search: document.getElementById("search"),
    sort: document.getElementById("sort"),
    category: document.getElementById("category-filter"),
    device: document.getElementById("device-filter"),
    recency: document.getElementById("recency-filter"),
    dlOnly: document.getElementById("dl-only"),
    favOnly: document.getElementById("fav-only"),
    pager: document.getElementById("pager"),
    loadMore: document.getElementById("load-more"),
    loadAll: document.getElementById("load-all"),
  };

  const PAGE_SIZE = 60;
  let shown = PAGE_SIZE;

  // Populate category & device/chipset dropdowns
  const cats = [...new Set(DATA.repos.map((r) => r.category || "Miscellaneous"))].sort();
  cats.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c; opt.textContent = c;
    el.category.appendChild(opt);
  });

  const hwSet = new Set();
  DATA.repos.forEach((r) => {
    (r.devices || []).forEach((d) => hwSet.add(d));
    (r.chipsets || []).forEach((c) => hwSet.add(c));
  });
  [...hwSet].sort().forEach((hw) => {
    const opt = document.createElement("option");
    opt.value = hw; opt.textContent = hw;
    el.device.appendChild(opt);
  });

  // URL state
  const params = new URLSearchParams(location.search);
  if (params.has("q")) el.search.value = params.get("q");
  if (params.has("cat")) el.category.value = params.get("cat");
  if (params.has("hw")) el.device.value = params.get("hw");
  if (params.has("sort")) el.sort.value = params.get("sort");
  if (params.has("rec")) el.recency.value = params.get("rec");
  if (params.get("dl") === "1") el.dlOnly.checked = true;
  if (params.get("fav") === "1") el.favOnly.checked = true;

  document.getElementById("stat-total").textContent = fmtFull.format(DATA.total);
  document.getElementById("stat-new").textContent = fmtFull.format(DATA.fresh);
  const genStr = new Date(DATA.generated_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  document.getElementById("stat-updated").textContent = genStr;
  document.getElementById("gen-date").textContent = genStr;

  const FAV_KEY = "hh-dir-favs";
  let favorites = new Set();
  try { favorites = new Set(JSON.parse(localStorage.getItem(FAV_KEY) || "[]")); } catch {}
  const saveFavs = () => { try { localStorage.setItem(FAV_KEY, JSON.stringify([...favorites])); } catch {} };

  function timeAgo(iso) {
    if (!iso) return "";
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    if (s < 2592000) return Math.floor(s / 86400) + "d ago";
    if (s < 31536000) return Math.floor(s / 2592000) + "mo ago";
    return Math.floor(s / 31536000) + "y ago";
  }

  function formatBytes(bytes) {
    if (!bytes) return "";
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? mb.toFixed(1) + " MB" : Math.round(bytes / 1024) + " KB";
  }

  function lastActivity(r) {
    return r.pushed_at || (r.release && r.release.published_at) || r.created_at;
  }

  function card(repo) {
    const c = document.createElement("article");
    c.className = "card";

    const top = document.createElement("div");
    top.className = "card-top";
    if (repo.owner && repo.owner.avatar_url) {
      const img = document.createElement("img");
      img.className = "avatar"; img.src = repo.owner.avatar_url; img.alt = ""; img.loading = "lazy";
      top.append(img);
    }
    const names = document.createElement("div");
    names.className = "card-name";
    const a = document.createElement("a");
    a.href = repo.html_url || "#"; a.target = "_blank"; a.rel = "noopener";
    a.textContent = repo.full_name;
    const owner = document.createElement("div");
    owner.className = "card-owner";
    owner.textContent = (repo.owner ? "@" + repo.owner.login : "") + (repo.release?.tag ? " · " + repo.release.tag : "");
    names.append(a, owner);

    const favBtn = document.createElement("button");
    favBtn.className = "fav-btn" + (favorites.has(repo.full_name) ? " on" : "");
    favBtn.textContent = "♥";
    favBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (favorites.has(repo.full_name)) favorites.delete(repo.full_name);
      else favorites.add(repo.full_name);
      saveFavs();
      render();
    });
    top.append(names, favBtn);
    c.append(top);

    const desc = document.createElement("p");
    desc.className = "desc";
    desc.textContent = repo.description || "";
    c.append(desc);

    // Hardware & topic tags
    const hwTags = [...(repo.devices || []), ...(repo.chipsets || [])];
    const topics = (repo.topics || []).slice(0, 3);
    if (hwTags.length || topics.length) {
      const tagsEl = document.createElement("div");
      tagsEl.className = "tags";
      hwTags.slice(0, 4).forEach((hw) => {
        const s = document.createElement("span");
        s.className = "tag hw"; s.textContent = hw;
        tagsEl.append(s);
      });
      topics.forEach((t) => {
        const s = document.createElement("span");
        s.className = "tag"; s.textContent = t;
        tagsEl.append(s);
      });
      c.append(tagsEl);
    }

    const foot = document.createElement("div");
    foot.className = "card-foot";
    if (typeof repo.stargazers_count === "number") {
      const stars = document.createElement("span");
      stars.className = "stars";
      stars.innerHTML = '<span class="star-icon">★</span> ' + fmt.format(repo.stargazers_count);
      foot.append(stars);
    }
    if (repo.language) {
      const lang = document.createElement("span");
      lang.className = "lang";
      lang.innerHTML = '<span class="lang-dot" style="--dot:' + (LANG_COLORS[repo.language] || "#8b98a5") + '"></span>' + repo.language;
      foot.append(lang);
    }
    const badges = document.createElement("span");
    badges.className = "badges";
    if (repo.category) {
      const b = document.createElement("span");
      b.className = "badge cat"; b.textContent = repo.category;
      badges.append(b);
    }
    const act = lastActivity(repo);
    if (act && Date.now() - new Date(act).getTime() < 7 * 86400000) {
      const b = document.createElement("span");
      b.className = "badge new"; b.textContent = "Active";
      badges.append(b);
    }
    if (repo.archived) {
      const b = document.createElement("span");
      b.className = "badge archived"; b.textContent = "Archived";
      badges.append(b);
    }
    foot.append(badges);
    if (act) {
      const u = document.createElement("span");
      u.className = "updated"; u.textContent = timeAgo(act);
      foot.append(u);
    }
    c.append(foot);

    // Download / Release row
    const assets = (repo.release && repo.release.assets) || [];
    const dlRow = document.createElement("div");
    dlRow.className = "dl-row";
    if (assets.length === 1) {
      const dl = document.createElement("a");
      dl.className = "release-chip"; dl.href = assets[0].url; dl.target = "_blank"; dl.rel = "noopener";
      dl.textContent = "⬇ Download " + (repo.release.tag || "");
      dlRow.append(dl);
    } else if (assets.length > 1) {
      const dl = document.createElement("a");
      dl.className = "release-chip"; dl.href = "#";
      dl.textContent = "⬇ " + assets.length + " Downloads (" + (repo.release.tag || "latest") + ")";
      dl.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); openModal(repo); });
      dlRow.append(dl);
    } else if (repo.release && repo.release.html_url) {
      const dl = document.createElement("a");
      dl.className = "release-chip"; dl.href = repo.release.html_url; dl.target = "_blank"; dl.rel = "noopener";
      dl.textContent = "View Release " + (repo.release.tag || "");
      dlRow.append(dl);
    }
    const gh = document.createElement("a");
    gh.className = "release-chip ghost"; gh.href = repo.homepage || repo.html_url; gh.target = "_blank"; gh.rel = "noopener";
    gh.textContent = repo.homepage ? "Homepage" : "GitHub";
    dlRow.append(gh);
    c.append(dlRow);

    c.addEventListener("click", (e) => {
      if (e.target.closest("a, button")) return;
      openModal(repo);
    });
    return c;
  }

  const modalEl = document.getElementById("modal");
  const modalBody = document.getElementById("modal-body");

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function mdToHtml(md, repoFull) {
    const rawBase = repoFull && repoFull.includes("/")
      ? "https://raw.githubusercontent.com/" + repoFull + "/HEAD/" : "";
    const resolveUrl = (u) => /^(https?:|data:image|#)/i.test(u) ? u : rawBase + String(u).replace(/^\\.?\\//, "");
    const TICK3 = String.fromCharCode(96).repeat(3);
    const TICK1 = String.fromCharCode(96);
    const fence = new RegExp(TICK3 + "([^" + TICK1 + "]*?)" + TICK3, "gs");
    const inline = new RegExp(TICK1 + "([^" + TICK1 + "]+)" + TICK1, "g");
    return escapeHtml(md)
      .replace(fence, (m, code) => "<pre><code>" + code.trim() + "</code></pre>")
      .replace(inline, "<code>$1</code>")
      .replace(/^### (.*)$/gm, "<h3>$1</h3>")
      .replace(/^## (.*)$/gm, "<h2>$1</h2>")
      .replace(/^# (.*)$/gm, "<h1>$1</h1>")
      .replace(/\\*\\*([^*]+)\\*\\*/g, "<b>$1</b>")
      .replace(/!\\[([^\\]]*)\\]\\(([^)\\s]+)\\)/g, (m, alt, u) => '<img src="' + resolveUrl(u) + '" alt="' + alt + '" loading="lazy">')
      .replace(/\\[([^\\]]+)\\]\\(([^)\\s]+)\\)/g, (m, t, u) => /^https?:\\/\\//i.test(u) ? '<a href="' + u + '" target="_blank" rel="noopener">' + t + "</a>" : t)
      .replace(/\\n{2,}/g, "<br><br>");
  }

  function openModal(repo) {
    const release = repo.release || {};
    const assets = release.assets || [];
    modalBody.innerHTML = "";

    const head = document.createElement("div");
    head.className = "m-head";
    if (repo.owner?.avatar_url) {
      const img = document.createElement("img"); img.src = repo.owner.avatar_url; head.append(img);
    }
    head.insertAdjacentHTML("beforeend",
      '<div><div class="m-title"><a href="' + escapeHtml(repo.html_url) + '" target="_blank" rel="noopener">' + escapeHtml(repo.full_name) + '</a></div>' +
      '<div class="m-sub">' + escapeHtml([repo.category, repo.language, repo.source].filter(Boolean).join(" · ")) + '</div></div>'
    );
    modalBody.append(head);

    if (repo.description) {
      const d = document.createElement("p"); d.className = "m-desc"; d.textContent = repo.description;
      modalBody.append(d);
    }

    const meta = document.createElement("div");
    meta.className = "m-meta";
    meta.innerHTML =
      '<span class="m-chip">★ <b>' + fmt.format(repo.stargazers_count || 0) + '</b></span>' +
      (release.tag ? '<span class="m-chip">Release <b>' + escapeHtml(release.tag) + '</b></span>' : '') +
      (repo.devices || []).map((d) => '<span class="m-chip">Device: <b>' + escapeHtml(d) + '</b></span>').join("") +
      (repo.chipsets || []).map((c) => '<span class="m-chip">SoC: <b>' + escapeHtml(c) + '</b></span>').join("");
    modalBody.append(meta);

    if (assets.length) {
      const box = document.createElement("div");
      box.className = "m-assets";
      box.innerHTML = '<div class="m-assets-head">Release Assets (' + assets.length + ')</div>' +
        assets.map((a) =>
          '<div class="m-asset-row"><a href="' + escapeHtml(a.url) + '" target="_blank" rel="noopener">' + escapeHtml(a.name) + '</a>' +
          '<span class="m-asset-meta">' + escapeHtml([(a.targets || []).join(", "), formatBytes(a.size)].filter(Boolean).join(" · ")) + '</span></div>'
        ).join("");
      modalBody.append(box);
    }

    const actions = document.createElement("div");
    actions.className = "m-actions";
    if (release.html_url) actions.innerHTML += '<a href="' + escapeHtml(release.html_url) + '" target="_blank" rel="noopener">All Releases</a>';
    actions.innerHTML += '<a class="ghost" href="' + escapeHtml(repo.html_url) + '" target="_blank" rel="noopener">View on GitHub</a>';
    if (repo.homepage) actions.innerHTML += '<a class="ghost" href="' + escapeHtml(repo.homepage) + '" target="_blank" rel="noopener">Homepage</a>';
    modalBody.append(actions);

    const rd = document.createElement("div");
    rd.className = "m-readme";
    rd.innerHTML = "<h3>README</h3><p style='color:var(--muted)'>Loading…</p>";
    modalBody.append(rd);
    if (repo.full_name.includes("/")) {
      fetch("https://raw.githubusercontent.com/" + repo.full_name + "/HEAD/README.md")
        .then((r) => (r.ok ? r.text() : Promise.reject()))
        .then((md) => { rd.innerHTML = '<h3>README</h3><div class="md">' + mdToHtml(md, repo.full_name) + '</div>'; })
        .catch(() => { rd.innerHTML = "<h3>README</h3><p style='color:var(--muted)'>README not available.</p>"; });
    }

    modalEl.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modalEl.classList.add("hidden");
    document.body.style.overflow = "";
  }
  modalEl.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  function visible(repos) {
    const q = el.search.value.trim().toLowerCase();
    const cat = el.category.value;
    const hw = el.device.value;
    const rec = parseInt(el.recency.value, 10) || 0;

    let list = repos.filter((r) => {
      if (cat !== "all" && (r.category || "Miscellaneous") !== cat) return false;
      if (hw !== "all" && !(r.devices || []).includes(hw) && !(r.chipsets || []).includes(hw)) return false;
      if (el.dlOnly.checked && !(r.release && r.release.assets && r.release.assets.length)) return false;
      if (el.favOnly.checked && !favorites.has(r.full_name)) return false;
      if (rec) {
        const ts = lastActivity(r);
        if (!ts || Date.now() - new Date(ts).getTime() > rec * 86400000) return false;
      }
      if (!q) return true;
      return [
        r.full_name, r.description, r.language, r.category,
        ...(r.topics || []), ...(r.devices || []), ...(r.chipsets || [])
      ].join(" ").toLowerCase().includes(q);
    });

    const sortBy = el.sort.value;
    return list.sort((a, b) => {
      if (sortBy === "name") return a.full_name.localeCompare(b.full_name);
      if (sortBy === "updated") return (lastActivity(b) || "").localeCompare(lastActivity(a) || "");
      if (sortBy === "released") return (b.release?.published_at || "").localeCompare(a.release?.published_at || "");
      if (sortBy === "added") return (b.added_at || "").localeCompare(a.added_at || "");
      return (b.stargazers_count || 0) - (a.stargazers_count || 0);
    });
  }

  function render() {
    const list = visible(DATA.repos);
    el.grid.replaceChildren(...list.slice(0, shown).map(card));
    el.empty.classList.toggle("hidden", list.length !== 0);
    el.pager.classList.toggle("hidden", list.length <= shown);
    el.count.textContent = list.length + " of " + DATA.repos.length + " repos";

    const p = new URLSearchParams();
    if (el.search.value) p.set("q", el.search.value);
    if (el.category.value !== "all") p.set("cat", el.category.value);
    if (el.device.value !== "all") p.set("hw", el.device.value);
    if (el.sort.value !== "updated") p.set("sort", el.sort.value);
    if (el.recency.value !== "all") p.set("rec", el.recency.value);
    if (el.dlOnly.checked) p.set("dl", "1");
    if (el.favOnly.checked) p.set("fav", "1");
    const qs = p.toString();
    history.replaceState(null, "", qs ? "?" + qs : location.pathname);
  }

  const onFilter = () => { shown = PAGE_SIZE; render(); };
  [el.search, el.sort, el.category, el.device, el.recency, el.dlOnly, el.favOnly].forEach((node) =>
    node.addEventListener(node.type === "search" ? "input" : "change", onFilter)
  );
  el.loadMore.addEventListener("click", () => { shown += PAGE_SIZE; render(); });
  el.loadAll.addEventListener("click", () => { shown = Number.MAX_SAFE_INTEGER; render(); });
  render();
})();
</script>
</body>
</html>`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
