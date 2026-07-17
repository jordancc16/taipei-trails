/* ============================================================
   Taipei Trails — app logic: rendering, filtering, map, detail,
   and a live review / star-rating system (localStorage).
   ============================================================ */

const DIFF_COLOR = { Easy: "#2f7d4f", Moderate: "#d39614", Hard: "#c64034" };

const state = {
  search: "",
  difficulty: "All",
  length: "All",
  sort: "rating",
  favorites: JSON.parse(localStorage.getItem("tt-favs") || "[]"),
  reviews: JSON.parse(localStorage.getItem("tt-reviews") || "{}"), // { id: [ {name,stars,text,date} ] }
  pendingStars: 0, // star value being picked in the open modal
};

let map, modalMap;
const routeLayers = {}; // id -> leaflet layer

/* ---------- Helpers ---------- */
function starGlyphs(rating) {
  const full = Math.round(rating);
  return "★".repeat(full) + "☆".repeat(5 - full);
}

// Blend the seed rating with the visitor's own reviews for this session.
function getAggregate(t) {
  const userReviews = state.reviews[t.id] || [];
  const seedSum = t.rating * t.reviews;
  const userSum = userReviews.reduce((s, r) => s + r.stars, 0);
  const count = t.reviews + userReviews.length;
  const rating = count ? (seedSum + userSum) / count : t.rating;
  return { rating, count, userCount: userReviews.length };
}

function matchesLength(km, bucket) {
  if (bucket === "All") return true;
  if (bucket === "short") return km < 12;
  if (bucket === "medium") return km >= 12 && km <= 20;
  if (bucket === "long") return km > 20;
  return true;
}

function getFiltered() {
  const q = state.search.trim().toLowerCase();
  let list = TRAILS.filter((t) => {
    const inSearch =
      !q ||
      t.name.toLowerCase().includes(q) ||
      t.area.toLowerCase().includes(q) ||
      t.tags.join(" ").toLowerCase().includes(q) ||
      t.summary.toLowerCase().includes(q);
    const inDiff = state.difficulty === "All" || t.difficulty === state.difficulty;
    const inLen = matchesLength(t.distanceKm, state.length);
    return inSearch && inDiff && inLen;
  });

  list.sort((a, b) => {
    if (state.sort === "rating") return getAggregate(b).rating - getAggregate(a).rating;
    if (state.sort === "distance") return a.distanceKm - b.distanceKm;
    if (state.sort === "distance-desc") return b.distanceKm - a.distanceKm;
    if (state.sort === "elevation") return b.elevationM - a.elevationM;
    return 0;
  });
  return list;
}

/* ---------- Card rendering ---------- */
function cardHTML(t) {
  const fav = state.favorites.includes(t.id);
  const agg = getAggregate(t);
  return `
    <article class="card" data-id="${t.id}">
      <div class="card-photo" style="background-image:url('${t.photo}')">
        <button class="fav ${fav ? "on" : ""}" data-fav="${t.id}" title="Save">${fav ? "♥" : "♡"}</button>
        <span class="badge ${t.difficulty}">${t.difficulty}</span>
      </div>
      <div class="card-body">
        <div class="card-area">${t.area}</div>
        <h3 class="card-title">${t.name}</h3>
        <div class="card-rating">
          <span class="stars">${starGlyphs(agg.rating)}</span>
          ${agg.rating.toFixed(1)}
          <span class="n">(${agg.count.toLocaleString()})</span>
        </div>
        <div class="card-meta">
          <span><b>${t.distanceKm}</b> km</span>
          <span><b>${t.elevationM}</b> m climb</span>
          <span>⏱ ${t.timeText}</span>
        </div>
        <div class="tag-row">
          ${t.tags.slice(0, 3).map((tag) => `<span class="tag">${tag}</span>`).join("")}
        </div>
      </div>
    </article>`;
}

function renderCards() {
  const list = getFiltered();
  const wrap = document.getElementById("cards");
  document.getElementById("result-count").textContent =
    `${list.length} route${list.length === 1 ? "" : "s"}`;

  if (!list.length) {
    wrap.innerHTML = `<div class="empty">
      <h3>No routes match your filters</h3>
      <p>Try clearing the search or difficulty filter.</p></div>`;
  } else {
    wrap.innerHTML = list.map(cardHTML).join("");
  }
  highlightMap(list);
}

/* ---------- Map ---------- */
function initMap() {
  map = L.map("map", { scrollWheelZoom: false }).setView([25.07, 121.52], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
    maxZoom: 18,
  }).addTo(map);

  TRAILS.forEach((t) => {
    const line = L.polyline(t.path, {
      color: DIFF_COLOR[t.difficulty],
      weight: 5,
      opacity: 0.9,
    }).addTo(map);
    line.bindTooltip(`${t.name} · ${t.distanceKm}km`, { sticky: true });
    line.on("click", () => openDetail(t.id));
    routeLayers[t.id] = line;
  });
}

function highlightMap(list) {
  const visible = new Set(list.map((t) => t.id));
  const bounds = [];
  TRAILS.forEach((t) => {
    const layer = routeLayers[t.id];
    if (!layer) return;
    if (visible.has(t.id)) {
      if (!map.hasLayer(layer)) layer.addTo(map);
      layer.setStyle({ opacity: 0.9, weight: 5 });
      t.path.forEach((p) => bounds.push(p));
    } else if (map.hasLayer(layer)) {
      map.removeLayer(layer);
    }
  });
  if (bounds.length) map.fitBounds(bounds, { padding: [30, 30] });
}

/* ---------- Reviews ---------- */
function saveReviews() {
  localStorage.setItem("tt-reviews", JSON.stringify(state.reviews));
}

function reviewListHTML(id) {
  const list = state.reviews[id] || [];
  if (!list.length) {
    return `<p class="no-reviews">No visitor reviews yet — be the first to rate this ride!</p>`;
  }
  return list
    .slice()
    .reverse()
    .map(
      (r) => `
      <div class="review">
        <div class="review-top">
          <span class="review-name">${escapeHTML(r.name || "Anonymous")}</span>
          <span class="review-stars">${starGlyphs(r.stars)}</span>
        </div>
        <div class="review-date">${r.date}</div>
        ${r.text ? `<p class="review-text">${escapeHTML(r.text)}</p>` : ""}
      </div>`
    )
    .join("");
}

function starInputHTML() {
  let out = "";
  for (let i = 1; i <= 5; i++) {
    out += `<button type="button" class="star-btn" data-star="${i}" aria-label="${i} star">☆</button>`;
  }
  return out;
}

function paintStarInput() {
  document.querySelectorAll("#star-input .star-btn").forEach((btn) => {
    const v = Number(btn.dataset.star);
    btn.textContent = v <= state.pendingStars ? "★" : "☆";
    btn.classList.toggle("on", v <= state.pendingStars);
  });
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function todayStr() {
  // Avoids Date.now in module scope; called only on user submit.
  const d = new Date();
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/* ---------- Detail modal ---------- */
let currentId = null;

function openDetail(id) {
  const t = TRAILS.find((x) => x.id === id);
  if (!t) return;
  currentId = id;
  state.pendingStars = 0;
  const fav = state.favorites.includes(t.id);
  const agg = getAggregate(t);

  document.getElementById("m-hero").style.backgroundImage = `url('${t.photo}')`;
  document.getElementById("m-title").textContent = t.name;
  document.getElementById("m-sub").textContent =
    `${t.area} · ${t.surface}${t.loop ? " · Loop" : ""}`;
  document.getElementById("m-summary").textContent = t.summary;

  document.getElementById("m-stats").innerHTML = `
    <div class="stat-box"><b>${t.distanceKm} km</b><span>Distance</span></div>
    <div class="stat-box"><b>${t.elevationM} m</b><span>Elevation gain</span></div>
    <div class="stat-box"><b>${t.difficulty}</b><span>Difficulty</span></div>
    <div class="stat-box"><b>${agg.rating.toFixed(1)} ★</b><span>${agg.count.toLocaleString()} reviews</span></div>`;

  document.getElementById("m-highlights").innerHTML =
    t.highlights.map((h) => `<li>${h}</li>`).join("");

  // Reviews section
  document.getElementById("review-list").innerHTML = reviewListHTML(id);
  document.getElementById("star-input").innerHTML = starInputHTML();
  document.getElementById("reviewer-name").value = "";
  document.getElementById("reviewer-text").value = "";
  paintStarInput();

  const favBtn = document.getElementById("m-fav");
  favBtn.textContent = fav ? "♥ Saved" : "♡ Save route";
  favBtn.onclick = () => { toggleFav(t.id); openDetail(t.id); };

  document.getElementById("m-directions").onclick = () => {
    const start = t.path[0], end = t.path[t.path.length - 1];
    window.open(
      `https://www.google.com/maps/dir/${start[0]},${start[1]}/${end[0]},${end[1]}/data=!4m2!4m1!3e1`,
      "_blank"
    );
  };

  const backdrop = document.getElementById("modal");
  backdrop.querySelector(".modal").scrollTop = 0;
  backdrop.classList.add("open");
  document.body.style.overflow = "hidden";

  setTimeout(() => {
    if (!modalMap) {
      modalMap = L.map("modal-map", { scrollWheelZoom: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 18,
      }).addTo(modalMap);
    }
    modalMap.eachLayer((l) => { if (l instanceof L.Polyline) modalMap.removeLayer(l); });
    const line = L.polyline(t.path, { color: DIFF_COLOR[t.difficulty], weight: 6 }).addTo(modalMap);
    modalMap.invalidateSize();
    modalMap.fitBounds(line.getBounds(), { padding: [25, 25] });
  }, 60);
}

function closeDetail() {
  document.getElementById("modal").classList.remove("open");
  document.body.style.overflow = "";
  currentId = null;
}

function submitReview() {
  if (!currentId) return;
  if (!state.pendingStars) {
    flashHint("Please pick a star rating first ⭐");
    return;
  }
  const name = document.getElementById("reviewer-name").value.trim();
  const text = document.getElementById("reviewer-text").value.trim();
  const review = { name, stars: state.pendingStars, text, date: todayStr() };
  if (!state.reviews[currentId]) state.reviews[currentId] = [];
  state.reviews[currentId].push(review);
  saveReviews();

  // Re-render the modal review area + refresh cards (aggregate rating changed)
  document.getElementById("review-list").innerHTML = reviewListHTML(currentId);
  state.pendingStars = 0;
  document.getElementById("reviewer-name").value = "";
  document.getElementById("reviewer-text").value = "";
  paintStarInput();
  const t = TRAILS.find((x) => x.id === currentId);
  const agg = getAggregate(t);
  document.querySelector("#m-stats .stat-box:last-child").innerHTML =
    `<b>${agg.rating.toFixed(1)} ★</b><span>${agg.count.toLocaleString()} reviews</span>`;
  renderCards();
}

function flashHint(msg) {
  const el = document.getElementById("review-hint");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2200);
}

/* ---------- Favorites ---------- */
function toggleFav(id) {
  const i = state.favorites.indexOf(id);
  if (i === -1) state.favorites.push(id);
  else state.favorites.splice(i, 1);
  localStorage.setItem("tt-favs", JSON.stringify(state.favorites));
  renderCards();
}

/* ---------- Events ---------- */
function bindEvents() {
  document.getElementById("search").addEventListener("input", (e) => {
    state.search = e.target.value;
    renderCards();
  });

  document.querySelectorAll("[data-diff]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.difficulty = btn.dataset.diff;
      document.querySelectorAll("[data-diff]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderCards();
    });
  });

  document.querySelectorAll("[data-len]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.length = btn.dataset.len;
      document.querySelectorAll("[data-len]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderCards();
    });
  });

  document.getElementById("sort").addEventListener("change", (e) => {
    state.sort = e.target.value;
    renderCards();
  });

  document.querySelectorAll(".chip").forEach((c) => {
    c.addEventListener("click", () => {
      state.search = c.dataset.chip;
      document.getElementById("search").value = c.dataset.chip;
      renderCards();
      document.getElementById("explore").scrollIntoView({ behavior: "smooth" });
    });
  });

  document.getElementById("cards").addEventListener("click", (e) => {
    const favBtn = e.target.closest("[data-fav]");
    if (favBtn) { e.stopPropagation(); toggleFav(favBtn.dataset.fav); return; }
    const card = e.target.closest(".card");
    if (card) openDetail(card.dataset.id);
  });

  // Star input (event delegation + hover preview)
  const starInput = document.getElementById("star-input");
  starInput.addEventListener("click", (e) => {
    const b = e.target.closest(".star-btn");
    if (!b) return;
    state.pendingStars = Number(b.dataset.star);
    paintStarInput();
  });
  starInput.addEventListener("mouseover", (e) => {
    const b = e.target.closest(".star-btn");
    if (!b) return;
    const v = Number(b.dataset.star);
    document.querySelectorAll("#star-input .star-btn").forEach((btn) => {
      btn.textContent = Number(btn.dataset.star) <= v ? "★" : "☆";
    });
  });
  starInput.addEventListener("mouseout", paintStarInput);

  document.getElementById("submit-review").addEventListener("click", submitReview);

  document.querySelector(".modal-hero .close").addEventListener("click", closeDetail);
  document.getElementById("modal").addEventListener("click", (e) => {
    if (e.target.id === "modal") closeDetail();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDetail(); });
}

/* ---------- Init ---------- */
window.addEventListener("DOMContentLoaded", () => {
  initMap();
  bindEvents();
  renderCards();
});
