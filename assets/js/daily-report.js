
    const LS_THEME = "csgo-theme";
    const REPORT_JSON_URL = "assets/reports/daily-report.json";
    const FALLBACK_REPORTS = [
        {
            date: "2026-05-24",
            matches: [
                {
                    myRounds: 13,
                    enemyRounds: 10,
                    result: "胜利",
                    players: [
                        { name: "我", k: 23, d: 17, a: 8, rating: 1.34 },
                        { name: "阿明", k: 18, d: 19, a: 7, rating: 1.02 },
                        { name: "小白", k: 15, d: 16, a: 11, rating: 0.98 }
                    ]
                },
                {
                    myRounds: 11,
                    enemyRounds: 13,
                    result: "失败",
                    players: [
                        { name: "我", k: 25, d: 20, a: 7, rating: 1.11 },
                        { name: "阿明", k: 16, d: 19, a: 8, rating: 0.93 },
                        { name: "小白", k: 14, d: 18, a: 10, rating: 0.89 }
                    ]
                }
            ]
        },
        {
            date: "2026-05-25",
            matches: [
                {
                    myRounds: 8,
                    enemyRounds: 13,
                    result: "失败",
                    players: [
                        { name: "我", k: 27, d: 14, a: 6, rating: 1.48 },
                        { name: "阿明", k: 21, d: 18, a: 5, rating: 1.12 },
                        { name: "小白", k: 16, d: 20, a: 9, rating: 0.94 }
                    ]
                }
            ]
        },
        {
            date: "2026-05-26",
            matches: [
                {
                    myRounds: 13,
                    enemyRounds: 11,
                    result: "胜利",
                    players: [
                        { name: "我", k: 19, d: 13, a: 10, rating: 1.29 },
                        { name: "阿明", k: 17, d: 15, a: 8, rating: 1.08 },
                        { name: "小白", k: 14, d: 16, a: 12, rating: 1.01 }
                    ]
                },
                {
                    myRounds: 13,
                    enemyRounds: 6,
                    result: "胜利",
                    players: [
                        { name: "我", k: 22, d: 9, a: 6, rating: 1.52 },
                        { name: "阿明", k: 18, d: 11, a: 7, rating: 1.23 },
                        { name: "小白", k: 15, d: 12, a: 9, rating: 1.09 }
                    ]
                }
            ]
        }
    ];
    let reports = [];
    let reportByDate = new Map();

    const elDate = document.getElementById("reportDate");
    const elWrap = document.getElementById("tableWrap");
    const elBackBtn = document.getElementById("backBtn");

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

    function normalizeReports(raw){
        const list = Array.isArray(raw) ? raw : (Array.isArray(raw && raw.reports) ? raw.reports : []);
        function normalizeMatch(match, legacyItem){
            const source = match || legacyItem || {};
            const players = Array.isArray(source.players) ? source.players : [];
            const myRounds = Number(source.myRounds);
            const enemyRounds = Number(source.enemyRounds);
            const normalizedMyRounds = Number.isFinite(myRounds) ? myRounds : 0;
            const normalizedEnemyRounds = Number.isFinite(enemyRounds) ? enemyRounds : 0;
            const inferredResult = normalizedMyRounds > normalizedEnemyRounds ? "胜利" : (normalizedMyRounds < normalizedEnemyRounds ? "失败" : "平局");
            return {
                myRounds: normalizedMyRounds,
                enemyRounds: normalizedEnemyRounds,
                result: String(source.result || inferredResult),
                players: players.map((p) => ({
                    name: String((p && p.name) || "未知玩家"),
                    k: Number(p && p.k) || 0,
                    d: Number(p && p.d) || 0,
                    a: Number(p && p.a) || 0,
                    rating: Number(p && p.rating) || 0,
                    k4: Number(p && p.k4) || 0,
                    k5: Number(p && p.k5) || 0
                }))
            };
        }

        return list
            .map((item) => {
                const rawMatches = Array.isArray(item && item.matches) ? item.matches : null;
                const normalizedMatches = (rawMatches && rawMatches.length)
                    ? rawMatches.map((match) => normalizeMatch(match, item))
                    : [normalizeMatch(item, item)];
                return {
                    date: String((item && item.date) || "").trim(),
                    matches: normalizedMatches
                };
            })
            .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.date));
    }

    async function loadReports(){
        try {
            const response = await fetch(REPORT_JSON_URL, { cache: "no-store" });
            if (!response.ok) throw new Error("report json load failed");
            const raw = await response.json();
            reports = normalizeReports(raw);
            if (!reports.length) throw new Error("report json empty");
        } catch (error) {
            console.warn("读取战绩 JSON 失败，使用内置示例数据:", error);
            reports = normalizeReports(FALLBACK_REPORTS);
        }
        reportByDate = new Map(reports.map((item) => [item.date, item]));
    }

    function renderReport(){
        const report = reportByDate.get(elDate.value);
        if (!report || !Array.isArray(report.matches) || !report.matches.length) {
            elWrap.innerHTML = `<div class="empty">该日期暂无战绩数据。</div>`;
            return;
        }

        elWrap.innerHTML = report.matches.map((match, idx) => {
                    const myWin = match.myRounds > match.enemyRounds;
                    const enemyWin = match.enemyRounds > match.myRounds;
                    const isDraw = !myWin && !enemyWin;
                    const headClass = myWin ? "bg-win" : (enemyWin ? "bg-lose" : "bg-draw");
                    const myScoreClass = myWin ? "score-win" : (enemyWin ? "score-lose" : "score-draw");
                    const enemyScoreClass = "score-enemy";
                    const myRoundsText = String(match.myRounds).padStart(2, "0");
                    const enemyRoundsText = String(match.enemyRounds).padStart(2, "0");
                    const matchMultikills = [];
                    (match.players || []).forEach(p => {
                        if (Number(p.k5) > 0) matchMultikills.push(`<span class="multi-badge k5">🔥${p.name} 5杀</span>`);
                        if (Number(p.k4) > 0) matchMultikills.push(`<span class="multi-badge k4">💥${p.name} 4杀</span>`);
                    });
                    const matchScoreHtml = `<span class="${myScoreClass}">${myRoundsText}</span><span class="match-score-sep">:</span><span class="${enemyScoreClass}">${enemyRoundsText}</span>`;
                    const matchScoreWithBadges = matchMultikills.length
                        ? `${matchScoreHtml}<span class="multi-badges">${matchMultikills.join("")}</span>`
                        : matchScoreHtml;
                    return `
                    <section class="report-match" data-match-index="${idx + 1}">
                        <div class="match-head ${headClass}">
                            <div class="match-summary">
                                <div class="match-score">${matchScoreWithBadges}</div>
                            </div>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>姓名</th>
                                    <th>K/D/A</th>
                                    <th>Rating</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${[...match.players].sort((a, b) => b.rating - a.rating).map(p => `
                                    <tr>
                                        <td>${p.name}</td>
                                        <td>${p.k}/${p.d}/${p.a}</td>
                                        <td class="${Number(p.rating) >= 1 ? "rating-good" : "rating-bad"}">${Number(p.rating).toFixed(2)}</td>
                                    </tr>
                                `).join("")}
                            </tbody>
                        </table>
                    </section>`;
                }).join("");

        const matchParam = Number(new URLSearchParams(location.search).get("m"));
        if (Number.isFinite(matchParam) && matchParam > 0) {
            const target = elWrap.querySelector(`.report-match[data-match-index="${matchParam}"]`);
            if (target) {
                target.scrollIntoView({ behavior: "smooth", block: "center" });
                target.classList.add("located");
                setTimeout(() => target.classList.remove("located"), 1800);
            }
        }
    }

    function initDate(){
        const dates = reports.map(item => item.date).sort();
        const today = new Date().toISOString().slice(0, 10);
        const queryDate = new URLSearchParams(location.search).get("date");
        if (queryDate && reportByDate.has(queryDate)) {
            elDate.value = queryDate;
        } else {
            elDate.value = reportByDate.has(today) ? today : (dates[dates.length - 1] || "");
        }
        elDate.addEventListener("change", renderReport);
        renderReport();
    }

    elBackBtn.addEventListener("click", ()=>{
        const matchParam = new URLSearchParams(location.search).get("m");
        const dateValue = elDate.value;
        const params = new URLSearchParams();
        if (dateValue) params.set("date", dateValue);
        if (matchParam) params.set("m", matchParam);
        location.href = `report-list.html?${params.toString()}`;
    });

    async function init(){
        initTheme();
        await loadReports();
        initDate();
    }

    init();



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
