# A股大顶研究仪表盘

这个仓库用于生成 A 股大顶研究的本地 HTML 仪表盘，目前包含：

- 总览：上证综指、深证成指的价格、滚动盈利、PE(TTM)
- 估值模块：PE(TTM)、PE历史分位、PB可得历史分位、股债收益差
- 估值事件 List：按年份和季度切换查看典型估值事件

## 运行

生成页面：

```powershell
$env:CODEX_PYTHON="C:\Users\leeji\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
& "C:\Users\leeji\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" ".\work\build_market_dashboard.js"
```

本地预览：

```powershell
& "C:\Users\leeji\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" ".\work\preview_server.js"
```

然后打开：

```text
http://127.0.0.1:9876
```

## 主要文件

- `outputs/a_share_20y_dashboard.html`：生成后的仪表盘
- `work/build_market_dashboard.js`：总览生成入口
- `work/add_valuation_module.js`：估值模块注入脚本
- `work/fetch_valuation_data.py`：PB、股债收益差数据更新脚本
- `work/valuation_data.json`：估值扩展数据缓存

## 数据口径

- PE(TTM)：来自指数动态市盈率历史序列
- 滚动盈利点数：指数点位 ÷ PE(TTM)
- PB：来自 Tushare 指数每日指标
- 股债收益差：`100 / PE(TTM) - 10年期国债收益率`

注意：PE 序列覆盖 2006 年以来；PB 与股债收益差当前共同可得区间为 2016 年 6 月以来。
