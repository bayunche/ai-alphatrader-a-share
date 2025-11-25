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
