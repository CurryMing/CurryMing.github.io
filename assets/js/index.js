const DEFAULT_VIDEOS = [];

    let videos = [...DEFAULT_VIDEOS];
    const MANIFEST_URL = "assets/videos/manifest.json";

    const LS_LIKED = "csgo-liked";
    const LS_FAVS = "csgo-favs";
    const LS_THEME = "csgo-theme";
    const COMBO_WINDOW_MS = 1400;
    const APP_VERSION = "v1.15.0";
    const CHANGELOG = [
        {
            version: "v1.15.0",
            date: "2026-05-27",
            changes: [
                "MVP 卡片支持点击生成分享图片，可下载或长按保存"
            ]
        },
        {
            version: "v1.14.0",
            date: "2026-05-27",
            changes: [
                "战绩列表与日报页展示多杀标识：当玩家有 4 杀或 5 杀时显示对应徽章",
                "日报成员行与对局头部分别展示 4杀/5杀 标签"
            ]
        },
        {
            version: "v1.13.0",
            date: "2026-05-27",
            changes: [
                "新增排行榜页面（leaderboard.html），展示 MVP 次数、5杀、4杀、总击杀排名",
                "主页工具栏增加“排行榜”导航按钮",
                "战绩数据新增 k4/k5 字段，支持多杀统计"
            ]
        },
        {
            version: "v1.12.0",
            date: "2026-05-27",
            changes: [
                "新增 MVP 评选功能：自动统计每周战绩数据，评选 Rating 最高的玩家为 MVP",
                "主页增加 MVP 展示卡片，高亮本周最佳选手"
            ]
        },
        {
            version: "v1.11.0",
            date: "2026-05-27",
            changes: [
                "新增版本号机制与版本更新记录弹窗",
                "主页增加“版本记录”按钮，支持随时查看历史更新",
                "页脚展示当前版本号与版本说明入口"
            ]
        },
        {
            version: "v1.10.0",
            date: "2026-05-27",
            changes: [
                "新增战绩列表页、日报页定位跳转与回跳定位",
                "新增 Rating 走势图（含图例、tooltip、缩放与显示控制）",
                "日报支持多对局与胜平负视觉区分"
            ]
        }
    ];
    const REPORT_JSON_URL = "assets/reports/daily-report.json";
    const liked = new Set(JSON.parse(localStorage.getItem(LS_LIKED) || "[]"));
    const favs = new Set(JSON.parse(localStorage.getItem(LS_FAVS) || "[]"));
    const collapsedMaps = new Set();
    let sortValue = "new";
    const comboState = {
        like: { count: 0, lastAt: 0, timer: null },
        fav: { count: 0, lastAt: 0, timer: null }
    };
    let favOnly = false;

    const elApp = document.getElementById("app");
    const elSearch = document.getElementById("search");
    const elSortSelect = document.getElementById("sortSelect");
    const elSortTrigger = document.getElementById("sortTrigger");
    const elSortLabel = document.getElementById("sortLabel");
    const elSortMenu = document.getElementById("sortMenu");
    const elFavOnlyBtn = document.getElementById("favOnlyBtn");
    const elReportPageBtn = document.getElementById("reportPageBtn");
    const elChangelogBtn = document.getElementById("changelogBtn");
    const elThemeBtn = document.getElementById("themeBtn");
    const elFooterVersion = document.getElementById("footerVersion");
    const elChangelogMask = document.getElementById("changelogMask");
    const elChangelogList = document.getElementById("changelogList");
    const elChangelogCloseBtn = document.getElementById("changelogCloseBtn");

    function applyTheme(theme){
        const nextTheme = theme === "light" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", nextTheme);
        if (elThemeBtn) {
            const iconEl = elThemeBtn.querySelector(".theme-icon");
            const toLight = nextTheme === "dark";
            if (iconEl) iconEl.textContent = toLight ? "☀️" : "🌙";
            elThemeBtn.setAttribute("aria-label", toLight ? "切换为白天模式" : "切换为黑夜模式");
            elThemeBtn.title = toLight ? "切换为白天模式" : "切换为黑夜模式";
        }
    }

    function initTheme(){
        const savedTheme = localStorage.getItem(LS_THEME);
        if (savedTheme === "light" || savedTheme === "dark") {
            applyTheme(savedTheme);
            return;
        }

        const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
        applyTheme(prefersLight ? "light" : "dark");
    }

    function save() {
        localStorage.setItem(LS_LIKED, JSON.stringify([...liked]));
        localStorage.setItem(LS_FAVS, JSON.stringify([...favs]));
    }

    function getLikeCount(v){ return v.baseLikes + (liked.has(v.id) ? 1 : 0); }

    function stripYear(dateStr){
        if (!dateStr) return dateStr;
        const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return dateStr;
        const thisYear = String(new Date().getFullYear());
        return m[1] === thisYear ? `${m[2]}-${m[3]}` : dateStr;
    }

    function formatDate(dateStr){
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const diffDays = Math.round((today - target) / 86400000);
        if (diffDays === 0) return "今天 " + stripYear(dateStr);
        if (diffDays === 1) return "昨天 " + stripYear(dateStr);
        if (diffDays === 2) return "前天 " + stripYear(dateStr);
        return stripYear(dateStr);
    }

    function getWeekNumber(dateStr){
        const d = new Date(dateStr + "T00:00:00");
        const dayNum = (d.getDay() + 6) % 7;
        d.setDate(d.getDate() - dayNum + 3);
        const jan4 = new Date(d.getFullYear(), 0, 4);
        return 1 + Math.round((d - jan4) / 86400000 / 7);
    }

    function toLocalDateStr(d){
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    }

    function getWeekMonday(dateStr){
        const d = new Date(dateStr + "T00:00:00");
        const day = d.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        const monday = new Date(d);
        monday.setDate(d.getDate() + diff);
        return toLocalDateStr(monday);
    }

    function getWeekSunday(dateStr){
        const d = new Date(dateStr + "T00:00:00");
        const day = d.getDay();
        const diff = day === 0 ? 0 : 7 - day;
        const sunday = new Date(d);
        sunday.setDate(d.getDate() + diff);
        return toLocalDateStr(sunday);
    }

    async function computeMvp(){
        try {
            const response = await fetch(REPORT_JSON_URL, { cache: "no-store" });
            if (!response.ok) throw new Error("load failed");
            const raw = await response.json();
            const list = Array.isArray(raw && raw.reports) ? raw.reports : [];
            const matches = list
                .filter(item => /^\d{4}-\d{2}-\d{2}$/.test(item.date))
                .flatMap(item => (item.matches || []).map(m => ({ ...m, date: item.date })));
            if (!matches.length) return null;

            const weekGroups = new Map();
            matches.forEach(m => {
                const wk = `${getWeekNumber(m.date)}-${new Date(m.date).getFullYear()}`;
                if (!weekGroups.has(wk)) weekGroups.set(wk, []);
                weekGroups.get(wk).push(m);
            });

            const weekKeys = [...weekGroups.keys()].sort();
            const latestWeek = weekKeys[weekKeys.length - 1];
            const weekMatches = weekGroups.get(latestWeek);

            const playerStats = new Map();
            weekMatches.forEach(m => {
                (m.players || []).forEach(p => {
                    const name = p.name || "未知";
                    if (!playerStats.has(name)) playerStats.set(name, { k:0, d:0, a:0, ratingSum:0, count:0 });
                    const s = playerStats.get(name);
                    s.k += Number(p.k) || 0;
                    s.d += Number(p.d) || 0;
                    s.a += Number(p.a) || 0;
                    s.ratingSum += Number(p.rating) || 0;
                    s.count++;
                });
            });

            let best = null;
            let bestAvg = -1;
            for (const [name, stats] of playerStats) {
                const avg = stats.ratingSum / stats.count;
                if (avg > bestAvg) { bestAvg = avg; best = { name, ...stats, avgRating:avg }; }
            }
            if (!best) return null;

            const sampleDate = weekMatches[0].date;
            const monday = getWeekMonday(sampleDate);
            const sunday = getWeekSunday(sampleDate);
            const thisYear = String(new Date().getFullYear());
            const monYear = monday.slice(0, 4);
            const monParts = (monYear !== thisYear ? monYear + "/" : "") + monday.slice(5).replace("-","/");
            const sunParts = sunday.slice(5).replace("-","/");
            const weekNum = latestWeek.split("-")[0];

            return {
                name: best.name,
                avgK: (best.k / best.count).toFixed(1),
                avgD: (best.d / best.count).toFixed(1),
                avgA: (best.a / best.count).toFixed(1),
                avgRating: bestAvg.toFixed(2),
                matchCount: best.count,
                weekNumber: weekNum,
                dateRange: `${monParts} - ${sunParts}`
            };
        } catch (e) {
            console.warn("MVP 计算失败:", e);
            return null;
        }
    }

    async function renderMvp(){
        const elCard = document.getElementById("mvpCard");
        const elName = document.getElementById("mvpName");
        const elStats = document.getElementById("mvpStats");
        const elWeek = document.getElementById("mvpWeek");
        if (!elCard) return;

        const mvp = await computeMvp();
        if (!mvp) { elCard.classList.add("mvp-empty"); return; }

        elName.textContent = mvp.name;
        elStats.innerHTML = `Rating <strong>${mvp.avgRating}</strong> · K/D/A ${mvp.avgK}/${mvp.avgD}/${mvp.avgA} · ${mvp.matchCount} 场`;
        elWeek.textContent = `第 ${mvp.weekNumber} 周 · ${mvp.dateRange}`;
        elCard.classList.remove("mvp-empty");

        document.getElementById("shareMvpName").textContent = mvp.name;
        document.getElementById("shareMvpRating").textContent = mvp.avgRating;
        document.getElementById("shareMvpKda").textContent = `${mvp.avgK}/${mvp.avgD}/${mvp.avgA}`;
        document.getElementById("shareMvpMatches").textContent = `${mvp.matchCount} 场`;
        document.getElementById("shareMvpWeek").textContent = `第 ${mvp.weekNumber} 周 · ${mvp.dateRange}`;
    }

    function ytThumb(url){
        const m = url.match(/(?:embed\/|v=|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
        return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : "";
    }

    const MAP_COVER_BY_MAP = {
        // 按地图名指定顶部封面（可按需修改路径）
        mirage: "assets/map-covers/mirage.jpg",
        dust2: "assets/map-covers/dust2.png",
        inferno: "assets/map-covers/inferno.jpg",
        nuke: "assets/map-covers/nuke.jpg",
        ancient: "assets/map-covers/ancient.jpg",
        anubis: "assets/map-covers/anubis.jpg",
        overpass: "assets/map-covers/overpass.jpg",
        vertigo: "assets/map-covers/vertigo.jpg"
    };

    const MAP_NAME_CN_BY_KEY = {
        mirage: "荒漠迷城",
        dust2: "炙热沙城",
        inferno: "炼狱小镇",
        nuke: "核子危机",
        ancient: "远古遗迹",
        anubis: "阿努比斯",
        overpass: "死亡游乐园",
        vertigo: "殒命大厦"
    };

    function normalizeMapKey(map){
        return (map || "")
            .toLowerCase()
            .replace(/^de_/, "")
            .replace(/\s+/g, "")
            .replace(/[^a-z0-9]/g, "");
    }

    function mapNameForDisplay(map){
        const key = normalizeMapKey(map);
        return MAP_NAME_CN_BY_KEY[key] || map;
    }

    function coverForMap(map, items){
        const mappedCover = MAP_COVER_BY_MAP[normalizeMapKey(map)];
        if (mappedCover) return mappedCover;

        const first = items[0];
        if (!first) return "";
        if (first.poster) return first.poster;
        if (first.type === "youtube") return ytThumb(first.src);
        return "";
    }

    function groupByMap(arr){
        const m = new Map();
        arr.forEach(v => { if(!m.has(v.map)) m.set(v.map, []); m.get(v.map).push(v); });
        return [...m.entries()];
    }

    function isAbsoluteUrl(path){
        return /^https?:\/\//i.test(path || "");
    }

    function normalizeLocalPath(path, baseFolder){
        const p = (path || "").trim();
        if (!p) return "";
        if (isAbsoluteUrl(p) || p.startsWith("assets/") || p.startsWith("./") || p.startsWith("../")) return p;
        return `${baseFolder}/${p}`;
    }

    function guessTypeBySrc(src){
        const value = (src || "").toLowerCase();
        if (value.includes("youtube.com") || value.includes("youtu.be")) return "youtube";
        return "local";
    }

    function normalizeVideoItem(item, index){
        const src = normalizeLocalPath(item.src, "assets/videos");
        const type = item.type || guessTypeBySrc(src);
        const safeId = item.id || `video-${index + 1}`;
        return {
            id: safeId,
            title: item.title || `未命名视频 ${index + 1}`,
            map: item.map || "Unknown",
            date: item.date || "1970-01-01",
            tags: Array.isArray(item.tags) ? item.tags : [],
            type,
            src,
            poster: normalizeLocalPath(item.poster, "assets/posters"),
            baseLikes: Number(item.baseLikes) || 0
        };
    }

    async function loadVideosFromManifest(){
        try {
            const response = await fetch(MANIFEST_URL, { cache: "no-store" });
            if (!response.ok) throw new Error(`manifest http ${response.status}`);

            const raw = await response.json();
            const list = Array.isArray(raw) ? raw : (Array.isArray(raw.videos) ? raw.videos : []);
            if (!list.length) throw new Error("manifest videos empty");

            videos = list.map(normalizeVideoItem).filter(v => !!v.src);
            if (!videos.length) {
                throw new Error("manifest videos invalid");
            }
        } catch (error) {
            console.warn("加载 manifest 失败，当前没有默认视频数据:", error);
            videos = [...DEFAULT_VIDEOS];
        }
    }

    function filteredData(){
        const q = elSearch.value.trim().toLowerCase();
        let arr = videos.filter(v => {
            if (favOnly && !favs.has(v.id)) return false;
            if (!q) return true;
            const text = [v.title, v.map, ...(v.tags||[])].join(" ").toLowerCase();
            return text.includes(q);
        });

        if (sortValue === "hot") arr.sort((a,b)=>getLikeCount(b)-getLikeCount(a));
        else if (sortValue === "old") arr.sort((a,b)=>(a.date||"").localeCompare(b.date||""));
        else arr.sort((a,b)=>(b.date||"").localeCompare(a.date||""));

        return arr;
    }

    function cardHtml(v, idx){
        const media = v.type === "youtube"
            ? `<iframe loading="lazy" src="${v.src}" title="${v.title}" allowfullscreen></iframe>`
            : `<video controls preload="metadata" poster="${v.poster||""}"><source src="${v.src}" type="video/mp4" /></video>`;

        return `
      <article class="card" id="card-${v.id}" style="--i:${idx};">
        <div class="media">${media}</div>
        <div class="content">
          <h3 class="title">${v.title}</h3>
          <div class="meta"><span>${formatDate(v.date)}</span><span>${v.map}</span></div>
          <div style="margin-bottom:8px">${(v.tags||[]).map(t=>`<span class="pill">${t}</span>`).join("")}</div>
          <div class="ops">
            <button class="op-btn ${liked.has(v.id) ? "active":""}" data-action="like" data-id="${v.id}">👍 点赞 ${getLikeCount(v)}</button>
            <button class="op-btn ${favs.has(v.id) ? "active":""}" data-action="fav" data-id="${v.id}">${favs.has(v.id) ? "★ 已收藏" : "☆ 收藏"}</button>
            <button class="op-btn" data-action="share" data-id="${v.id}">🔗 分享</button>
          </div>
        </div>
      </article>`;
    }

    function render(){
        const arr = filteredData();
        const groups = groupByMap(arr);

        if (!arr.length){
            elApp.innerHTML = `<div class="section-cover"><div class="cover-sub">没有匹配结果，换个关键词试试。</div></div>`;
            return;
        }

        elApp.innerHTML = groups.map(([map, items])=>{
            const mapKey = normalizeMapKey(map) || map;
            const collapsed = collapsedMaps.has(mapKey);
            const cover = coverForMap(map, items);
            const displayName = mapNameForDisplay(map);
            const coverClass = "section-cover clickable";
            return `
          <section class="section">
            <div class="${coverClass}" data-action="toggle-map" data-map-key="${mapKey}">
              <div class="cover-bg" style="background-image:url('${cover || ""}')">
                <div class="cover-title">${displayName}</div>
              </div>
              <div class="cover-sub" data-count="${items.length}">共 ${items.length} 条高光 · ${collapsed ? "点击展开" : "点击折叠"}</div>
            </div>
            <div class="grid ${collapsed ? "collapsed" : ""}">${items.map((v, idx)=>cardHtml(v, idx)).join("")}</div>
          </section>`;
        }).join("");
    }

    async function shareVideo(id){
        const url = `${location.origin}${location.pathname}?v=${encodeURIComponent(id)}`;
        try {
            await navigator.clipboard.writeText(url);
            alert("已复制分享链接：\n" + url);
        } catch {
            prompt("复制以下链接分享：", url);
        }
    }

    function showActionFeedback(action, isAdd, anchorEl){
        const rect = anchorEl ? anchorEl.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0 };
        const x = rect.left + (rect.width / 2);
        const y = rect.top + 10;

        const burst = document.createElement("div");
        burst.className = `fx-burst ${action}`;
        burst.textContent = action === "like" ? (isAdd ? "❤" : "♡") : (isAdd ? "★" : "☆");
        burst.style.left = `${x}px`;
        burst.style.top = `${y}px`;
        document.body.appendChild(burst);
        setTimeout(()=>burst.remove(), 900);

        const sparkOffsets = action === "fav"
            ? [[-28,-18],[-10,-36],[14,-32],[30,-14]]
            : [[-20,-12],[0,-30],[20,-12]];
        sparkOffsets.forEach(([dx, dy])=>{
            const spark = document.createElement("div");
            spark.className = `fx-spark ${action}`;
            spark.style.left = `${x}px`;
            spark.style.top = `${y}px`;
            spark.style.setProperty("--dx", `${dx}px`);
            spark.style.setProperty("--dy", `${dy}px`);
            document.body.appendChild(spark);
            requestAnimationFrame(()=>spark.classList.add("go"));
            setTimeout(()=>spark.remove(), 780);
        });

        const toast = document.createElement("div");
        toast.className = `action-toast ${action}`;
        toast.textContent = action === "like"
            ? (isAdd ? "已点赞，热度 +1" : "已取消点赞")
            : (isAdd ? "已加入收藏夹" : "已取消收藏");
        document.body.appendChild(toast);
        requestAnimationFrame(()=>toast.classList.add("show"));
        setTimeout(()=>{
            toast.classList.remove("show");
            setTimeout(()=>toast.remove(), 260);
        }, 950);
    }

    function animateActionButton(btn, action){
        const cls = action === "like" ? "like-pop" : "fav-pop";
        btn.classList.remove(cls);
        void btn.offsetWidth;
        btn.classList.add(cls);
    }

    function showComboFeedback(action, count, anchorEl){
        const rect = anchorEl ? anchorEl.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0 };
        const x = rect.left + (rect.width / 2);
        const y = rect.top - 4;

        const combo = document.createElement("div");
        combo.className = `combo-float ${action}`;
        combo.textContent = `${action.toUpperCase()} COMBO x${count}`;
        combo.style.left = `${x}px`;
        combo.style.top = `${y}px`;
        document.body.appendChild(combo);
        requestAnimationFrame(()=>combo.classList.add("go"));
        setTimeout(()=>combo.remove(), 920);
    }

    function updateCombo(action, isAdd, anchorEl){
        const state = comboState[action];
        if (!state) return;

        if (!isAdd) {
            state.count = 0;
            state.lastAt = 0;
            if (state.timer) clearTimeout(state.timer);
            state.timer = null;
            return;
        }

        const now = Date.now();
        state.count = (now - state.lastAt <= COMBO_WINDOW_MS) ? state.count + 1 : 1;
        state.lastAt = now;

        if (state.count >= 2) showComboFeedback(action, state.count, anchorEl);

        if (state.timer) clearTimeout(state.timer);
        state.timer = setTimeout(()=>{
            state.count = 0;
            state.lastAt = 0;
            state.timer = null;
        }, COMBO_WINDOW_MS);
    }

    function syncSortUi(){
        const options = elSortMenu ? [...elSortMenu.querySelectorAll(".sort-option")] : [];
        const activeOption = options.find(option => option.dataset.sortValue === sortValue);
        options.forEach(option => {
            const active = option.dataset.sortValue === sortValue;
            option.classList.toggle("active", active);
            option.setAttribute("aria-selected", active ? "true" : "false");
        });
        if (elSortLabel && activeOption) elSortLabel.textContent = activeOption.textContent;
    }

    function closeSortMenu(){
        if (!elSortSelect || !elSortTrigger) return;
        elSortSelect.classList.remove("open");
        elSortTrigger.setAttribute("aria-expanded", "false");
    }

    function renderVersionInfo(){
        if (!elFooterVersion) return;
        elFooterVersion.textContent = `当前版本 ${APP_VERSION}`;
    }

    function renderChangelog(){
        if (!elChangelogList) return;
        elChangelogList.innerHTML = CHANGELOG.map(item => `
            <section class="changelog-item">
                <div><span class="changelog-ver">${item.version}</span><span class="changelog-date">${stripYear(item.date)}</span></div>
                <ul class="changelog-desc">${item.changes.map(c => `<li>${c}</li>`).join("")}</ul>
            </section>
        `).join("");
    }

    function openChangelog(){
        if (!elChangelogMask) return;
        elChangelogMask.classList.add("show");
        elChangelogMask.setAttribute("aria-hidden", "false");
    }

    function closeChangelog(){
        if (!elChangelogMask) return;
        elChangelogMask.classList.remove("show");
        elChangelogMask.setAttribute("aria-hidden", "true");
    }

    function bindEvents(){
        function updateFavOnlyBtnState(){
            elFavOnlyBtn.textContent = "收藏夹";
            elFavOnlyBtn.classList.toggle("active", favOnly);
            elFavOnlyBtn.setAttribute("aria-pressed", favOnly ? "true" : "false");
        }

        elSearch.addEventListener("input", render);
        syncSortUi();
        updateFavOnlyBtnState();

        elSortTrigger.addEventListener("click", ()=>{
            const isOpen = elSortSelect.classList.toggle("open");
            elSortTrigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
        });

        elSortMenu.addEventListener("click", (e)=>{
            const option = e.target.closest("[data-sort-value]");
            if (!option) return;
            sortValue = option.dataset.sortValue;
            syncSortUi();
            closeSortMenu();
            render();
        });

        document.addEventListener("click", (e)=>{
            if (e.target.closest("#sortSelect")) return;
            closeSortMenu();
        });

        document.addEventListener("keydown", (e)=>{
            if (e.key === "Escape") closeSortMenu();
            if (e.key === "Escape") closeChangelog();
        });

        elFavOnlyBtn.addEventListener("click", ()=>{
            favOnly = !favOnly;
            updateFavOnlyBtnState();
            render();
        });

        elReportPageBtn.addEventListener("click", ()=>{
            location.href = "report-list.html";
        });

        document.getElementById("leaderboardBtn").addEventListener("click", ()=>{
            location.href = "leaderboard.html";
        });

        elChangelogBtn.addEventListener("click", openChangelog);
        elChangelogCloseBtn.addEventListener("click", closeChangelog);
        elChangelogMask.addEventListener("click", (e)=>{
            if (e.target === elChangelogMask) closeChangelog();
        });

        elThemeBtn.addEventListener("click", ()=>{
            const current = document.documentElement.getAttribute("data-theme") || "dark";
            const next = current === "dark" ? "light" : "dark";
            applyTheme(next);
            localStorage.setItem(LS_THEME, next);
        });

        document.addEventListener("click", (e)=>{
            const btn = e.target.closest("[data-action]");
            if (!btn) return;
            const { action, id, mapKey } = btn.dataset;
            if (action === "toggle-map"){
                const sectionEl = btn.closest(".section");
                const gridEl = sectionEl ? sectionEl.querySelector(".grid") : null;
                const subEl = sectionEl ? sectionEl.querySelector(".cover-sub") : null;
                if (!gridEl) return;

                const nextCollapsed = !gridEl.classList.contains("collapsed");
                gridEl.classList.toggle("collapsed", nextCollapsed);

                if (nextCollapsed) collapsedMaps.add(mapKey);
                else collapsedMaps.delete(mapKey);

                if (subEl) {
                    const count = subEl.dataset.count || "0";
                    subEl.textContent = `共 ${count} 条高光 · ${nextCollapsed ? "点击展开" : "点击折叠"}`;
                }
            } else if (action === "like"){
                const isAdd = !liked.has(id);
                liked.has(id) ? liked.delete(id) : liked.add(id);
                showActionFeedback("like", isAdd, btn);
                animateActionButton(btn, "like");
                updateCombo("like", isAdd, btn);
                save();
                setTimeout(render, 180);
            } else if (action === "fav"){
                const isAdd = !favs.has(id);
                favs.has(id) ? favs.delete(id) : favs.add(id);
                showActionFeedback("fav", isAdd, btn);
                animateActionButton(btn, "fav");
                updateCombo("fav", isAdd, btn);
                save();
                setTimeout(render, 180);
            } else if (action === "share"){
                shareVideo(id);
            }
        });
    }

    function locateFromQuery(){
        const id = new URLSearchParams(location.search).get("v");
        if (!id) return;
        const target = document.getElementById(`card-${id}`);
        if (target){
            target.scrollIntoView({behavior:"smooth", block:"center"});
            target.classList.add("highlight");
            setTimeout(()=>target.classList.remove("highlight"), 2200);
        }
    }

    async function init(){
        initTheme();
        renderVersionInfo();
        renderChangelog();
        bindEvents();
        renderMvp();
        await loadVideosFromManifest();
        render();
        setTimeout(locateFromQuery, 100);
    }

    init();

// MVP share card
document.getElementById("mvpCard").addEventListener("click", async function(){
        if (!this.classList.contains("mvp-empty") && typeof html2canvas !== "undefined") {
            const el = document.getElementById("mvpShareCard");
            const canvas = await html2canvas(el, { backgroundColor: null, scale: 2 });
            const dataUrl = canvas.toDataURL("image/png");
            document.getElementById("mvpShareImg").src = dataUrl;
            document.getElementById("mvpShareDownloadBtn").onclick = () => {
                const a = document.createElement("a");
                a.href = dataUrl;
                a.download = "csgo-mvp.png";
                a.click();
            };
            document.getElementById("mvpShareMask").classList.add("show");
        }
    });
    document.getElementById("mvpShareMask").addEventListener("click", function(e){
        if (e.target === this) this.classList.remove("show");
    });