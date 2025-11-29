import importlib
import os
import sqlite3
import sys
import unittest
from datetime import datetime, timezone
from unittest import mock

import pandas as pd

# 将 server 目录加入路径，便于直接导入 eastmoney 模块
CURRENT_DIR = os.path.dirname(__file__)
sys.path.insert(0, CURRENT_DIR)
import eastmoney  # noqa: E402


class EastMoneyTestCase(unittest.TestCase):
    """验证核心解析与入库逻辑的最小单元测试。"""

    def setUp(self) -> None:
        # 每个用例使用独立的临时 SQLite 文件
        self.tmp_db = os.path.join(CURRENT_DIR, "test_stock.db")
        if os.path.exists(self.tmp_db):
            os.remove(self.tmp_db)
        eastmoney.DB_PATH = self.tmp_db
        importlib.reload(eastmoney)
        eastmoney.DB_PATH = self.tmp_db
        eastmoney.init_db()

    def tearDown(self) -> None:
        if os.path.exists(self.tmp_db):
            os.remove(self.tmp_db)

    def test_code_to_secid(self):
        self.assertEqual(eastmoney.code_to_secid("600000"), "1.600000")
        self.assertEqual(eastmoney.code_to_secid("000001"), "0.000001")

    def test_fetch_realtime_quote_parse(self):
        # 模拟东财实时行情返回，确保 /100 还原
        sample_resp = {"data": {"f57": "000001", "f58": "平安银行", "f43": 1234, "f60": 1200, "f44": 1250, "f45": 1190, "f46": 1210, "f47": 987654, "f71": 1220, "f168": 1.5, "f164": 0.8}}

        class DummyResp:
            def __init__(self, payload):
                self.payload = payload

            def raise_for_status(self):
                return None

            def json(self):
                return self.payload

        with mock.patch("eastmoney.requests.get", return_value=DummyResp(sample_resp)):
            quote = eastmoney.fetch_realtime_quote("000001")

        self.assertEqual(quote["code"], "000001")
        self.assertAlmostEqual(quote["last"], 12.34)
        self.assertAlmostEqual(quote["pre_close"], 12.0)
        self.assertAlmostEqual(quote["avg_price"], 12.2)
        self.assertEqual(quote["volume_ratio"], 0.8)

    def test_save_master_and_refresh(self):
        # 初次写入两条主表记录
        df = pd.DataFrame(
            [
                {
                    "code": "000001",
                    "market_id": 0,
                    "name": "平安银行",
                    "last": 12.0,
                    "chg_pct": 0.0,
                    "chg": 0.0,
                    "volume": 100,
                    "amount": 200,
                    "high": 13.0,
                    "low": 11.0,
                    "open": 12.0,
                    "pre_close": 12.0,
                    "total_mv": 1.0,
                    "float_mv": 1.0,
                    "pe_dynamic": 10.0,
                    "pb": 1.0,
                },
                {
                    "code": "600000",
                    "market_id": 1,
                    "name": "浦发银行",
                    "last": 10.0,
                    "chg_pct": 0.0,
                    "chg": 0.0,
                    "volume": 200,
                    "amount": 300,
                    "high": 10.5,
                    "low": 9.5,
                    "open": 10.0,
                    "pre_close": 10.0,
                    "total_mv": 2.0,
                    "float_mv": 2.0,
                    "pe_dynamic": 9.0,
                    "pb": 0.9,
                },
            ]
        )
        eastmoney.save_master_to_db(df)

        # 模拟实时行情刷新，仅更新价格相关字段
        mock_quote = {
            "code": "000001",
            "name": "平安银行",
            "last": 12.5,
            "pre_close": 12.0,
            "high": 12.8,
            "low": 11.8,
            "open": 12.1,
            "volume": 300,
            "avg_price": 12.3,
            "turnover_rate": 0.5,
            "volume_ratio": 1.1,
        }
        with mock.patch("eastmoney.fetch_realtime_quote", return_value=mock_quote):
            eastmoney.refresh_realtime_quotes_in_db(["000001"])

        conn = sqlite3.connect(self.tmp_db)
        try:
            row = conn.execute("SELECT last, chg, volume FROM a_stock_master WHERE code='000001';").fetchone()
        finally:
            conn.close()
        self.assertAlmostEqual(row[0], 12.5)
        self.assertAlmostEqual(row[1], 0.5)
        self.assertEqual(row[2], 300)

    def test_kline_parse_and_save(self):
        # 模拟返回一条日线记录
        sample_resp = {"data": {"klines": ["2024-01-02,1.0,2.0,2.5,0.9,1000,2000"]}}

        class DummyResp:
            def __init__(self, payload):
                self.payload = payload

            def raise_for_status(self):
                return None

            def json(self):
                return self.payload

        with mock.patch("eastmoney.requests.get", return_value=DummyResp(sample_resp)):
            df_kline = eastmoney.fetch_kline_history("000001")

        self.assertEqual(len(df_kline), 1)
        eastmoney.save_kline_to_db("000001", df_kline)

        conn = sqlite3.connect(self.tmp_db)
        try:
            row = conn.execute("SELECT code, date, open, close FROM a_stock_kline_daily WHERE code='000001';").fetchone()
        finally:
            conn.close()
        self.assertEqual(row[0], "000001")
        self.assertEqual(row[1], "2024-01-02")
        self.assertAlmostEqual(row[2], 1.0)
        self.assertAlmostEqual(row[3], 2.0)

    def test_is_trading_time(self):
        # 周三上午 10:00
        dt = eastmoney.datetime(2024, 1, 3, 10, 0)
        self.assertTrue(eastmoney.is_trading_time(dt))
        # 午休
        dt = eastmoney.datetime(2024, 1, 3, 12, 0)
        self.assertFalse(eastmoney.is_trading_time(dt))
        # 周末
        dt = eastmoney.datetime(2024, 1, 6, 10, 0)
        self.assertFalse(eastmoney.is_trading_time(dt))
        # 不同系统时区：UTC 02:00 等价沪深 10:00，仍应视为交易时段
        utc_morning = datetime(2024, 1, 3, 2, 0, tzinfo=timezone.utc)
        self.assertTrue(eastmoney.is_trading_time(utc_morning))
        # UTC 午休 04:00 等价沪深 12:00，应判定为非交易
        utc_noon = datetime(2024, 1, 3, 4, 0, tzinfo=timezone.utc)
        self.assertFalse(eastmoney.is_trading_time(utc_noon))


if __name__ == "__main__":
    unittest.main()
