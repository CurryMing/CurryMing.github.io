
    const LS_THEME = "csgo-theme";
    const REPORT_JSON_URL = "assets/reports/daily-report.json";
    let currentSort = "mvp";
    let sortDesc = true;

    function applyTheme(theme){
        const nextTheme = theme === "light" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", nextTheme);
        localStorage.setItem(LS_THEME, nextTheme);
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

    function computeRankings(raw){
        const list = Array.isArray(raw && raw.reports) ? raw.reports : [];
        const allMatches = list
            .filter(item => /^\d{4}-\d{2}-\d{2}$/.test(item.date))
            .flatMap(item => (item.matches || []).map(m => ({ ...m, date: item.date })));

        const playerAgg = new Map();
        const weekGroups = new Map();

        allMatches.forEach(m => {
            const wk = `${getWeekNumber(m.date)}-${new Date(m.date).getFullYear()}`;
            if (!weekGroups.has(wk)) weekGroups.set(wk, []);
            weekGroups.get(wk).push(m);

            (m.players || []).forEach(p => {
                const name = p.name || "未知";
                if (!playerAgg.has(name)) {
                    playerAgg.set(name, { name, kills:0, k4:0, k5:0 });
                }
                const s = playerAgg.get(name);
                s.kills += Number(p.k) || 0;
                s.k4 += Number(p.k4) || 0;
                s.k5 += Number(p.k5) || 0;
            });
        });

        const mvpCounts = new Map();
        const weeklyDetails = [];

        for (const [weekKey, weekMatches] of weekGroups) {
            const stats = new Map();
            weekMatches.forEach(m => {
                (m.players || []).forEach(p => {
                    const name = p.name || "未知";
                    if (!stats.has(name)) stats.set(name, { k:0, d:0, a:0, ratingSum:0, count:0 });
                    const s = stats.get(name);
                    s.k += Number(p.k) || 0;
                    s.d += Number(p.d) || 0;
                    s.a += Number(p.a) || 0;
                    s.ratingSum += Number(p.rating) || 0;
                    s.count++;
                });
            });

            let bestName = null, bestAvg = -1;
            const playerEntries = [];
            for (const [name, s] of stats) {
                const avg = s.ratingSum / s.count;
                playerEntries.push({
                    name,
                    avgRating: avg,
                    avgK: (s.k / s.count).toFixed(1),
                    avgD: (s.d / s.count).toFixed(1),
                    avgA: (s.a / s.count).toFixed(1),
                    matches: s.count
                });
                if (avg > bestAvg) { bestAvg = avg; bestName = name; }
            }
            if (bestName) {
                mvpCounts.set(bestName, (mvpCounts.get(bestName) || 0) + 1);
                const sampleDate = weekMatches[0].date;
                const monday = getWeekMonday(sampleDate);
                const sunday = getWeekSunday(sampleDate);
                const weekNum = weekKey.split("-")[0];
                const yearPrefix = monday.slice(0, 4) !== String(new Date().getFullYear()) ? monday.slice(0, 4) + "/" : "";
                weeklyDetails.push({
                    weekKey,
                    weekNumber: weekNum,
                    dateRange: `${yearPrefix}${monday.slice(5).replace("-","/")} - ${sunday.slice(5).replace("-","/")}`,
                    mvpName: bestName,
                    mvpAvgRating: bestAvg.toFixed(2),
                    players: playerEntries.sort((a, b) => b.avgRating - a.avgRating)
                });
            }
        }

        weeklyDetails.sort((a, b) => b.weekKey.localeCompare(a.weekKey));

        const rankings = [];
        for (const [name, agg] of playerAgg) {
            rankings.push({
                name,
                mvp: mvpCounts.get(name) || 0,
                k5: agg.k5,
                k4: agg.k4,
                kills: agg.kills
            });
        }
        return { rankings, weeklyDetails };
    }

    function sortRankings(rankings, field, desc){
        const sorted = [...rankings].sort((a, b) => {
            if (desc) return b[field] - a[field];
            return a[field] - b[field];
        });
        return sorted;
    }

    function getRankClass(index){
        if (index === 0) return "rank-1";
        if (index === 1) return "rank-2";
        if (index === 2) return "rank-3";
        return "";
    }

    function getRankDisplay(index){
        if (index === 0) return "🥇";
        if (index === 1) return "🥈";
        if (index === 2) return "🥉";
        return String(index + 1);
    }

    function setSort(field){
        if (currentSort === field) {
            sortDesc = !sortDesc;
        } else {
            currentSort = field;
            sortDesc = true;
        }
        renderTable();
    }

    function renderTable(){
        const elWrap = document.getElementById("tableWrap");
        const result = computeRankings(window._rawData || []);
        const rankings = result.rankings;
        if (!rankings.length) {
            elWrap.innerHTML = '<div class="empty">暂无战绩数据。</div>';
            renderWeeklyData(null);
            return;
        }

        const sorted = sortRankings(rankings, currentSort, sortDesc);

        const maxMvp = Math.max(...rankings.map(p => p.mvp), 0);
        const maxK5 = Math.max(...rankings.map(p => p.k5), 0);
        const maxK4 = Math.max(...rankings.map(p => p.k4), 0);
        const maxKills = Math.max(...rankings.map(p => p.kills), 0);

        function thHtml(label, field){
            const active = currentSort === field;
            return `<th class="${active ? "sorted" : ""}" data-sort="${field}">${label}<span class="sort-arrow">${active && sortDesc ? "▲" : "▼"}</span></th>`;
        }

        elWrap.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th class="rank-cell">#</th>
                        <th>玩家</th>
                        ${thHtml("MVP", "mvp")}
                        ${thHtml("5杀", "k5")}
                        ${thHtml("4杀", "k4")}
                        ${thHtml("总击杀", "kills")}
                    </tr>
                </thead>
                <tbody>
                    ${sorted.map((p, i) => `
                        <tr>
                            <td class="rank-cell ${getRankClass(i)}">${getRankDisplay(i)}</td>
                            <td class="player-name">${p.name}</td>
                            <td class="${p.mvp === maxMvp && maxMvp > 0 ? "stat-highlight" : ""}">${p.mvp}</td>
                            <td class="${p.k5 === maxK5 && maxK5 > 0 ? "stat-highlight" : ""}">${p.k5}</td>
                            <td class="${p.k4 === maxK4 && maxK4 > 0 ? "stat-highlight" : ""}">${p.k4}</td>
                            <td class="${p.kills === maxKills && maxKills > 0 ? "stat-highlight" : ""}">${p.kills}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;

        renderWeeklyData(result.weeklyDetails);
    }

    function renderWeeklyData(weeklyDetails){
        const elWrap = document.getElementById("weeklyWrap");
        if (!weeklyDetails || !weeklyDetails.length) {
            elWrap.innerHTML = "";
            return;
        }

        elWrap.innerHTML = `
            <div class="weekly-wrap">
                <h2>📋 每周评选数据</h2>
                <div style="font-size:12px;color:var(--muted);margin-bottom:10px">评选规则：取每周所有对局数据，按选手平均 Rating 排名，最高者当选本周 MVP。</div>
                ${weeklyDetails.map(w => `
                    <div class="weekly-block">
                        <div class="weekly-head">
                            <span>第 ${w.weekNumber} 周 · ${w.dateRange}</span>
                            <span class="mvp-badge">👑 MVP: ${w.mvpName}</span>
                        </div>
                        <table class="weekly-table">
                            <thead>
                                <tr>
                                    <th>排名</th>
                                    <th>玩家</th>
                                    <th>场次</th>
                                    <th>Rating</th>
                                    <th>K/D/A</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${w.players.map((p, i) => `
                                    <tr class="${p.name === w.mvpName ? "mvp-row" : ""}">
                                        <td>${i + 1}</td>
                                        <td>${p.name === w.mvpName ? `<span class="weekly-mvp-name">${p.name}</span>` : p.name}</td>
                                        <td>${p.matches}</td>
                                        <td class="rating-cell">${p.avgRating.toFixed(2)}</td>
                                        <td>${p.avgK}/${p.avgD}/${p.avgA}</td>
                                    </tr>
                                `).join("")}
                            </tbody>
                        </table>
                    </div>
                `).join("")}
            </div>
        `;
    }

    async function init(){
        initTheme();

        document.getElementById("backBtn").addEventListener("click", ()=>{
            location.href = "index.html";
        });

        document.getElementById("tableWrap").addEventListener("click", e => {
            const th = e.target.closest("th[data-sort]");
            if (th) setSort(th.dataset.sort);
        });

        try {
            const response = await fetch(REPORT_JSON_URL, { cache: "no-store" });
            if (!response.ok) throw new Error("load failed");
            window._rawData = await response.json();
        } catch (e) {
            console.warn("加载战绩数据失败:", e);
            window._rawData = null;
        }
        renderTable();

        const elScrollBtn = document.getElementById("scrollTopBtn");
        let scrollTimer;
        window.addEventListener("scroll", ()=>{
            if (window.scrollY > 300) {
                elScrollBtn.classList.add("show");
                clearTimeout(scrollTimer);
                scrollTimer = setTimeout(() => elScrollBtn.classList.remove("show"), 3000);
            } else {
                elScrollBtn.classList.remove("show");
            }
        });
        elScrollBtn.addEventListener("click", ()=>{
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }

    init();
