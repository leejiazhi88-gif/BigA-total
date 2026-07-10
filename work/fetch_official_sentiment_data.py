import calendar
import json
import re
import urllib.request
from collections import defaultdict
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONFIG = Path.home() / ".codex" / "config.toml"
OUTPUT = ROOT / "work" / "official_sentiment_data.json"
START_YEAR = 2006
END_DATE = "20260710"


def get_token():
    text = CONFIG.read_text(encoding="utf-8")
    match = re.search(r"https://api\.tushare\.pro/mcp/\?token=([^\"&\s]+)", text)
    if not match:
        raise RuntimeError("Tushare token was not found.")
    return match.group(1)


def call_api(token, api_name, params, fields):
    payload = json.dumps(
        {"api_name": api_name, "token": token, "params": params, "fields": fields}
    ).encode("utf-8")
    request = urllib.request.Request(
        "https://api.tushare.pro",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        result = json.loads(response.read().decode("utf-8"))
    if result.get("code") != 0:
        raise RuntimeError(f"{api_name}: {result.get('msg')}")
    data = result.get("data") or {}
    return [dict(zip(data.get("fields", []), row)) for row in data.get("items", [])]


def year_ranges(start_year=START_YEAR):
    end_year = int(END_DATE[:4])
    for year in range(start_year, end_year + 1):
        yield f"{year}0101", END_DATE if year == end_year else f"{year}1231"


def week_key(date):
    dt = datetime.strptime(date, "%Y%m%d")
    iso = dt.isocalendar()
    return f"{iso.year}-W{iso.week:02d}"


def iso_date(date):
    return f"{date[:4]}-{date[4:6]}-{date[6:]}"


def month_date(month):
    year = int(month[:4])
    mon = int(month[4:6])
    day = calendar.monthrange(year, mon)[1]
    return f"{year:04d}-{mon:02d}-{day:02d}"


def stamp_tax_points():
    return [
        {"date": "2005-01-24", "stampTaxRate": 0.10},
        {"date": "2007-05-30", "stampTaxRate": 0.30},
        {"date": "2008-04-24", "stampTaxRate": 0.10},
        {"date": "2008-09-19", "stampTaxRate": 0.10},
        {"date": "2023-08-28", "stampTaxRate": 0.05},
    ]


def main():
    token = get_token()
    series_by_date = defaultdict(dict)

    for start, end in year_ranges():
        for row in call_api(
            token,
            "new_share",
            {"start_date": start, "end_date": end},
            "ts_code,ipo_date,issue_date,funds",
        ):
            date = row.get("ipo_date") or row.get("issue_date")
            funds = row.get("funds")
            if not date or funds is None:
                continue
            key = week_key(date)
            item = series_by_date.setdefault(key, {"rawDates": []})
            item["rawDates"].append(date)
            item["ipoFunds"] = item.get("ipoFunds", 0.0) + float(funds)

    for start, end in year_ranges(2018):
        for row in call_api(
            token,
            "stk_holdertrade",
            {"start_date": start, "end_date": end},
            "ts_code,ann_date,in_de,change_vol,avg_price",
        ):
            date = row.get("ann_date")
            if not date or row.get("avg_price") is None:
                continue
            shares = float(row.get("change_vol") or 0)
            price = float(row.get("avg_price") or 0)
            amount = shares * price / 100000000
            signed_reduce = amount if row.get("in_de") == "DE" else -amount
            key = week_key(date)
            item = series_by_date.setdefault(key, {"rawDates": []})
            item["rawDates"].append(date)
            item["netReduceAmount"] = item.get("netReduceAmount", 0.0) + signed_reduce

    for start, end in year_ranges():
        for row in call_api(token, "shibor", {"start_date": start, "end_date": end}, "date,1y"):
            date = row.get("date")
            if not date or row.get("1y") is None:
                continue
            key = week_key(date)
            item = series_by_date.setdefault(key, {"rawDates": []})
            item["rawDates"].append(date)
            item["policyRate"] = float(row["1y"])

    macro_start = f"{START_YEAR}01"
    macro_end = END_DATE[:6]
    for row in call_api(token, "cn_m", {"start_m": macro_start, "end_m": macro_end}, "month,m2_yoy"):
        month = row.get("month")
        if month and row.get("m2_yoy") is not None:
            series_by_date[month_date(month)]["m2Yoy"] = float(row["m2_yoy"])
    for row in call_api(token, "sf_month", {"start_m": macro_start, "end_m": macro_end}, "month,inc_month"):
        month = row.get("month")
        if month and row.get("inc_month") is not None:
            series_by_date[month_date(month)]["socialFinancing"] = float(row["inc_month"])

    for point in stamp_tax_points():
        series_by_date[point["date"]].update(point)

    series = []
    for key, values in sorted(series_by_date.items()):
        if re.match(r"^\d{4}-W\d{2}$", key):
            raw_dates = values.pop("rawDates", [])
            if not raw_dates:
                continue
            date = iso_date(max(raw_dates))
        else:
            values.pop("rawDates", None)
            date = key
        series.append(
            {
                "date": date,
                **{
                    name: round(value, 4)
                    for name, value in values.items()
                    if isinstance(value, (int, float))
                },
            }
        )

    result = {
        "meta": {
            "updated": datetime.now().strftime("%Y-%m-%d"),
            "start": series[0]["date"],
            "end": series[-1]["date"],
            "sources": {
                "ipo": "Tushare new_share funds",
                "holder": "Tushare stk_holdertrade, avg_price available rows only",
                "policyRate": "Tushare shibor 1Y",
                "m2": "Tushare cn_m",
                "socialFinancing": "Tushare sf_month",
                "stampTax": "Manual policy step series",
            },
        },
        "series": series,
    }
    OUTPUT.write_text(
        json.dumps(result, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(json.dumps({"output": str(OUTPUT), "points": len(series)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
