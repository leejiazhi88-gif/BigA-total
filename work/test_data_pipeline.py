import unittest
from unittest.mock import patch

from fetch_market_overview_data import build_trading
from fetch_valuation_data import build_index_series


class DataPipelineTests(unittest.TestCase):
    def test_trading_uses_full_a_share_markets_and_matching_dates(self):
        markets = {
            "000002.SH": [
                {"trade_date": "20260923", "vol": 1e6, "amount": 1e5},
                {"trade_date": "20260924", "vol": 2e6, "amount": 3e5},
                {"trade_date": "20260928", "vol": 3e6, "amount": 4e5},
            ],
            "399107.SZ": [
                {"trade_date": "20260923", "vol": None, "amount": 2e5},
                {"trade_date": "20260924", "vol": 5e6, "amount": 7e5},
            ],
        }
        with patch("fetch_market_overview_data.fetch_by_year", side_effect=lambda token, api, code, fields: markets[code]):
            rows = build_trading("test")
        self.assertEqual(rows, [{"date": "2026-09-24", "volume": 7.0, "amount": 10.0}])

    def test_missing_bond_yield_does_not_block_pb_or_create_current_spread(self):
        rows = [
            {"trade_date": "20260605", "pe_ttm": 20, "pb": 1.5},
            {"trade_date": "20260924", "pe_ttm": 25, "pb": 2.0},
        ]
        series = build_index_series(rows, ["20260605"], {"20260605": 2.0})
        self.assertEqual(series[0]["equityBondSpread"], 3.0)
        self.assertEqual(series[-1]["date"], "2026-09-24")
        self.assertEqual(series[-1]["pb"], 2.0)
        self.assertIsNone(series[-1]["bond10y"])
        self.assertIsNone(series[-1]["equityBondSpread"])


if __name__ == "__main__":
    unittest.main()
