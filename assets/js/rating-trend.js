
    const LS_THEME = "csgo-theme";
    const REPORT_JSON_URL = "assets/reports/daily-report.json";
    const COLORS = ["#40d3ff", "#ff8bb2", "#7fe4a8", "#ffc773", "#9aa8ff", "#e2a6ff", "#ffd166", "#66c2a5"];

    const elBackBtn = document.getElementById("backBtn");
    const elChartCard = document.getElementById("chartCard");
    const elLegend = document.getElementById("legend");
    const elEmpty = document.getElementById("empty");
    const elTooltip = document.getElementById("chartTooltip");
    const canvas = document.getElementById("ratingChart");
    const elChartWrap = canvas.parentElement;
    const ctx = canvas.getContext("2d");
    const chartState = {
        labels: [],
        valuesByPlayer: new Map(),
        hoverIndex: -1,
        hoverY: 0,
        xPositions: [],
        viewStart: 0,
        viewEnd: 0,
        visiblePlayers: new Set()
    };

    function drawFromState(){
        drawChart(chartState.labels, chartState.valuesByPlayer);
    }

    function getPlayerColor(name, valuesByPlayer){
        const source = valuesByPlayer || chartState.valuesByPlayer;
        const sorted = [...source.keys()].sort();
        const index = sorted.indexOf(name);
        return COLORS[(index < 0 ? 0 : index) % COLORS.length];
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

    async function loadReports(){
        const response = await fetch(REPORT_JSON_URL, { cache: "no-store" });
        if (!response.ok) throw new Error("report json load failed");
        const raw = await response.json();
        const reports = Array.isArray(raw && raw.reports) ? raw.reports : [];
        return reports
            .map(item => {
                const date = String((item && item.date) || "").trim();
                const matches = Array.isArray(item && item.matches) ? item.matches : [];
                return { date, matches };
            })
            .filter(item => /^\d{4}-\d{2}-\d{2}$/.test(item.date))
            .sort((a,b)=>a.date.localeCompare(b.date));
    }

    function buildSeries(reports){
        const timeline = [];
        const valuesByPlayer = new Map();
        reports.forEach(day => {
            day.matches.forEach((match, idx) => {
                const label = `${day.date}#${idx + 1}`;
                const players = Array.isArray(match && match.players) ? match.players : [];
                timeline.push({ label, players });
            });
        });

        timeline.forEach((point, pointIndex) => {
            const ratingsThisPoint = new Map();
            point.players.forEach(p => {
                ratingsThisPoint.set(String((p && p.name) || "未知玩家"), Number(p && p.rating) || 0);
            });

            const allPlayers = new Set([...valuesByPlayer.keys(), ...ratingsThisPoint.keys()]);
            allPlayers.forEach(name => {
                if (!valuesByPlayer.has(name)) {
                    valuesByPlayer.set(name, Array(pointIndex).fill(null));
                }
                valuesByPlayer.get(name).push(ratingsThisPoint.has(name) ? ratingsThisPoint.get(name) : null);
            });
        });

        return { labels: timeline.map(p => p.label), valuesByPlayer };
    }

    function drawChart(labels, valuesByPlayer){
        const ratio = Math.max(1, window.devicePixelRatio || 1);
        const rect = canvas.getBoundingClientRect();
        canvas.width = Math.floor(rect.width * ratio);
        canvas.height = Math.floor(rect.height * ratio);
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

        const width = rect.width;
        const height = rect.height;
        const padding = { top: 16, right: 18, bottom: 36, left: 40 };
        const innerW = width - padding.left - padding.right;
        const innerH = height - padding.top - padding.bottom;

        if (!labels.length) return;
        const start = Math.max(0, Math.min(chartState.viewStart, labels.length - 1));
        const end = Math.max(start, Math.min(chartState.viewEnd, labels.length - 1));
        const visibleIndices = [];
        for (let i = start; i <= end; i++) visibleIndices.push(i);
        if (!visibleIndices.length) return;

        const sortedPlayers = [...valuesByPlayer.keys()].sort();
        const activePlayers = sortedPlayers.filter(name => chartState.visiblePlayers.has(name));
        const allValues = activePlayers
            .flatMap(name => visibleIndices.map(i => valuesByPlayer.get(name)[i]))
            .filter(v => typeof v === "number");
        if (!allValues.length) {
            ctx.clearRect(0, 0, width, height);
            chartState.xPositions = [];
            return;
        }
        let minY = Math.min(...allValues);
        let maxY = Math.max(...allValues);
        if (minY === maxY) { minY -= 0.2; maxY += 0.2; }
        minY = Math.floor((minY - 0.05) * 10) / 10;
        maxY = Math.ceil((maxY + 0.05) * 10) / 10;

        const visibleCount = visibleIndices.length;
        const toX = (localIndex) => visibleCount <= 1 ? padding.left + innerW / 2 : padding.left + (localIndex / (visibleCount - 1)) * innerW;
        const toY = (v) => padding.top + (1 - ((v - minY) / (maxY - minY))) * innerH;

        ctx.clearRect(0, 0, width, height);
        const gridColor = getComputedStyle(document.documentElement).getPropertyValue("--grid").trim() || "#2a3240";
        const textColor = getComputedStyle(document.documentElement).getPropertyValue("--muted").trim() || "#9aa4b2";

        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        const gridSteps = 5;
        for (let s = 0; s <= gridSteps; s++) {
            const y = padding.top + (s / gridSteps) * innerH;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + innerW, y);
            ctx.stroke();

            const val = (maxY - ((maxY - minY) * s / gridSteps)).toFixed(2);
            ctx.fillStyle = textColor;
            ctx.font = "12px Segoe UI";
            ctx.textAlign = "right";
            ctx.textBaseline = "middle";
            ctx.fillText(val, padding.left - 6, y);
        }

        const xPositions = visibleIndices.map((globalIndex, localIndex) => ({ globalIndex, x: toX(localIndex) }));
        activePlayers.forEach((name) => {
            const color = getPlayerColor(name, valuesByPlayer);
            const values = valuesByPlayer.get(name);
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            let started = false;
            visibleIndices.forEach((globalIndex, localIndex) => {
                const v = values[globalIndex];
                if (v == null) {
                    started = false;
                    return;
                }
                const x = toX(localIndex);
                const y = toY(v);
                if (!started) {
                    ctx.moveTo(x, y);
                    started = true;
                } else {
                    ctx.lineTo(x, y);
                }
            });
            ctx.stroke();

            ctx.fillStyle = color;
            visibleIndices.forEach((globalIndex, localIndex) => {
                const v = values[globalIndex];
                if (v == null) return;
                const x = toX(localIndex);
                const y = toY(v);
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fill();
            });
        });

        if (chartState.hoverIndex >= start && chartState.hoverIndex <= end) {
            const foundX = xPositions.find(item => item.globalIndex === chartState.hoverIndex);
            const hoverX = foundX ? foundX.x : null;
            if (hoverX !== null) {

                ctx.save();
                ctx.strokeStyle = "rgba(120, 170, 220, .55)";
                ctx.lineWidth = 1;
                ctx.setLineDash([5, 4]);
                ctx.beginPath();
                ctx.moveTo(hoverX, padding.top);
                ctx.lineTo(hoverX, padding.top + innerH);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(padding.left, chartState.hoverY);
                ctx.lineTo(padding.left + innerW, chartState.hoverY);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.restore();

                activePlayers.forEach((name) => {
                    const value = valuesByPlayer.get(name)[chartState.hoverIndex];
                    if (value == null) return;
                    const color = getPlayerColor(name, valuesByPlayer);
                    const y = toY(value);
                    ctx.beginPath();
                    ctx.arc(hoverX, y, 4.5, 0, Math.PI * 2);
                    ctx.fillStyle = color;
                    ctx.fill();
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = "rgba(255,255,255,.9)";
                    ctx.stroke();
                });
            }
        }

        chartState.labels = labels;
        chartState.valuesByPlayer = valuesByPlayer;
        chartState.xPositions = xPositions;

        ctx.fillStyle = textColor;
        ctx.font = "11px Segoe UI";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const labelStep = visibleCount > 12 ? Math.ceil(visibleCount / 12) : 1;
        visibleIndices.forEach((globalIndex, localIndex) => {
            if (visibleCount > 12 && localIndex % labelStep !== 0 && localIndex !== visibleCount - 1) return;
            const x = toX(localIndex);
            ctx.fillText(String(globalIndex + 1), x, padding.top + innerH + 8);
        });

        chartState.xPositions = xPositions;
    }

    function renderLegend(valuesByPlayer){
        const names = [...valuesByPlayer.keys()].sort();
        elLegend.innerHTML = names.map((name, idx) => `
            <span class="legend-item ${chartState.visiblePlayers.has(name) ? "" : "off"}" data-player="${name}"><span class="legend-dot" style="background:${getPlayerColor(name, valuesByPlayer)}"></span>${name}</span>
        `).join("");
    }

    function hideTooltip(){
        if (!elTooltip) return;
        elTooltip.classList.remove("show");
    }

    function stripYear(dateStr){
        if (!dateStr) return dateStr;
        const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return dateStr;
        const thisYear = String(new Date().getFullYear());
        return m[1] === thisYear ? `${m[2]}-${m[3]}` : dateStr;
    }

    function parseLabel(label){
        const parts = String(label || "").split("#");
        return {
            date: parts[0] || "",
            matchIndex: parts[1] || "1"
        };
    }

    function showTooltipByIndex(globalIndex, mouseX, mouseY){
        if (!elTooltip || !elChartWrap) return;
        const label = chartState.labels[globalIndex] || "";
        const parsed = parseLabel(label);
        const names = [...chartState.valuesByPlayer.keys()].filter(name => chartState.visiblePlayers.has(name)).sort();
        const rows = names
            .map((name) => {
                const rating = chartState.valuesByPlayer.get(name)[globalIndex];
                if (rating == null) return "";
                const color = getPlayerColor(name, chartState.valuesByPlayer);
                return `<div class="tooltip-row"><span class="tooltip-name"><span class="tooltip-dot" style="background:${color}"></span>${name}</span><span class="tooltip-val">${Number(rating).toFixed(2)}</span></div>`;
            })
            .join("");
        elTooltip.innerHTML = `
            <div class="tooltip-title">对局详情</div>
            <div class="tooltip-sub">${stripYear(parsed.date)} · 对局 ${parsed.matchIndex}</div>
            ${rows || `<div class="tooltip-rating">无数据</div>`}
        `;

        const wrapRect = elChartWrap.getBoundingClientRect();
        const offsetX = mouseX - wrapRect.left;
        const offsetY = mouseY - wrapRect.top;
        const tooltipWidth = 172;
        const tooltipHeight = 72;

        let left = offsetX + 14;
        let top = offsetY - tooltipHeight - 10;
        if (left + tooltipWidth > wrapRect.width - 6) left = wrapRect.width - tooltipWidth - 6;
        if (left < 6) left = 6;
        if (top < 6) top = offsetY + 12;

        elTooltip.style.left = `${left}px`;
        elTooltip.style.top = `${top}px`;
        elTooltip.classList.add("show");
    }

    function bindTooltipEvents(){
        canvas.addEventListener("mousemove", (e) => {
            if (!chartState.xPositions.length) return hideTooltip();
            const x = e.offsetX;
            const y = e.offsetY;

            let nearest = null;
            let nearestDist = Infinity;
            chartState.xPositions.forEach((point) => {
                const d = Math.abs(point.x - x);
                if (d < nearestDist) {
                    nearestDist = d;
                    nearest = point;
                }
            });

            if (!nearest || nearestDist > 24) {
                chartState.hoverIndex = -1;
                drawFromState();
                hideTooltip();
                return;
            }

            chartState.hoverIndex = nearest.globalIndex;
            chartState.hoverY = y;
            drawFromState();
            showTooltipByIndex(nearest.globalIndex, e.clientX, e.clientY);
        });

        canvas.addEventListener("mouseleave", () => {
            chartState.hoverIndex = -1;
            drawFromState();
            hideTooltip();
        });
        window.addEventListener("resize", hideTooltip);

        canvas.addEventListener("wheel", (e) => {
            if (!chartState.labels.length || !chartState.xPositions.length) return;
            e.preventDefault();
            const total = chartState.labels.length;
            const currentWindow = chartState.viewEnd - chartState.viewStart + 1;
            const minWindow = Math.min(4, total);
            const maxWindow = total;

            const zoomIn = e.deltaY < 0;
            const factor = zoomIn ? 0.84 : 1.2;
            let nextWindow = Math.round(currentWindow * factor);
            nextWindow = Math.max(minWindow, Math.min(maxWindow, nextWindow));
            if (nextWindow === currentWindow) return;

            const x = e.offsetX;
            let nearest = chartState.xPositions[0];
            let nearestDist = Infinity;
            chartState.xPositions.forEach((p) => {
                const d = Math.abs(p.x - x);
                if (d < nearestDist) {
                    nearestDist = d;
                    nearest = p;
                }
            });

            const anchor = nearest.globalIndex;
            const ratio = currentWindow <= 1 ? 0.5 : (anchor - chartState.viewStart) / (currentWindow - 1);
            let nextStart = Math.round(anchor - ratio * (nextWindow - 1));
            nextStart = Math.max(0, Math.min(total - nextWindow, nextStart));
            chartState.viewStart = nextStart;
            chartState.viewEnd = nextStart + nextWindow - 1;

            chartState.hoverIndex = -1;
            hideTooltip();
            drawFromState();
        }, { passive: false });

        elLegend.addEventListener("click", (e) => {
            const item = e.target.closest("[data-player]");
            if (!item) return;
            const player = item.dataset.player;
            if (!player) return;
            if (chartState.visiblePlayers.has(player)) chartState.visiblePlayers.delete(player);
            else chartState.visiblePlayers.add(player);

            if (!chartState.visiblePlayers.size) {
                chartState.visiblePlayers.add(player);
            }

            renderLegend(chartState.valuesByPlayer);
            chartState.hoverIndex = -1;
            hideTooltip();
            drawFromState();
        });
    }

    async function init(){
        initTheme();
        try {
            const reports = await loadReports();
            const { labels, valuesByPlayer } = buildSeries(reports);
            if (!labels.length || !valuesByPlayer.size) {
                elChartCard.hidden = true;
                elEmpty.hidden = false;
                return;
            }

            elEmpty.hidden = true;
            elChartCard.hidden = false;
            chartState.labels = labels;
            chartState.valuesByPlayer = valuesByPlayer;
            chartState.viewStart = 0;
            chartState.viewEnd = labels.length - 1;
            chartState.visiblePlayers = new Set([...valuesByPlayer.keys()]);
            drawFromState();
            renderLegend(valuesByPlayer);
            window.addEventListener("resize", drawFromState);
            bindTooltipEvents();
        } catch (error) {
            console.warn("加载 rating 走势失败:", error);
            elChartCard.hidden = true;
            elEmpty.hidden = false;
        }
    }

    elBackBtn.addEventListener("click", ()=>{
        location.href = "report-list.html";
    });

    init();
