const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(ROOT, "outputs", "a_share_20y_dashboard.html");
const DATA_FILE = path.join(ROOT, "work", "national_team_etf_data.json");

function stripExisting(html) {
  return html
    .replace(/\s*<section class="module-shell" id="national-team-etf">[\s\S]*?<\/section>/g, "")
    .replace(/\s*<style id="national-team-etf-style">[\s\S]*?<\/style>/g, "")
    .replace(/\s*<script id="national-team-etf-script">[\s\S]*?<\/script>/g, "")
    .replace(/\s*<a href="#national-team-etf"[^>]*>国家队-ETF<\/a>/g, "");
}

const css = `
  <style id="national-team-etf-style">
    .nt-etf-grid {
      display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(380px, .95fr);
      gap: 15px; align-items: stretch;
    }
    #nationalTeamEtfChart { height: 520px; width: 100%; min-height: 520px; }
    #nationalTeamEtfTrendChart { height: 320px; width: 100%; min-height: 320px; }
    #national-team-etf .valuation-panel { outline: 1px solid rgba(246,200,95,.08); }
    .nt-etf-summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .nt-etf-stat {
      border: 1px solid var(--line); border-radius: 8px; padding: 12px;
      background: rgba(8, 18, 32, .66);
    }
    .nt-etf-stat span { display: block; color: var(--muted); font-size: 12px; margin-bottom: 6px; }
    .nt-etf-stat strong { display: block; color: var(--text); font-size: 20px; }
    .nt-etf-table { margin-top: 12px; overflow: auto; max-height: 394px; border: 1px solid var(--line); border-radius: 8px; }
    .nt-etf-table table { width: 100%; border-collapse: collapse; min-width: 620px; font-size: 12px; }
    .nt-etf-table th, .nt-etf-table td { padding: 9px 10px; border-bottom: 1px solid rgba(32,49,73,.8); text-align: left; }
    .nt-etf-table th { color: var(--muted); font-weight: 650; background: rgba(13,25,41,.96); position: sticky; top: 0; }
    .nt-etf-table td { color: var(--text); }
    .nt-etf-code { color: var(--accent); font-weight: 700; }
    .nt-etf-note-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 980px) {
      .nt-etf-grid, .nt-etf-note-grid { grid-template-columns: 1fr; }
      #nationalTeamEtfChart { height: 470px; }
    }
  </style>
`;

const moduleHtml = `
  <section class="module-shell" id="national-team-etf">
    <div class="module-head">
      <div>
        <div class="module-kicker">Module 05 / National Team ETF Exposure</div>
        <h2>国家队-ETF暴露</h2>
        <p>选取主要 A 股指数 ETF，用披露持仓聚类，并估算底层股票中国家队前十大流通股东暴露比例。</p>
      </div>
      <div class="module-status" id="nationalTeamEtfStatus">2026Q1 披露持仓样本</div>
    </div>

    <div class="nt-etf-grid">
      <article class="valuation-panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">国家队暴露时间线</div>
            <div class="panel-subtitle">按关键压力节点观察国家队底层暴露变化，重点看是否存在托底抬升</div>
          </div>
        </div>
        <div id="nationalTeamEtfTrendChart"></div>
        <div class="panel-head" style="margin-top:12px;">
          <div>
            <div class="panel-title">聚类散点图</div>
            <div class="panel-subtitle">横轴为披露持仓数量，纵轴为国家队底层暴露比例；颜色为持仓相似度聚类</div>
          </div>
        </div>
        <div id="nationalTeamEtfChart"></div>
      </article>

      <aside class="valuation-panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">聚类与基金明细</div>
            <div class="panel-subtitle">按国家队底层暴露比例从高到低排序</div>
          </div>
        </div>
        <div class="nt-etf-summary" id="nationalTeamEtfSummary"></div>
        <div class="nt-etf-table" id="nationalTeamEtfTable"></div>
      </aside>
    </div>

    <div class="valuation-foot nt-etf-note-grid">
      <div class="note"><strong>计算口径：</strong>ETF国家队底层暴露比例 = Σ(ETF披露持仓权重 × 该股票前十大流通股东中国家队合计持股比例)。国家队白名单包括中央汇金、汇金资产、中国证券金融及明确证金账户。</div>
      <div class="note"><strong>限制说明：</strong>这不是国家队直接持有ETF份额比例；基金持仓为披露样本，不一定等于完整指数全成分；个股股东只覆盖进入前十大流通股东的国家队持仓。</div>
    </div>
  </section>
`;

const script = `
  <script id="national-team-etf-script">
  (() => {
    const ntEtfData = __NATIONAL_TEAM_ETF_DATA__;
    const fmt = (value, digits = 2) => Number(value).toLocaleString("zh-CN", {
      minimumFractionDigits: digits, maximumFractionDigits: digits
    });
    const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
    const colors = ["#f6c85f", "#ff5d73", "#36c2ff", "#6bd98c", "#b58cff", "#ff9a5c"];
    document.getElementById("nationalTeamEtfStatus").textContent =
      ntEtfData.meta.period.slice(0, 4) + "Q" + Math.ceil(Number(ntEtfData.meta.period.slice(4, 6)) / 3) +
      " / " + ntEtfData.etfs.length + "只ETF";

    const top = ntEtfData.etfs[0];
    const avg = ntEtfData.etfs.reduce((sum, row) => sum + row.nationalTeamExposure, 0) / ntEtfData.etfs.length;
    const maxCluster = ntEtfData.clusters.slice().sort((a, b) => b.averageExposure - a.averageExposure)[0];
    document.getElementById("nationalTeamEtfSummary").innerHTML = [
      ["最高ETF", top.name + "<br><strong>" + fmt(top.nationalTeamExposure, 2) + "%</strong>"],
      ["样本均值", "<strong>" + fmt(avg, 2) + "%</strong>"],
      ["最高类别", maxCluster.clusterName + "<br><strong>" + fmt(maxCluster.averageExposure, 2) + "%</strong>"],
      ["覆盖基金", "<strong>" + ntEtfData.etfs.length + "只</strong>"]
    ].map(([label, value]) => '<div class="nt-etf-stat"><span>' + label + '</span><strong>' + value + '</strong></div>').join("");

    document.getElementById("nationalTeamEtfTable").innerHTML =
      '<table><thead><tr><th>代码</th><th>基金</th><th>类别</th><th>国家队暴露</th><th>持仓数</th><th>主要贡献</th></tr></thead><tbody>' +
      ntEtfData.etfs.map(row => {
        const contributors = row.topNationalTeamContributors.slice(0, 2)
          .map(item => item.symbol + " " + fmt(item.contribution, 2) + "%").join("<br>") || "--";
        return '<tr><td class="nt-etf-code">' + escapeHtml(row.ts_code) + '</td>' +
          '<td>' + escapeHtml(row.name) + '</td>' +
          '<td>' + escapeHtml(row.clusterName) + '</td>' +
          '<td>' + fmt(row.nationalTeamExposure, 2) + '%</td>' +
          '<td>' + row.holdingCount + '</td>' +
          '<td>' + contributors + '</td></tr>';
      }).join("") + '</tbody></table>';

    const chart = echarts.init(document.getElementById("nationalTeamEtfChart"), null, { renderer: "canvas" });
    const trendChart = echarts.init(document.getElementById("nationalTeamEtfTrendChart"), null, { renderer: "canvas" });
    const historySeries = ntEtfData.history || [];
    const trendNames = {
      "510050.SH": "上证50ETF",
      "510300.SH": "沪深300ETF",
    };
    const crisisMarks = (ntEtfData.meta.crisisMarks || [
      {"date":"2015-06-30","name":"2015股灾"},
      {"date":"2018-09-30","name":"2018调整"},
      {"date":"2020-03-31","name":"2020冲击"},
      {"date":"2024-03-31","name":"2024低点"}
    ]).map(row => ({ xAxis: row.date, name: row.name }));
    const trendSeries = Object.keys(trendNames).map(code => ({
      name: trendNames[code],
      type: "line",
      data: historySeries.map(row => [row.date, row[code] || 0]),
      showSymbol: true,
      smooth: false,
      lineStyle: { width: 1.8 },
      symbolSize: 7
    }));
    trendSeries.push({
      name: "平均暴露",
      type: "line",
      data: historySeries.map(row => [row.date, row.averageExposure]),
      showSymbol: true,
      symbolSize: 7,
      lineStyle: { width: 3, color: "#f6c85f" },
      itemStyle: { color: "#f6c85f" },
        markPoint: {
          symbolSize: 56,
          label: { color: "#edf4ff" },
          data: crisisMarks.map(item => ({
            name: item.name,
            coord: [item.xAxis, historySeries.find(row => row.date === item.xAxis)?.averageExposure || 0]
          }))
        },
      markLine: {
        symbol: ["none", "none"],
        silent: true,
        lineStyle: { color: "#53657d", type: "dashed", width: 1 },
        label: { color: "#8fa5bf", fontSize: 10, formatter: p => p.name },
        data: crisisMarks
      }
    });
    trendChart.setOption({
      animation: false,
      color: ["#36c2ff", "#ff5d73", "#f6c85f"],
      grid: { left: 58, right: 22, top: 58, bottom: 44 },
      legend: {
        top: 10,
        textStyle: { color: "#8fa5bf" }
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(7,17,31,.96)",
        borderColor: "#36506f",
        textStyle: { color: "#edf4ff" },
        valueFormatter: value => fmt(value, 2) + "%"
      },
      xAxis: {
        type: "time",
        boundaryGap: false,
        axisLine: { lineStyle: { color: "#344760" } },
        axisLabel: { color: "#7890aa", hideOverlap: true }
      },
      yAxis: {
        type: "value",
        min: 0,
        max(value) { return Math.max(6, Math.ceil(value.max + 1)); },
        axisLabel: { color: "#7890aa", formatter: "{value}%" },
        splitLine: { lineStyle: { color: "#17283d" } }
      },
      series: trendSeries
    }, true);
    const series = ntEtfData.clusters.map(cluster => {
      const rows = ntEtfData.etfs.filter(row => row.cluster === cluster.cluster);
      return {
        name: cluster.clusterName,
        type: "scatter",
        symbolSize(value) { return Math.max(12, Math.min(42, value[3] * 2.2)); },
        data: rows.map(row => [
          row.holdingCount,
          row.nationalTeamExposure,
          row.name,
          Math.max(row.topNationalTeamContributors.length, 1),
          row.ts_code,
          row.clusterName
        ]),
        emphasis: { focus: "series" }
      };
    });
    chart.setOption({
      animation: false,
      color: colors,
      backgroundColor: "transparent",
      grid: { left: 64, right: 28, top: 44, bottom: 58 },
      legend: { top: 8, textStyle: { color: "#8fa5bf" } },
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(7,17,31,.96)", borderColor: "#36506f",
        textStyle: { color: "#edf4ff" },
        formatter(params) {
          const value = params.value;
          return "<b>" + escapeHtml(value[2]) + "</b><br>" +
            escapeHtml(value[4]) + " / " + escapeHtml(value[5]) + "<br>" +
            "国家队底层暴露：<b>" + fmt(value[1], 2) + "%</b><br>" +
            "披露持仓数：" + value[0];
        }
      },
      xAxis: {
        name: "披露持仓数", nameTextStyle: { color: "#8fa5bf" },
        type: "value", minInterval: 1,
        axisLine: { lineStyle: { color: "#344760" } },
        axisLabel: { color: "#7890aa" },
        splitLine: { lineStyle: { color: "#17283d" } }
      },
      yAxis: {
        name: "国家队底层暴露比例", nameTextStyle: { color: "#8fa5bf" },
        type: "value", scale: true,
        axisLabel: { color: "#7890aa", formatter: "{value}%" },
        splitLine: { lineStyle: { color: "#17283d" } }
      },
      series
    }, true);
    window.addEventListener("resize", () => chart.resize());
    window.addEventListener("resize", () => trendChart.resize());
  })();
  </script>
`;

if (!fs.existsSync(DATA_FILE)) throw new Error("Missing national_team_etf_data.json.");
const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
let html = stripExisting(fs.readFileSync(OUTPUT, "utf8"));
html = html.replace(
  '<a href="#official-sentiment">情绪-官方</a>',
  '<a href="#official-sentiment">情绪-官方</a><a href="#national-team-etf">国家队-ETF</a>'
);
function insertBeforeLast(source, marker, content) {
  const index = source.lastIndexOf(marker);
  if (index === -1) throw new Error(`Marker not found: ${marker}`);
  return source.slice(0, index) + content + source.slice(index);
}
const ntEtfScript = script.replace("__NATIONAL_TEAM_ETF_DATA__", JSON.stringify(data));
html = insertBeforeLast(html, "</head>", css + "\n");
html = insertBeforeLast(html, "</main>", moduleHtml + "\n");
html = insertBeforeLast(html, "</body>", ntEtfScript + "\n");
fs.writeFileSync(OUTPUT, html, "utf8");
console.log(JSON.stringify({ output: OUTPUT, bytes: fs.statSync(OUTPUT).size }, null, 2));
