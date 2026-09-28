import bisect
import json
from datetime import datetime
from pathlib import Path

from tushare_client import END_DATE, call_api, get_token


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "work" / "valuation_data.json"
START_YEAR = 2006
END_YEAR = int(END_DATE[:4])



def fetch_by_year(token, api_name, base_params, fields):
    rows = []
    for year in range(START_YEAR, END_YEAR + 1):
        params = {
            **base_params,
            "start_date": f"{year}0101",
            "end_date": END_DATE if year == END_YEAR else f"{year}1231",
        }
        rows.extend(call_api(token, api_name, params, fields))
    unique = {row["trade_date"]: row for row in rows}
    return [unique[date] for date in sorted(unique)]


def last_by_week(rows):
    result = []
    current_key = None
    for row in rows:
        date = datetime.strptime(row["trade_date"], "%Y%m%d")
        key = (date.isocalendar().year, date.isocalendar().week)
        if key != current_key:
            result.append(row)
            current_key = key
        else:
            result[-1] = row
    return result


def percentile(values, value):
    return bisect.bisect_right(values, value) / len(values) * 100


def build_index_series(rows, bond_dates, bond_by_date):
    valid = [row for row in rows if row.get("pb") and row.get("pe_ttm", 0) > 0]
    pb_values = sorted(float(row["pb"]) for row in valid)
    result = []
    for row in last_by_week(valid):
        date = row["trade_date"]
        bond_yield = bond_by_date.get(date)
        pe = float(row["pe_ttm"])
        pb = float(row["pb"])
        result.append(
            {
                "date": f"{date[:4]}-{date[4:6]}-{date[6:]}",
                "pb": round(pb, 4),
                "pbPercentile": round(percentile(pb_values, pb), 4),
                "bond10y": round(bond_yield, 4) if bond_yield is not None else None,
                "equityBondSpread": round(100 / pe - bond_yield, 4) if bond_yield is not None else None,
            }
        )
    return result


def main():
    token = get_token()
    fields = "ts_code,trade_date,pe_ttm,pb"
    sh_rows = fetch_by_year(
        token, "index_dailybasic", {"ts_code": "000001.SH"}, fields
    )
    sz_rows = fetch_by_year(
        token, "index_dailybasic", {"ts_code": "399001.SZ"}, fields
    )
    bond_status = "refreshed"
    try:
        bond_rows = fetch_by_year(
            token, "yc_cb", {"ts_code": "1001.CB", "curve_type": "0", "curve_term": 10},
            "trade_date,yield",
        )
        bond_by_date = {row["trade_date"]: float(row["yield"]) for row in bond_rows if row.get("yield") is not None}
    except RuntimeError as error:
        if not OUTPUT.exists():
            raise
        cached = json.loads(OUTPUT.read_text(encoding="utf-8"))
        bond_by_date = {row["date"].replace("-", ""): row["bond10y"]
                        for row in cached["sh"] if row.get("bond10y") is not None}
        bond_status = str(error)
        print("Bond yield refresh unavailable; updating PB and retaining dated bond observations.", flush=True)
    bond_dates = sorted(bond_by_date)
    result = {
        "meta": {
            "start": f"{START_YEAR}-01-01",
            "end": min(sh_rows[-1]["trade_date"], sz_rows[-1]["trade_date"]),
            "bondEnd": bond_dates[-1] if bond_dates else None,
            "bondStatus": bond_status,
            "bond": "中债国债收益率曲线 10年期到期收益率",
            "spread": "100 / PE(TTM) - 10年期国债收益率",
        },
        "sh": build_index_series(sh_rows, bond_dates, bond_by_date),
        "sz": build_index_series(sz_rows, bond_dates, bond_by_date),
    }
    OUTPUT.write_text(
        json.dumps(result, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "output": str(OUTPUT),
                "sh_points": len(result["sh"]),
                "sz_points": len(result["sz"]),
                "bond_days": len(bond_dates),
                "latest_sh": result["sh"][-1],
                "latest_sz": result["sz"][-1],
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
