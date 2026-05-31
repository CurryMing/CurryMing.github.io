const LS_THEME = "csgo-theme";
const DATA_URL = "assets/utility/data.json";

const DATA_MAP = {
    smoke: "烟雾弹",
    flash: "闪光弹",
    molotov: "燃烧弹",
    he: "手雷"
};

const MAP_KEYS = {
    mirage: "Mirage",
    dust2: "Dust2",
    inferno: "Inferno",
    nuke: "Nuke",
    ancient: "Ancient",
    overpass: "Overpass",
    vertigo: "Vertigo",
    anubis: "Anubis"
};

const CATEGORY_COLORS = {
    "烟雾弹": "smoke",
    "闪光弹": "flash",
    "燃烧弹": "molotov",
    "手雷": "he"
};

let allItems = [];
let mapFilter = "";
let categoryFilter = "";

const elGrid = document.getElementById("grid");
const elEmpty = document.getElementById("empty");
const elStats = document.getElementById("statsBar");
const elMapFilter = document.getElementById("mapFilter");
const elCategoryFilter = document.getElementById("categoryFilter");
const elBackBtn = document.getElementById("backBtn");

function applyTheme(theme){
    const next = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
}

function initTheme(){
    const saved = localStorage.getItem(LS_THEME);
    if (saved === "light" || saved === "dark") { applyTheme(saved); return; }
    const prefers = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
    applyTheme(prefers ? "light" : "dark");
}

async function loadData(){
    const resp = await fetch(DATA_URL, { cache: "no-store" });
    if (!resp.ok) throw new Error("load failed");
    const raw = await resp.json();
    return Array.isArray(raw.items) ? raw.items : [];
}

function populateFilters(items){
    const maps = [...new Set(items.map(i => i.map))].sort();
    const cats = [...new Set(items.map(i => i.category))].sort();

    elMapFilter.innerHTML = '<option value="">全部地图</option>' +
        maps.map(m => `<option value="${m}">${m}</option>`).join("");

    elCategoryFilter.innerHTML = '<option value="">全部类型</option>' +
        cats.map(c => `<option value="${c}">${c}</option>`).join("");
}

function filteredItems(){
    return allItems.filter(i => {
        if (mapFilter && i.map !== mapFilter) return false;
        if (categoryFilter && i.category !== categoryFilter) return false;
        return true;
    });
}

function render(items){
    if (!items.length) {
        elGrid.innerHTML = "";
        elEmpty.hidden = false;
        return;
    }

    elEmpty.hidden = true;
    elGrid.innerHTML = items.map(item => {
        const catClass = CATEGORY_COLORS[item.category] || "smoke";
        return `
        <div class="card" data-id="${item.id}">
            <div class="thumb-placeholder">🎯</div>
            <div class="card-body">
                <div class="card-title">${item.title}</div>
                <div class="card-meta">
                    <span class="category-badge ${catClass}">${item.category}</span>
                    <span class="map-badge">${item.map}</span>
                </div>
            </div>
        </div>`;
    }).join("");
}

function renderStats(items){
    const total = items.length;
    const perCategory = {};
    items.forEach(i => {
        perCategory[i.category] = (perCategory[i.category] || 0) + 1;
    });
    const cats = Object.keys(perCategory).sort();
    elStats.innerHTML = `<span class="stat-item">共 ${total} 个点位</span>` +
        cats.map(c => {
            const cls = CATEGORY_COLORS[c] || "smoke";
            return `<span class="stat-item"><span class="stat-dot" style="background:var(--${cls})"></span>${c} ${perCategory[c]}</span>`;
        }).join("");
}

function bindEvents(){
    elMapFilter.addEventListener("change", ()=>{
        mapFilter = elMapFilter.value;
        const filtered = filteredItems();
        render(filtered);
        renderStats(allItems);
    });

    elCategoryFilter.addEventListener("change", ()=>{
        categoryFilter = elCategoryFilter.value;
        const filtered = filteredItems();
        render(filtered);
        renderStats(allItems);
    });

    elGrid.addEventListener("click", e => {
        const card = e.target.closest(".card");
        if (card) {
            location.href = `utility-detail.html?id=${encodeURIComponent(card.dataset.id)}`;
        }
    });

    elBackBtn.addEventListener("click", ()=>{
        location.href = "index.html";
    });
}

async function init(){
    initTheme();
    try {
        allItems = await loadData();
        if (!allItems.length) throw new Error("empty");
        populateFilters(allItems);
        render(allItems);
        renderStats(allItems);
        bindEvents();
    } catch (e) {
        console.warn("加载道具数据失败:", e);
        elGrid.innerHTML = "";
        elEmpty.hidden = false;
    }
}

init();
