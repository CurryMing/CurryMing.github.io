
    const LS_THEME = "csgo-theme";
    const REPORT_JSON_URL = "assets/reports/daily-report.json";

    const elList = document.getElementById("list");
    const elEmpty = document.getElementById("empty");
    const elTrendBtn = document.getElementById("trendBtn");
    const elBackBtn = document.getElementById("backBtn");

    function locateFromQuery(){
        const params = new URLSearchParams(location.search);
        const date = params.get("date");
        const matchIndex = params.get("m");
        if (!date || !matchIndex) return;
        const target = document.querySelector(`.item[data-date="${date}"][data-match-index="${matchIndex}"]`);
        if (!target) return;
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.classList.add("located");
        setTimeout(() => target.classList.remove("located"), 1800);
    }

    function applyTheme(theme){
        const nextTheme = theme === "light" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", nextTheme);
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

    async function loadReportItems(){
        const response = await fetch(REPORT_JSON_URL, { cache: "no-store" });
        if (!response.ok) throw new Error("report json load failed");
        const raw = await response.json();
        const list = Array.isArray(raw && raw.reports) ? raw.reports : [];
        return list.flatMap((item) => {
                const date = String((item && item.date) || "").trim();
                const matches = Array.isArray(item && item.matches) ? item.matches : [];
                if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
                return matches.map((match, idx) => {
                    const players = Array.isArray(match && match.players) ? match.players : [];
                    const multikills = [];
                    players.forEach(p => {
                        const name = p.name || "";
                        const k4 = Number(p.k4) || 0;
                        const k5 = Number(p.k5) || 0;
                        if (k5 > 0) multikills.push({ name, type: "k5", count: k5 });
                        if (k4 > 0) multikills.push({ name, type: "k4", count: k4 });
                    });
                    const myRounds = Number(match && match.myRounds) || 0;
                    const enemyRounds = Number(match && match.enemyRounds) || 0;
                    const result = String((match && match.result) || (myRounds > enemyRounds ? "胜利" : (myRounds < enemyRounds ? "失败" : "平局")));
                    const myWin = myRounds > enemyRounds;
                    const enemyWin = enemyRounds > myRounds;
                    return {
                        date,
                        matchIndex: idx + 1,
                        scoreMy: String(myRounds).padStart(2, "0"),
                        scoreEnemy: String(enemyRounds).padStart(2, "0"),
                        myScoreClass: myWin ? "score-win" : (enemyWin ? "score-lose" : "score-draw"),
                        enemyScoreClass: "score-enemy",
                        result,
                        multikills,
                        sortOrder: idx + 1
                    };
                });
            })
            .sort((a, b) => {
                const byDate = b.date.localeCompare(a.date);
                if (byDate !== 0) return byDate;
                return a.sortOrder - b.sortOrder;
            });
    }

    function stripYear(dateStr){
        if (!dateStr) return dateStr;
        const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return dateStr;
        const thisYear = String(new Date().getFullYear());
        return m[1] === thisYear ? `${m[2]}-${m[3]}` : dateStr;
    }

    function renderItems(items){
        if (!items.length) {
            elList.innerHTML = "";
            elEmpty.hidden = false;
            return;
        }

        elEmpty.hidden = true;
        elList.innerHTML = items.map((item) => {
            const badges = item.multikills && item.multikills.length
                ? item.multikills.map(mk => {
                    const label = mk.type === "k5" ? `${mk.name} 5杀` : `${mk.name} 4杀`;
                    return `<span class="multi-badge ${mk.type}">${mk.type === "k5" ? "🔥" : "💥"}${label}</span>`;
                  }).join("")
                : "";
            return `
            <a class="item ${item.result === "胜利" ? "result-win" : (item.result === "失败" ? "result-lose" : "result-draw")}" data-date="${item.date}" data-match-index="${item.matchIndex}" href="daily-report.html?date=${encodeURIComponent(item.date)}&m=${item.matchIndex}">
                <div>
                    <div class="date">${stripYear(item.date)}${badges ? `<span class="multi-badges">${badges}</span>` : ""}</div>
                    <div class="meta"><span class="${item.myScoreClass}">${item.scoreMy}</span><span class="score-sep">:</span><span class="${item.enemyScoreClass}">${item.scoreEnemy}</span></div>
                </div>
                <div class="arrow">›</div>
            </a>`;
        }).join("");
    }

    elBackBtn.addEventListener("click", ()=>{
        location.href = "index.html";
    });

    elTrendBtn.addEventListener("click", ()=>{
        location.href = "rating-trend.html";
    });

    async function init(){
        initTheme();
        try {
            const items = await loadReportItems();
            renderItems(items);
            locateFromQuery();
        } catch (error) {
            console.warn("加载战绩列表失败:", error);
            renderItems([]);
        }
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
