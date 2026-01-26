"""
Akshare 微服务：为 Node 后端提供实时行情与主表兜底接口
依赖：pip install akshare flask
启动：python akshare_service.py --port 5001
接口：
- GET /quotes?symbols=000001,600000 返回实时价等基础字段
- GET /master 返回全部 A 股代码/名称（价格仅参考）
"""

from flask import Flask, jsonify, request
import akshare as ak

app = Flask(__name__)


def _ok(data):
  return jsonify({"success": True, "data": data})


@app.route("/quotes")
def quotes():
  symbols_str = request.args.get("symbols", "")
  if not symbols_str:
    return jsonify({"success": False, "error": "symbols required"}), 400
  symbols = [s.strip() for s in symbols_str.split(",") if s.strip()]
  df = ak.stock_zh_a_spot_em()
  df = df[df["代码"].isin(symbols)]
  data = []
  for _, row in df.iterrows():
    data.append({
      "symbol": row["代码"],
      "name": row["名称"],
      "price": float(row["最新价"]) if "最新价" in row else 0,
      "prevClose": float(row["昨收"]) if "昨收" in row else 0,
      "high": float(row["最高"]) if "最高" in row else 0,
      "low": float(row["最低"]) if "最低" in row else 0,
      "open": float(row["今开"]) if "今开" in row else 0,
      "volume": float(row["成交量"]) if "成交量" in row else 0,
      "amount": float(row["成交额"]) if "成交额" in row else 0,
    })
  return _ok(data)


@app.route("/history")
def history():
  symbol = request.args.get("symbol", "")
  if not symbol:
    return jsonify({"success": False, "error": "symbol required"}), 400
  
  # Default last 20 days
  days = request.args.get("days", 20)
  try:
      days = int(days)
  except:
      days = 20
      
  # Akshare requires specific date range or it returns all. 
  # For simplicity, we fetch all (default) or use start_date if needed, 
  # but stock_zh_a_hist is fast enough for recent data usually.
  # Adjust symbol format: 600000 -> 600000
  try:
    df = ak.stock_zh_a_hist(symbol=symbol, period="daily", adjust="qfq")
    if df.empty:
       return jsonify({"success": True, "data": []})
    
    # Take last N
    df = df.tail(days)
    
    data = []
    for _, row in df.iterrows():
      data.append({
        "date": row["日期"],
        "open": float(row["开盘"]),
        "close": float(row["收盘"]),
        "high": float(row["最高"]),
        "low": float(row["最低"]),
        "volume": float(row["成交量"]),
        "amount": float(row["成交额"]),
        "amplitude": float(row["振幅"]),
        "change_pct": float(row["涨跌幅"]),
        "change_amt": float(row["涨跌额"]),
        "turnover": float(row["换手率"])
      })
    return _ok(data)
  except Exception as e:
    return jsonify({"success": False, "error": str(e)}), 500


@app.route("/master")
def master():
  df = ak.stock_zh_a_spot_em()
  data = []
  for _, row in df.iterrows():
    data.append({
      "symbol": row["代码"],
      "name": row["名称"],
      "price": float(row["最新价"]) if "最新价" in row else 0,
      "change": float(row["涨跌幅"]) if "涨跌幅" in row else 0,
      "volume": float(row["成交量"]) if "成交量" in row else 0,
      "market_id": 1 if str(row["代码"]).startswith("6") else 0,
    })
  return _ok(data)


if __name__ == "__main__":
  import argparse
  import os
  parser = argparse.ArgumentParser()
  parser.add_argument("--host", default="0.0.0.0")
  parser.add_argument("--port", type=int, default=int(os.getenv("AK_PORT", "18118")))
  args = parser.parse_args()
  app.run(host=args.host, port=args.port)
