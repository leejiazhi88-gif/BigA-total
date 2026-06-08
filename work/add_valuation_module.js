const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(ROOT, "outputs", "a_share_20y_dashboard.html");
const VALUATION_DATA_FILE = path.join(ROOT, "work", "valuation_data.json");
const START_MARKER = "<!-- VALUATION_MODULE_START -->";
const END_MARKER = "<!-- VALUATION_MODULE_END -->";

function stripExistingModule(html) {
  html = html.replace(/\s*<!-- VALUATION_MODULE_(?:START|END) -->/g, "");
  html = html.replace(/\s*<nav class="page-nav"[\s\S]*?<\/nav>/g, "");
  html = html.replace(/\s*<section class="module-shell" id="valuation">[\s\S]*?<\/section>/g, "");
  html = html.replace(/\s*<style id="valuation-module-style">[\s\S]*?<\/style>/g, "");
  html = html.replace(/\s*<script id="valuation-module-script">[\s\S]*?<\/script>/g, "");
  html = html.replace('<main class="wrap" id="overview">', '<main class="wrap">');
  return html;
}

const css = `
  <style id="valuation-module-style">
    .page-nav {
      position: sticky; top: 0; z-index: 20; display: flex; gap: 8px;
      width: fit-content; margin: 0 0 20px; padding: 6px;
      border: 1px solid var(--line); border-radius: 12px;
      background: rgba(7,17,31,.9); backdrop-filter: blur(12px);
    }
    .page-nav a {
      color: var(--muted); padding: 8px 14px; border-radius: 8px;
      text-decoration: none; font-size: 13px; font-weight: 700;
    }
    .page-nav a:hover, .page-nav a.active { color: #07111f; background: var(--accent); }
    .module-shell { margin-top: 54px; scroll-margin-top: 72px; }
    .module-head {
      display: flex; justify-content: space-between; align-items: flex-end;
      gap: 18px; margin-bottom: 16px;
    }
    .module-kicker {
      color: var(--accent); font-size: 12px; font-weight: 800;
      letter-spacing: .16em; text-transform: uppercase;
    }
    .module-head h2 { margin: 7px 0 5px; font-size: 30px; }
    .module-head p { margin: 0; color: var(--muted); font-size: 13px; }
    .module-status {
      color: var(--muted); border: 1px solid var(--line); border-radius: 999px;
      padding: 7px 11px; font-size: 11px; white-space: nowrap;
    }
    .valuation-grid {
      display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(330px, .85fr);
      gap: 15px; align-items: stretch;
    }
    .valuation-panel {
      min-width: 0; overflow: hidden; border: 1px solid var(--line);
      border-radius: 15px; background: rgba(9,20,34,.94);
    }
    .panel-head {
      min-height: 70px; display: flex; justify-content: space-between;
      align-items: center; gap: 14px; padding: 14px 16px;
      border-bottom: 1px solid var(--line); background: rgba(13,25,41,.9);
    }
    .panel-title { font-size: 15px; font-weight: 800; }
    .panel-subtitle { color: var(--muted); font-size: 11px; margin-top: 4px; }
    .metric-tabs { display: flex; gap: 7px; flex-wrap: wrap; padding: 13px 15px 0; }
    .metric-tab { padding: 7px 10px; font-size: 12px; }
    .metric-tab[disabled] {
      cursor: not-allowed; opacity: .42; color: var(--muted);
      background: #101c2d; border-color: #203149;
    }
    .metric-tab[disabled]:hover { color: var(--muted); background: #101c2d; border-color: #203149; }
    .metric-note { color: var(--muted); font-size: 11px; padding: 9px 16px 0; }
    #valuationChart { height: 510px; width: 100%; }
    .event-controls { display: flex; gap: 8px; }
    .event-select {
      color: var(--text); background: #132239; border: 1px solid #2b4261;
      border-radius: 8px; padding: 7px 9px; outline: none;
    }
    .event-body { height: 510px; overflow: auto; padding: 16px; }
    .quarter-summary {
      display: flex; justify-content: space-between; gap: 12px; align-items: center;
      margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--line);
    }
    .quarter-label { font-size: 20px; font-weight: 800; }
    .event-count { color: var(--muted); font-size: 11px; }
    .event-list { list-style: none; padding: 0; margin: 0; }
    .event-item {
      position: relative; margin: 0 0 10px; padding: 12px 12px 12px 34px;
      border: 1px solid #203149; border-radius: 11px; background: #0e1b2d;
      line-height: 1.55;
    }
    .event-item::before {
      content: ""; position: absolute; left: 15px; top: 18px;
      width: 7px; height: 7px; border-radius: 50%; background: var(--accent);
      box-shadow: 0 0 0 4px rgba(246,200,95,.11);
    }
    .event-type { color: var(--accent); font-size: 10px; font-weight: 800; letter-spacing: .08em; }
    .event-title { margin-top: 3px; font-size: 13px; font-weight: 700; }
    .event-desc { color: var(--muted); font-size: 11px; margin-top: 5px; }
    .event-empty {
      display: grid; place-items: center; min-height: 300px; color: var(--muted);
      text-align: center; line-height: 1.8; border: 1px dashed #2a405c; border-radius: 12px;
    }
    .valuation-foot {
      display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;
    }
    @media (max-width: 1050px) {
      .valuation-grid { grid-template-columns: 1fr; }
      .event-body { height: auto; min-height: 380px; }
    }
    @media (max-width: 620px) {
      .module-head, .panel-head { align-items: flex-start; flex-direction: column; }
      .valuation-foot { grid-template-columns: 1fr; }
      #valuationChart { height: 460px; }
    }
  </style>
`;

const nav = `
${START_MARKER}
  <nav class="page-nav" aria-label="研究模块导航">
    <a href="#overview" class="active">总览</a>
    <a href="#valuation">估值</a>
  </nav>
`;

const moduleHtml = `
  <section class="module-shell" id="valuation">
    <div class="module-head">
      <div>
        <div class="module-kicker">Module 01 / Valuation</div>
        <h2>估值</h2>
        <p>把连续数据与离散事件放在同一时间框架中，观察顶部阶段的估值扩张与叙事变化。</p>
      </div>
      <div class="module-status">PE 20年 / PB与股债收益差 10年</div>
    </div>

    <div class="valuation-grid">
      <article class="valuation-panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">连续走势图</div>
            <div class="panel-subtitle" id="valuationMetricSubtitle">上证与深证 PE(TTM)，周频展示</div>
          </div>
          <div class="legend">
            <span><i class="dot" style="background:var(--sh)"></i>上证</span>
            <span><i class="dot" style="background:var(--sz)"></i>深证</span>
          </div>
        </div>
        <div class="metric-tabs" id="valuationMetricTabs">
          <button class="metric-tab active" data-metric="pe">PE(TTM)</button>
          <button class="metric-tab" data-metric="pePercentile">PE历史分位</button>
          <button class="metric-tab" data-metric="pbPercentile">PB可得历史分位</button>
          <button class="metric-tab" data-metric="equityBondSpread">股债收益差</button>
          <button class="metric-tab" disabled title="待接入全市场个股截面数据">行业分位 / 高估值占比</button>
        </div>
        <div class="metric-note">股债收益差 = 股票盈利收益率（100/PE）− 10年期国债收益率；数值越低，股市相对债券的估值补偿越薄。</div>
        <div id="valuationChart"></div>
      </article>

      <aside class="valuation-panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">估值事件 List</div>
            <div class="panel-subtitle">按年份和季度切换，方便横向复盘</div>
          </div>
          <div class="event-controls">
            <select id="eventYear" class="event-select" aria-label="事件年份"></select>
            <select id="eventQuarter" class="event-select" aria-label="事件季度">
              <option value="Q1">Q1</option><option value="Q2">Q2</option>
              <option value="Q3">Q3</option><option value="Q4">Q4</option>
            </select>
          </div>
        </div>
        <div class="event-body">
          <div class="quarter-summary">
            <div class="quarter-label" id="eventPeriod"></div>
            <div class="event-count" id="eventCount"></div>
          </div>
          <ul class="event-list" id="valuationEventList"></ul>
        </div>
      </aside>
    </div>

    <div class="valuation-foot">
      <div class="note"><strong>连续数据口径：</strong>PE(TTM)为2006年以来序列；PB来自Tushare指数每日指标，国债采用中债10年期到期收益率，两者共同可得区间为2016年6月以来。分位均按各指标实际可得样本计算。</div>
      <div class="note"><strong>事件库口径：</strong>记录盈利预警、业绩不及预期、重大减持、IPO定价过热与热门公司估值破纪录等事件。当前为结构与典型样例，后续逐季度补齐来源和公司明细。</div>
    </div>
  </section>
${END_MARKER}
`;

const js = `
  <script id="valuation-module-script">
  (() => {
    const valuationExtra = __VALUATION_EXTRA__;
    function addPercentile(rows) {
      const sorted = rows.map(row => row.pe).filter(Number.isFinite).sort((a, b) => a - b);
      return rows.map(row => {
        let low = 0, high = sorted.length;
        while (low < high) {
          const mid = (low + high) >> 1;
          if (sorted[mid] <= row.pe) low = mid + 1; else high = mid;
        }
        return { ...row, pePercentile: low / sorted.length * 100 };
      });
    }
    const valuationData = { sh: addPercentile(DATA.sh), sz: addPercentile(DATA.sz) };
    const extraByDate = {
      sh: new Map(valuationExtra.sh.map(row => [row.date, row])),
      sz: new Map(valuationExtra.sz.map(row => [row.date, row]))
    };
    const eventData = {
      "2007-Q3": [
        { type: "估值升温", title: "指数估值进入历史高位区间", desc: "市场上涨速度明显快于盈利点数增长，估值扩张成为主要推动力。" },
        { type: "IPO热度", title: "大型IPO与热门新股受到集中追捧", desc: "新股定价、首日表现和热门公司估值成为观察风险偏好的重要窗口。" }
      ],
      "2007-Q4": [
        { type: "估值纪录", title: "上证PE在顶部阶段维持极高水平", desc: "价格创新高后，估值仍处在完整样本的极端区域。" },
        { type: "热门公司", title: "超级大盘热门公司上市强化高估值叙事", desc: "市场对稀缺性、成长空间和指数权重的定价明显乐观。" }
      ],
      "2009-Q3": [
        { type: "估值修复", title: "刺激政策后的快速反弹推高估值", desc: "盈利修复尚未完全确认时，价格与风险偏好率先上行。" }
      ],
      "2015-Q2": [
        { type: "估值升温", title: "成长与主题板块估值快速扩张", desc: "高估值股票数量增加，热门公司估值与融资叙事互相强化。" },
        { type: "业绩落差", title: "部分热门公司业绩难以匹配估值", desc: "业绩不及预期开始成为高估值板块的重要下行触发因素。" },
        { type: "减持风险", title: "高位减持与融资安排受到关注", desc: "产业资本行为成为判断估值可持续性的辅助信号。" }
      ],
      "2018-Q1": [
        { type: "结构高估", title: "少数核心资产估值与市场整体分化", desc: "指数整体估值不极端，但机构集中持有的热门公司定价偏高。" }
      ],
      "2020-Q3": [
        { type: "IPO定价", title: "注册制环境下热门新股估值受到关注", desc: "新经济公司定价与上市后表现成为市场风险偏好的观察项。" }
      ],
      "2021-Q1": [
        { type: "估值纪录", title: "核心资产与热门赛道估值处于高位", desc: "机构集中持仓、盈利外推和低利率叙事共同支撑高估值。" },
        { type: "业绩验证", title: "市场开始提高对盈利兑现速度的要求", desc: "估值高位时，小幅业绩偏差也可能带来较大价格波动。" }
      ],
      "2022-Q2": [
        { type: "盈利预警", title: "疫情与成本压力提高盈利预测不确定性", desc: "盈利预期下修使单看静态PE容易低估真实估值压力。" }
      ],
      "2024-Q3": [
        { type: "估值修复", title: "政策预期推动风险偏好快速修复", desc: "价格短期上行速度快于盈利变化，估值分位明显抬升。" }
      ],
      "2024-Q4": [
        { type: "结构分化", title: "热门主题估值扩张与传统行业分化", desc: "应结合行业估值分位和高估值股票占比判断局部过热。" }
      ],
      "2025-Q3": [
        { type: "估值升温", title: "深市估值分位持续抬升", desc: "成长板块风险偏好增强，深证PE上行速度高于上证。" }
      ],
      "2026-Q2": [
        { type: "当前观察", title: "上证与深证估值均处于20年较高分位", desc: "截至2026年6月5日，上证PE约17.17倍、深证PE约35.88倍，需继续观察盈利能否跟上价格。" }
      ]
    };

    const valuationChart = echarts.init(document.getElementById("valuationChart"), null, { renderer: "canvas" });
    let activeMetric = "pe";
    const metricConfig = {
      pe: { title: "PE(TTM)", subtitle: "上证与深证 PE(TTM)，周频展示", unit: "x" },
      pePercentile: { title: "PE历史分位", subtitle: "各时点相对完整20年样本的位置", unit: "%", fixedRange: true },
      pbPercentile: { title: "PB可得历史分位", subtitle: "指数市净率相对2016年6月以来样本的位置", unit: "%", fixedRange: true, extra: true },
      equityBondSpread: { title: "股债收益差", subtitle: "2016年6月以来：盈利收益率减10年期国债收益率", unit: "%", extra: true }
    };
    function valuationPoints(market, field) {
      if (metricConfig[field].extra) {
        return valuationExtra[market].map(row => [row.date, row[field]]);
      }
      return valuationData[market].map(row => [row.date, row[field]]);
    }
    function renderValuationChart() {
      const cfg = metricConfig[activeMetric];
      document.getElementById("valuationMetricSubtitle").textContent = cfg.subtitle;
      valuationChart.setOption({
        animation: false,
        backgroundColor: "transparent",
        grid: { left: 66, right: 28, top: 42, bottom: 64 },
        tooltip: {
          trigger: "axis", axisPointer: { type: "cross" },
          backgroundColor: "rgba(7,17,31,.96)", borderColor: "#36506f",
          textStyle: { color: "#edf4ff" },
          formatter(params) {
            const lines = params.map(p => p.marker + p.seriesName + "：<b>" +
              Number(p.value[1]).toFixed(2) + cfg.unit + "</b>");
            return "<b>" + (params[0]?.axisValueLabel || "") + "</b><br>" + lines.join("<br>");
          }
        },
        legend: { show: false },
        xAxis: {
          type: "time", axisLine: { lineStyle: { color: "#344760" } },
          axisLabel: { color: "#7890aa", hideOverlap: true }, splitLine: { show: false }
        },
        yAxis: {
          type: "value", scale: activeMetric === "pe",
          min: cfg.fixedRange ? 0 : undefined,
          max: cfg.fixedRange ? 100 : undefined,
          axisLabel: { color: "#7890aa", formatter: "{value}" + cfg.unit },
          splitLine: { lineStyle: { color: "#17283d" } }
        },
        dataZoom: [
          { type: "inside", filterMode: "none", start: 0, end: 100 },
          { type: "slider", bottom: 12, height: 22, borderColor: "#263b58",
            backgroundColor: "#0d1929", fillerColor: "rgba(246,200,95,.18)",
            handleStyle: { color: "#f6c85f" }, textStyle: { color: "#8fa5bf" } }
        ],
        series: [
          { name: "上证" + cfg.title, type: "line", data: valuationPoints("sh", activeMetric),
            showSymbol: false, sampling: "lttb", lineStyle: { width: 2, color: COLORS.sh },
            itemStyle: { color: COLORS.sh }, emphasis: { focus: "series" } },
          { name: "深证" + cfg.title, type: "line", data: valuationPoints("sz", activeMetric),
            showSymbol: false, sampling: "lttb", lineStyle: { width: 2, color: COLORS.sz },
            itemStyle: { color: COLORS.sz }, emphasis: { focus: "series" } }
        ]
      }, true);
    }

    document.querySelectorAll("#valuationMetricTabs [data-metric]").forEach(button => {
      button.addEventListener("click", () => {
        activeMetric = button.dataset.metric;
        document.querySelectorAll("#valuationMetricTabs [data-metric]").forEach(item => item.classList.remove("active"));
        button.classList.add("active");
        renderValuationChart();
      });
    });

    const yearSelect = document.getElementById("eventYear");
    const quarterSelect = document.getElementById("eventQuarter");
    for (let year = 2026; year >= 2006; year--) {
      const option = document.createElement("option");
      option.value = String(year); option.textContent = String(year);
      yearSelect.appendChild(option);
    }
    yearSelect.value = "2026";
    quarterSelect.value = "Q2";
    function renderEvents() {
      const key = yearSelect.value + "-" + quarterSelect.value;
      const events = eventData[key] || [];
      document.getElementById("eventPeriod").textContent = yearSelect.value + " " + quarterSelect.value;
      document.getElementById("eventCount").textContent = events.length ? events.length + " 条记录" : "0 条记录";
      document.getElementById("valuationEventList").innerHTML = events.length
        ? events.map(event => '<li class="event-item"><div class="event-type">' + event.type +
          '</div><div class="event-title">' + event.title + '</div><div class="event-desc">' +
          event.desc + '</div></li>').join("")
        : '<li class="event-empty">该季度暂无估值事件记录<br>后续可继续补充公告、业绩预警与热门公司样本</li>';
    }
    yearSelect.addEventListener("change", renderEvents);
    quarterSelect.addEventListener("change", renderEvents);

    const navLinks = document.querySelectorAll(".page-nav a");
    navLinks.forEach(link => link.addEventListener("click", () => {
      navLinks.forEach(item => item.classList.remove("active"));
      link.classList.add("active");
    }));
    window.addEventListener("resize", () => valuationChart.resize());
    renderValuationChart();
    renderEvents();
  })();
  </script>
`;

if (!fs.existsSync(VALUATION_DATA_FILE)) {
  throw new Error("Missing valuation_data.json. Run fetch_valuation_data.py first.");
}
const valuationExtra = JSON.parse(fs.readFileSync(VALUATION_DATA_FILE, "utf8"));
const valuationJs = js.replace(
  "__VALUATION_EXTRA__",
  JSON.stringify(valuationExtra)
);
let html = fs.readFileSync(OUTPUT, "utf8");
html = stripExistingModule(html);
function insertBeforeLast(source, marker, content) {
  const index = source.lastIndexOf(marker);
  if (index === -1) throw new Error(`Marker not found: ${marker}`);
  return source.slice(0, index) + content + source.slice(index);
}

html = insertBeforeLast(html, "</head>", css + "\n");
html = html.replace('<main class="wrap">', '<main class="wrap" id="overview">' + nav);
html = insertBeforeLast(html, "</main>", moduleHtml + "\n");
html = insertBeforeLast(html, "</body>", valuationJs + "\n");
fs.writeFileSync(OUTPUT, html, "utf8");

console.log(JSON.stringify({ output: OUTPUT, bytes: fs.statSync(OUTPUT).size }, null, 2));
