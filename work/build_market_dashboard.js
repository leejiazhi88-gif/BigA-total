const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(ROOT, "outputs", "a_share_20y_dashboard.html");
const START = "2006-06-05";
const END = "2026-06-05";

function extractPe(file) {
  const html = fs.readFileSync(file, "utf8");
  const datesMatch = html.match(/var xSeryAcm\s*=\s*(\[[\s\S]*?\]);\s*var ySeriesAcm/);
  const seriesMatch = html.match(/var ySeriesAcm\s*=\s*(\[[\s\S]*?\]);\s*lineAverageChart/);
  if (!datesMatch || !seriesMatch) throw new Error(`Unable to parse ${file}`);
  const dates = JSON.parse(datesMatch[1]).map(String).map((d) =>
    `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
  );
  const values = JSON.parse(seriesMatch[1])[0].figures.map(Number);
  return new Map(dates.map((date, i) => [date, values[i]]));
}

async function fetchPrices(secid) {
  const url = new URL("https://push2his.eastmoney.com/api/qt/stock/kline/get");
  url.search = new URLSearchParams({
    secid,
    klt: "101",
    fqt: "0",
    beg: START.replaceAll("-", ""),
    end: END.replaceAll("-", ""),
    fields1: "f1,f2,f3,f4,f5,f6",
    fields2: "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61",
  });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Price request failed: ${response.status}`);
  const json = await response.json();
  return json.data.klines.map((line) => {
    const [date, , close] = line.split(",");
    return { date, close: Number(close) };
  });
}

function combine(prices, peMap) {
  return prices
    .map(({ date, close }) => {
      const pe = peMap.get(date);
      if (!Number.isFinite(pe) || pe <= 0) return null;
      return {
        date,
        close,
        pe,
        earnings: close / pe,
      };
    })
    .filter(Boolean);
}

function lastByWeek(rows) {
  const result = [];
  let key = "";
  for (const row of rows) {
    const date = new Date(`${row.date}T00:00:00Z`);
    const first = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const week = Math.floor((date - first) / 604800000);
    const nextKey = `${date.getUTCFullYear()}-${week}`;
    if (nextKey !== key) {
      result.push(row);
      key = nextKey;
    } else {
      result[result.length - 1] = row;
    }
  }
  return result;
}

function stats(rows) {
  const latest = rows[rows.length - 1];
  const oneYearAgo = rows.find((row) => row.date >= "2025-06-05") || rows[0];
  const peSorted = rows.map((row) => row.pe).sort((a, b) => a - b);
  const rank = peSorted.filter((value) => value <= latest.pe).length / peSorted.length;
  return {
    ...latest,
    yearChange: (latest.close / oneYearAgo.close - 1) * 100,
    pePercentile: rank * 100,
  };
}

function htmlTemplate(data, echartsSource) {
  const dataJson = JSON.stringify(data);
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>A股20年：股价、滚动盈利与市盈率</title>
  <style>
    :root {
      --bg: #07111f;
      --panel: #0d1929;
      --panel-2: #101f32;
      --line: #203149;
      --text: #edf4ff;
      --muted: #8fa5bf;
      --sh: #ff5d73;
      --sz: #36c2ff;
      --accent: #f6c85f;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--text);
      background:
        radial-gradient(circle at 15% 0%, rgba(54,194,255,.11), transparent 34%),
        radial-gradient(circle at 90% 8%, rgba(255,93,115,.10), transparent 31%),
        var(--bg);
      font-family: "Segoe UI", "Microsoft YaHei", sans-serif;
    }
    .wrap { max-width: 1540px; margin: 0 auto; padding: 28px 30px 34px; }
    header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-end; }
    .eyebrow { color: var(--accent); font-size: 12px; letter-spacing: .18em; font-weight: 700; }
    h1 { margin: 7px 0 6px; font-size: clamp(25px, 3vw, 42px); line-height: 1.1; }
    .subtitle { color: var(--muted); font-size: 14px; }
    .asof { color: var(--muted); text-align: right; font-size: 13px; line-height: 1.7; }
    .cards { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin: 24px 0 16px; }
    .card {
      background: linear-gradient(145deg, rgba(16,31,50,.98), rgba(10,22,37,.98));
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 15px 16px;
      min-height: 92px;
    }
    .card .label { color: var(--muted); font-size: 12px; margin-bottom: 9px; }
    .card .value { font-size: 24px; font-weight: 750; letter-spacing: -.02em; }
    .card .meta { color: var(--muted); font-size: 11px; margin-top: 5px; }
    .sh { color: var(--sh); } .sz { color: var(--sz); }
    .toolbar {
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      background: rgba(13,25,41,.86); border: 1px solid var(--line);
      border-radius: 14px 14px 0 0; padding: 12px 15px;
    }
    .ranges { display: flex; gap: 7px; flex-wrap: wrap; }
    button {
      color: var(--muted); background: #132239; border: 1px solid #263b58;
      border-radius: 8px; padding: 7px 12px; cursor: pointer; font-weight: 650;
    }
    button:hover, button.active { color: #07111f; background: var(--accent); border-color: var(--accent); }
    .legend { display: flex; gap: 17px; color: var(--muted); font-size: 12px; }
    .dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 6px; }
    #chart {
      height: min(760px, calc(100vh - 255px));
      min-height: 570px;
      background: rgba(9,20,34,.94);
      border: 1px solid var(--line); border-top: 0; border-radius: 0 0 14px 14px;
    }
    .notes {
      display: grid; grid-template-columns: 1.3fr 1fr; gap: 16px; margin-top: 15px;
      color: var(--muted); font-size: 12px; line-height: 1.7;
    }
    .note { border: 1px solid var(--line); background: rgba(13,25,41,.75); border-radius: 12px; padding: 13px 15px; }
    .note strong { color: var(--text); }
    @media (max-width: 1000px) {
      .cards { grid-template-columns: repeat(3, 1fr); }
      header { align-items: flex-start; flex-direction: column; }
      .asof { text-align: left; }
      #chart { height: 680px; }
    }
    @media (max-width: 620px) {
      .wrap { padding: 20px 12px 26px; }
      .cards { grid-template-columns: repeat(2, 1fr); }
      .toolbar { align-items: flex-start; flex-direction: column; }
      .notes { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
<main class="wrap">
  <header>
    <div>
      <div class="eyebrow">A-SHARE MARKET DASHBOARD</div>
      <h1>A股20年：股价、滚动盈利与市盈率</h1>
      <div class="subtitle">上证综指 × 深证成指，共享同一时间横轴</div>
    </div>
    <div class="asof">数据区间：2006-06-05 至 2026-06-05<br>周频展示，底层数据为交易日数据</div>
  </header>
  <section class="cards" id="cards"></section>
  <section>
    <div class="toolbar">
      <div class="ranges">
        <button data-years="1">1年</button>
        <button data-years="3">3年</button>
        <button data-years="5">5年</button>
        <button data-years="10">10年</button>
        <button class="active" data-years="20">20年</button>
      </div>
      <div class="legend">
        <span><i class="dot" style="background:var(--sh)"></i>上证综指</span>
        <span><i class="dot" style="background:var(--sz)"></i>深证成指</span>
      </div>
    </div>
    <div id="chart"></div>
  </section>
  <section class="notes">
    <div class="note"><strong>利润口径：</strong>滚动盈利点数 = 指数点位 ÷ PE(TTM)。它是与指数点位同口径的过去12个月隐含盈利，不是交易所全部公司的利润金额。该口径能消除指数成分、市值规模长期变化带来的不可比问题。</div>
    <div class="note"><strong>阅读方法：</strong>价格上涨若主要由盈利曲线上升推动，质量更扎实；若价格快速上涨、盈利横盘而PE显著抬升，则主要是估值扩张。虚线标记历史典型顶部窗口，仅用于辅助复盘。</div>
  </section>
</main>
<script>${echartsSource}</script>
<script>
const DATA = ${dataJson};
const COLORS = { sh: "#ff5d73", sz: "#36c2ff" };
const fmt = (n, digits = 2) => Number(n).toLocaleString("zh-CN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signed = (n) => (n >= 0 ? "+" : "") + fmt(n, 1) + "%";
const cards = [
  ["上证综指", fmt(DATA.stats.sh.close), "近1年 " + signed(DATA.stats.sh.yearChange), "sh"],
  ["上证PE(TTM)", fmt(DATA.stats.sh.pe), "20年分位 " + fmt(DATA.stats.sh.pePercentile, 0) + "%", "sh"],
  ["上证滚动盈利", fmt(DATA.stats.sh.earnings), "指数盈利点数", "sh"],
  ["深证成指", fmt(DATA.stats.sz.close), "近1年 " + signed(DATA.stats.sz.yearChange), "sz"],
  ["深证PE(TTM)", fmt(DATA.stats.sz.pe), "20年分位 " + fmt(DATA.stats.sz.pePercentile, 0) + "%", "sz"],
  ["深证滚动盈利", fmt(DATA.stats.sz.earnings), "指数盈利点数", "sz"],
];
document.getElementById("cards").innerHTML = cards.map(([label, value, meta, cls]) =>
  '<article class="card"><div class="label">' + label + '</div><div class="value ' + cls + '">' + value +
  '</div><div class="meta">' + meta + '</div></article>'
).join("");

const chart = echarts.init(document.getElementById("chart"), null, { renderer: "canvas" });
const topDates = [
  { xAxis: "2007-10-16", name: "2007顶" },
  { xAxis: "2009-08-04", name: "2009顶" },
  { xAxis: "2015-06-12", name: "2015顶" },
  { xAxis: "2018-01-29", name: "2018顶" },
  { xAxis: "2021-02-18", name: "2021顶" },
];
function points(rows, field) { return rows.map(r => [r.date, r[field]]); }
function series(name, rows, field, xAxisIndex, yAxisIndex, color, withMarks = false) {
  return {
    name, type: "line", xAxisIndex, yAxisIndex, data: points(rows, field),
    showSymbol: false, sampling: "lttb", smooth: false,
    lineStyle: { width: 1.8, color }, itemStyle: { color },
    emphasis: { focus: "series", lineStyle: { width: 3 } },
    markLine: withMarks ? {
      symbol: ["none", "none"], silent: true,
      label: { color: "#8fa5bf", fontSize: 10, formatter: p => p.name },
      lineStyle: { color: "#53657d", type: "dashed", width: 1 },
      data: topDates
    } : undefined
  };
}
const commonAxis = {
  type: "time", axisLine: { lineStyle: { color: "#344760" } },
  axisLabel: { color: "#7890aa", hideOverlap: true },
  splitLine: { show: false }, axisPointer: { show: true }
};
chart.setOption({
  animation: false,
  backgroundColor: "transparent",
  grid: [
    { left: 72, right: 34, top: 42, height: "29%" },
    { left: 72, right: 34, top: "38%", height: "24%" },
    { left: 72, right: 34, top: "68%", height: "20%" }
  ],
  title: [
    { text: "指数价格", left: 20, top: 12, textStyle: { color: "#edf4ff", fontSize: 13 } },
    { text: "过去12个月滚动盈利（指数点）", left: 20, top: "34%", textStyle: { color: "#edf4ff", fontSize: 13 } },
    { text: "市盈率 PE(TTM)", left: 20, top: "64%", textStyle: { color: "#edf4ff", fontSize: 13 } }
  ],
  tooltip: {
    trigger: "axis", axisPointer: { type: "cross", link: [{ xAxisIndex: "all" }] },
    backgroundColor: "rgba(7,17,31,.96)", borderColor: "#36506f", textStyle: { color: "#edf4ff" },
    formatter(params) {
      const date = params[0]?.axisValueLabel || "";
      const lines = params.map(p => p.marker + p.seriesName + "：<b>" + fmt(p.value[1]) + "</b>");
      return "<b>" + date + "</b><br>" + lines.join("<br>");
    }
  },
  axisPointer: { link: [{ xAxisIndex: "all" }], label: { backgroundColor: "#263b58" } },
  xAxis: [
    { ...commonAxis, gridIndex: 0, axisLabel: { show: false } },
    { ...commonAxis, gridIndex: 1, axisLabel: { show: false } },
    { ...commonAxis, gridIndex: 2 }
  ],
  yAxis: [
    { type: "value", gridIndex: 0, scale: true, axisLabel: { color: "#7890aa" }, splitLine: { lineStyle: { color: "#17283d" } } },
    { type: "value", gridIndex: 1, scale: true, axisLabel: { color: "#7890aa" }, splitLine: { lineStyle: { color: "#17283d" } } },
    { type: "value", gridIndex: 2, scale: true, axisLabel: { color: "#7890aa", formatter: "{value}x" }, splitLine: { lineStyle: { color: "#17283d" } } }
  ],
  dataZoom: [
    { type: "inside", xAxisIndex: [0,1,2], filterMode: "none", start: 0, end: 100 },
    { type: "slider", xAxisIndex: [0,1,2], bottom: 10, height: 24, borderColor: "#263b58",
      backgroundColor: "#0d1929", fillerColor: "rgba(246,200,95,.18)", handleStyle: { color: "#f6c85f" },
      textStyle: { color: "#8fa5bf" }, start: 0, end: 100 }
  ],
  series: [
    series("上证价格", DATA.sh, "close", 0, 0, COLORS.sh, true),
    series("深证价格", DATA.sz, "close", 0, 0, COLORS.sz),
    series("上证滚动盈利", DATA.sh, "earnings", 1, 1, COLORS.sh),
    series("深证滚动盈利", DATA.sz, "earnings", 1, 1, COLORS.sz),
    series("上证PE(TTM)", DATA.sh, "pe", 2, 2, COLORS.sh),
    series("深证PE(TTM)", DATA.sz, "pe", 2, 2, COLORS.sz)
  ]
});

document.querySelectorAll("[data-years]").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll("[data-years]").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  const years = Number(btn.dataset.years);
  const end = new Date("2026-06-05T00:00:00Z");
  const start = new Date(end);
  start.setUTCFullYear(start.getUTCFullYear() - years);
  chart.dispatchAction({ type: "dataZoom", startValue: start.toISOString().slice(0,10), endValue: "2026-06-05" });
}));
window.addEventListener("resize", () => chart.resize());
</script>
</body>
</html>`;
}

async function main() {
  const { execFileSync } = require("child_process");
  const python = process.env.CODEX_PYTHON ||
    "C:\\Users\\leeji\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe";
  execFileSync(python, [path.join(ROOT, "work", "fetch_valuation_data.py")], {
    stdio: "inherit",
  });
  const [shPrices, szPrices] = await Promise.all([
    fetchPrices("1.000001"),
    fetchPrices("0.399001"),
  ]);
  const shPe = extractPe(path.join(ROOT, "work", "99rising_sh_pettm.html"));
  const szPe = extractPe(path.join(ROOT, "work", "99rising_sz_pettm.html"));
  const sh = lastByWeek(combine(shPrices, shPe));
  const sz = lastByWeek(combine(szPrices, szPe));
  const echartsSource = fs.readFileSync(path.join(ROOT, "work", "echarts.min.js"), "utf8");
  const data = { sh, sz, stats: { sh: stats(sh), sz: stats(sz) } };
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, htmlTemplate(data, echartsSource), "utf8");
  require("./add_valuation_module");
  console.log(JSON.stringify({
    output: OUTPUT,
    bytes: fs.statSync(OUTPUT).size,
    shPoints: sh.length,
    szPoints: sz.length,
    shLatest: data.stats.sh,
    szLatest: data.stats.sz,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
