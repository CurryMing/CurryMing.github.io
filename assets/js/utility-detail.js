const LS_THEME = "csgo-theme";
const DATA_URL = "assets/utility/data.json";

const CATEGORY_COLORS = {
    "烟雾弹": "smoke",
    "闪光弹": "flash",
    "燃烧弹": "molotov",
    "手雷": "he"
};

const elDetail = document.getElementById("detail");
const elEmpty = document.getElementById("empty");
const elTitle = document.getElementById("detailTitle");
const elCategory = document.getElementById("detailCategory");
const elMap = document.getElementById("detailMap");
const elPageTitle = document.getElementById("pageTitle");
const elBackBtn = document.getElementById("backBtn");
const elGif = document.getElementById("detailGif");
const elEffect = document.getElementById("detailEffect");
const elEffectWrap = document.getElementById("effectWrap");

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

function renderDetail(item){
    const catClass = CATEGORY_COLORS[item.category] || "smoke";
    elPageTitle.textContent = item.title;
    elTitle.textContent = item.title;
    elCategory.textContent = item.category;
    elCategory.className = "category-badge " + catClass;
    elMap.textContent = item.map;

    if (item.gif) {
        elGif.src = item.gif;
        elGif.alt = item.title;
    }

    if (item.effect) {
        elEffect.src = item.effect;
        elEffect.alt = item.title + " 效果";
        elEffect.loading = "lazy";
        elEffect.onerror = function(){ elEffectWrap.hidden = true; };
        elEffectWrap.hidden = false;
    }

    elDetail.hidden = false;
    elEmpty.hidden = true;
}

async function init(){
    initTheme();

    elBackBtn.addEventListener("click", ()=>{
        location.href = "utility.html";
    });

    const params = new URLSearchParams(location.search);
    const id = params.get("id");
    if (!id) {
        elEmpty.hidden = false;
        return;
    }

    try {
        const items = await loadData();
        const item = items.find(i => i.id === id);
        if (!item) {
            elEmpty.hidden = false;
            return;
        }
        renderDetail(item);
    } catch (e) {
        console.warn("加载详情失败:", e);
        elEmpty.hidden = false;
    }
}

init();
