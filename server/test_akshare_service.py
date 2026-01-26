import unittest
from unittest.mock import patch, MagicMock
import pandas as pd
import json
from akshare_service import app

class TestAkshareService(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    @patch('akshare.stock_zh_a_hist')
    def test_history_success(self, mock_hist):
        # Mock DataFrame
        mock_data = {
            "日期": ["2023-01-01", "2023-01-02"],
            "开盘": [10.0, 11.0],
            "收盘": [11.0, 12.0],
            "最高": [12.0, 13.0],
            "最低": [9.0, 10.0],
            "成交量": [1000, 2000],
            "成交额": [10000, 24000],
            "振幅": [3.0, 3.0],
            "涨跌幅": [10.0, 9.0],
            "涨跌额": [1.0, 1.0],
            "换手率": [1.0, 1.2]
        }
        mock_hist.return_value = pd.DataFrame(mock_data)

        # Test request
        response = self.app.get('/history?symbol=600000&days=5')
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertEqual(len(data['data']), 2)
        self.assertEqual(data['data'][0]['close'], 11.0)
        self.assertEqual(data['data'][1]['volume'], 2000)

    @patch('akshare.stock_zh_a_hist')
    def test_history_empty(self, mock_hist):
        mock_hist.return_value = pd.DataFrame()
        response = self.app.get('/history?symbol=600000')
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertEqual(data['data'], [])

    def test_history_no_symbol(self):
        response = self.app.get('/history')
        self.assertEqual(response.status_code, 400)

if __name__ == '__main__':
    unittest.main()
