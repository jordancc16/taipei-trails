# 🚲 Taipei Trails

An AllTrails-style guide to cycling and sightseeing around **Taipei** — riverside
bikeways, tea-mountain climbs and coastal escapes, each with the sights, snacks
and stops worth stopping for.

**Live site:** https://jordancc16.github.io/taipei-trails/

## Features
- 🗺️ Interactive Leaflet map with every route drawn and colour-coded by difficulty
- 🔍 Search by name, area, tag or sight, plus difficulty / length / sort filters
- 📄 Route detail pages: stats, overview, "what you'll see", route map and
  one-tap Google Maps **cycling directions**
- ⭐ Live **review & star-rating** system (clickable stars + comments, saved in
  your browser and blended into each route's overall score)
- ♥ Save favourite routes
- 📱 Fully responsive

## Routes (15)
Each route is honestly tagged by type — **🚲 dedicated bikeway** (car-free) or
**🚗 road route** (shared with traffic) — and you can filter by it.

**Dedicated bikeways (9):** Tamsui Riverside · Bali Left Bank · Xindian/Bitan ·
Keelung/Dajia · Shezidao Loop · Jingmei · Rainbow Bridge Loop · Erchong Floodway
· Dahan River to Yingge.

**Road routes (6):** Maokong climb · Yangmingshan Balaka · Sanzhi Coast · Wulai
Valley · Shenkeng Old Street · Bishanyan Night View.

## Run locally
It's a static site — just open `index.html` in a browser (an internet
connection is needed for map tiles and photos).

## Files
| File | Purpose |
|------|---------|
| `index.html` | Page layout |
| `styles.css` | All styling |
| `data.js` | Route dataset (edit here to add routes / refine coordinates) |
| `app.js` | Rendering, filters, map, detail modal, reviews |

Maps © OpenStreetMap contributors. Route lines are hand-refined approximations,
not survey-grade GPX.
