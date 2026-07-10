# A股大顶研究仪表盘

这个仓库用于生成 A 股大顶研究的本地 HTML 仪表盘，目前包含：

- 总览：上证综指、深证成指的价格、过去12个月合计利润、PE(TTM)
- 估值模块：PE(TTM)、PE历史分位、PB可得历史分位、股债收益差
- 估值事件 List：按年份和季度切换查看典型估值事件
- 情绪-散户模块：两市成交额、换手率、融资余额、融资余额/流通市值、涨停数量
- 散户情绪事件 List：按年份和季度切换查看开户、基金、融资监管与极端情绪事件
- 情绪-大资金模块：大宗交易、机构席位大宗净买入、产业资本增减持、北向资金历史口径
- 情绪-官方模块：IPO融资、产业资本净减持、印花税率、政策利率、社融/M2与政策事件

换机同步、线上地址、部署与本地运行说明见 [HANDOFF.md](HANDOFF.md)。

## 运行

生成页面：

```powershell
node ./work/build_market_dashboard.js
```

本地预览：

```powershell
node ./work/preview_server.js
```

然后打开：

```text
http://127.0.0.1:9876
```

## 主要文件

- `outputs/a_share_20y_dashboard.html`：生成后的仪表盘
- `work/build_market_dashboard.js`：总览生成入口
- `work/fetch_market_overview_data.py`：总览价格、PE(TTM)、过去12个月合计利润数据更新脚本
- `work/market_overview_data.json`：总览数据缓存
- `work/add_valuation_module.js`：估值模块注入脚本
- `work/fetch_valuation_data.py`：PB、股债收益差数据更新脚本
- `work/valuation_data.json`：估值扩展数据缓存
- `work/fetch_retail_sentiment_data.py`：散户情绪连续数据更新脚本
- `work/add_retail_sentiment_module.js`：散户情绪模块注入脚本
- `work/fetch_large_money_sentiment_data.py`：大资金连续数据更新脚本
- `work/add_large_money_sentiment_module.js`：大资金模块注入脚本
- `work/fetch_official_sentiment_data.py`：官方情绪连续数据更新脚本
- `work/add_official_sentiment_module.js`：官方情绪模块注入脚本

## 数据口径

- PE(TTM)：来自指数动态市盈率历史序列
- 过去12个月合计利润：指数总市值 ÷ PE(TTM)，单位换算为亿元
- PB：来自 Tushare 指数每日指标
- 股债收益差：`100 / PE(TTM) - 10年期国债收益率`

注意：PE 序列覆盖 2006 年以来；PB 与股债收益差当前共同可得区间为 2016 年 6 月以来。
