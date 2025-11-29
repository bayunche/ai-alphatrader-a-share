"""
东方财富 A 股抓取与 SQLite 入库脚本。

提供主表全量拉取、实时行情刷新、日线 K 线存储的功能函数。
所有数据库操作仅使用 sqlite3 标准库，便于与现有 sidecar 共享。
"""

from __future__ import annotations

import os
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Dict, Iterable, List

import pandas as pd
import requests

# 数据库文件路径，可通过环境变量 DB_PATH 覆盖，默认当前目录 stock.db
DB_PATH = os.getenv("DB_PATH", "stock.db")

# 东财接口公共配置
CLIST_URL = "https://push2.eastmoney.com/api/qt/clist/get"
REALTIME_URL = "https://push2.eastmoney.com/api/qt/stock/get"
KLINE_URL = "https://push2his.eastmoney.com/api/qt/stock/kline/get"

# 固定字段映射
CLIST_FIELDS = "f12,f13,f14,f2,f3,f4,f5,f6,f15,f16,f17,f18,f20,f21,f9,f23"
REALTIME_FIELDS = "f57,f58,f43,f60,f44,f45,f46,f47,f71,f168,f164"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
    "Referer": "https://quote.eastmoney.com/",
}

# 固定沪深时区，避免服务器时区变化导致交易时段误判
SH_TZ = timezone(timedelta(hours=8))


def code_to_secid(code: str) -> str:
    """按规则将 6 位代码转换为 secid（6 开头为沪市 1，其余视为深市 0）。"""
    code = code.strip()
    market_prefix = "1" if code.startswith("6") else "0"
    return f"{market_prefix}.{code}"


def _now_str() -> str:
    """生成 ISO 风格时间字符串，精确到秒。"""
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")


def _log(msg: str) -> None:
    """简单日志输出，带时间戳，便于追踪运行状态。"""
    print(f"[{_now_str()}] {msg}")


def _safe_float(value) -> float:
    """将东财返回的字符串/数字转换为 float，无法解析时返回 0.0。"""
    try:
        if value in ("-", None, ""):
            return 0.0
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def fetch_a_stock_list() -> pd.DataFrame:
    """
    使用 clist/get 接口分页拉取全市场 A 股主表。

    返回字段：code, market_id, name, last, chg_pct, chg, volume, amount, high,
    low, open, pre_close, total_mv, float_mv, pe_dynamic, pb。
    """
    page = 1
    records: List[Dict] = []
    while True:
        params = {
            "pn": page,
            "pz": 100,
            "po": 1,
            "np": 1,
            "ut": "bd1d9ddb04089700cf9c27f6f7426281",
            "fltt": 2,
            "invt": 2,
            "fid": "f3",
            "fs": "m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23",
            "fields": CLIST_FIELDS,
        }
        resp = requests.get(CLIST_URL, params=params, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        json_data = resp.json()
        diff = json_data.get("data", {}).get("diff")
        if not diff:
            break
        # diff 可能是 list 也可能是 dict
        items = diff if isinstance(diff, list) else list(diff.values())
        for item in items:
            records.append(
                {
                    "code": item.get("f12"),
                    "market_id": item.get("f13"),
                    "name": item.get("f14"),
                    "last": _safe_float(item.get("f2")),
                    "chg_pct": _safe_float(item.get("f3")),
                    "chg": _safe_float(item.get("f4")),
                    "volume": _safe_float(item.get("f5")),
                    "amount": _safe_float(item.get("f6")),
                    "high": _safe_float(item.get("f15")),
                    "low": _safe_float(item.get("f16")),
                    "open": _safe_float(item.get("f17")),
                    "pre_close": _safe_float(item.get("f18")),
                    "total_mv": _safe_float(item.get("f20")),
                    "float_mv": _safe_float(item.get("f21")),
                    "pe_dynamic": _safe_float(item.get("f9")),
                    "pb": _safe_float(item.get("f23")),
                }
            )
        page += 1
    return pd.DataFrame(records)


def init_db() -> None:
    """创建 a_stock_master 和 a_stock_kline_daily 表及索引（若不存在）。"""
    conn = sqlite3.connect(DB_PATH)
    try:
        cursor = conn.cursor()
        cursor.executescript(
            """
            CREATE TABLE IF NOT EXISTS a_stock_master (
              code TEXT PRIMARY KEY,
              market_id INTEGER,
              name TEXT,
              last REAL,
              chg_pct REAL,
              chg REAL,
              volume INTEGER,
              amount REAL,
              high REAL,
              low REAL,
              open REAL,
              pre_close REAL,
              total_mv REAL,
              float_mv REAL,
              pe_dynamic REAL,
              pb REAL,
              last_updated TEXT
            );

            CREATE TABLE IF NOT EXISTS a_stock_kline_daily (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              code TEXT,
              date TEXT,
              open REAL,
              close REAL,
              high REAL,
              low REAL,
              volume REAL,
              amount REAL
            );

            CREATE UNIQUE INDEX IF NOT EXISTS idx_kline_code_date
            ON a_stock_kline_daily(code, date);
            """
        )
        conn.commit()
    finally:
        conn.close()


def save_master_to_db(df: pd.DataFrame) -> None:
    """将主表 DataFrame 写入 a_stock_master（存在则更新，不存在则插入）。"""
    if df.empty:
        return
    now_str = _now_str()
    conn = sqlite3.connect(DB_PATH)
    try:
        cursor = conn.cursor()
        sql = """
        INSERT INTO a_stock_master (
          code, market_id, name, last, chg_pct, chg, volume, amount, high, low,
          open, pre_close, total_mv, float_mv, pe_dynamic, pb, last_updated
        )
        VALUES (
          :code, :market_id, :name, :last, :chg_pct, :chg, :volume, :amount, :high,
          :low, :open, :pre_close, :total_mv, :float_mv, :pe_dynamic, :pb, :last_updated
        )
        ON CONFLICT(code) DO UPDATE SET
          market_id=excluded.market_id,
          name=excluded.name,
          last=excluded.last,
          chg_pct=excluded.chg_pct,
          chg=excluded.chg,
          volume=excluded.volume,
          amount=excluded.amount,
          high=excluded.high,
          low=excluded.low,
          open=excluded.open,
          pre_close=excluded.pre_close,
          total_mv=excluded.total_mv,
          float_mv=excluded.float_mv,
          pe_dynamic=excluded.pe_dynamic,
          pb=excluded.pb,
          last_updated=excluded.last_updated;
        """
        payload = df.to_dict(orient="records")
        for row in payload:
            row["last_updated"] = now_str
        cursor.executemany(sql, payload)
        conn.commit()
    finally:
        conn.close()


def fetch_realtime_quote(code: str) -> Dict:
    """
    获取单只股票实时行情并做字段映射，价格类字段除以 100 还原。
    返回字典包含 code, name, last, pre_close, high, low, open, volume, avg_price,
    turnover_rate, volume_ratio。
    """
    params = {
        "secid": code_to_secid(code),
        "fields": REALTIME_FIELDS,
        "fltt": 2,
        "invt": 2,
        "ut": "7eea3edcaed734bea9cbfc24409ed989",
    }
    resp = requests.get(REALTIME_URL, params=params, headers=HEADERS, timeout=10)
    resp.raise_for_status()
    data = resp.json().get("data") or {}

    def _p(field: str, scale: float = 1.0) -> float:
        return _safe_float(data.get(field)) / scale

    return {
        "code": data.get("f57") or code,
        "name": data.get("f58") or "",
        "last": _p("f43", 100),
        "pre_close": _p("f60", 100),
        "high": _p("f44", 100),
        "low": _p("f45", 100),
        "open": _p("f46", 100),
        "volume": _p("f47"),
        "avg_price": _p("f71", 100),
        "turnover_rate": _p("f168"),
        "volume_ratio": _p("f164"),
    }


def refresh_realtime_quotes_in_db(codes: Iterable[str]) -> None:
    """
    逐只刷新价格相关字段，只更新行情字段 + last_updated。
    若表中不存在该 code，默认插入一条含名称与推断 market_id 的记录，避免漏记。
    """
    codes = list(codes)
    if not codes:
        return
    now_str = _now_str()
    conn = sqlite3.connect(DB_PATH)
    try:
        cursor = conn.cursor()
        sql = """
        INSERT INTO a_stock_master (
          code, market_id, name, last, chg_pct, chg, volume, amount, high, low,
          open, pre_close, total_mv, float_mv, pe_dynamic, pb, last_updated
        )
        VALUES (
          :code, :market_id, :name, :last, :chg_pct, :chg, :volume, :amount, :high, :low,
          :open, :pre_close, :total_mv, :float_mv, :pe_dynamic, :pb, :last_updated
        )
        ON CONFLICT(code) DO UPDATE SET
          last=excluded.last,
          chg_pct=excluded.chg_pct,
          chg=excluded.chg,
          volume=excluded.volume,
          amount=excluded.amount,
          high=excluded.high,
          low=excluded.low,
          open=excluded.open,
          pre_close=excluded.pre_close,
          total_mv=excluded.total_mv,
          float_mv=excluded.float_mv,
          pe_dynamic=excluded.pe_dynamic,
          pb=excluded.pb,
          last_updated=excluded.last_updated;
        """
        for code in codes:
            quote = fetch_realtime_quote(code)
            market_id = 1 if (quote["code"] or code).startswith("6") else 0
            payload = {
                "code": quote["code"],
                "market_id": market_id,
                "name": quote["name"],
                "last": quote["last"],
                "chg_pct": 0,
                "chg": quote["last"] - quote["pre_close"],
                "volume": quote["volume"],
                "amount": 0,
                "high": quote["high"],
                "low": quote["low"],
                "open": quote["open"],
                "pre_close": quote["pre_close"],
                "total_mv": 0,
                "float_mv": 0,
                "pe_dynamic": 0,
                "pb": 0,
                "last_updated": now_str,
            }
            cursor.execute(sql, payload)
        conn.commit()
    finally:
        conn.close()


def fetch_kline_history(code: str, beg: str = "0", end: str = "99999999") -> pd.DataFrame:
    """
    获取日线前复权数据，解析为 DataFrame（列：date, open, close, high, low, volume, amount）。
    """
    params = {
        "secid": code_to_secid(code),
        "klt": "101",
        "fqt": "1",
        "beg": beg,
        "end": end,
    }
    resp = requests.get(KLINE_URL, params=params, headers=HEADERS, timeout=10)
    resp.raise_for_status()
    data = resp.json().get("data", {})
    klines = data.get("klines") or []
    parsed = []
    for row in klines:
        # 行格式：日期,开盘价,收盘价,最高价,最低价,成交量,成交额,...
        parts = row.split(",")
        if len(parts) < 7:
            continue
        parsed.append(
            {
                "date": parts[0],
                "open": _safe_float(parts[1]),
                "close": _safe_float(parts[2]),
                "high": _safe_float(parts[3]),
                "low": _safe_float(parts[4]),
                "volume": _safe_float(parts[5]),
                "amount": _safe_float(parts[6]),
            }
        )
    return pd.DataFrame(parsed)


def save_kline_to_db(code: str, df_kline: pd.DataFrame) -> None:
    """将日线数据 upsert 到 a_stock_kline_daily（code+date 唯一）。"""
    if df_kline.empty:
        return
    conn = sqlite3.connect(DB_PATH)
    try:
        cursor = conn.cursor()
        sql = """
        INSERT OR REPLACE INTO a_stock_kline_daily (
          code, date, open, close, high, low, volume, amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
        """
        payload = [
            (
                code,
                row["date"],
                row["open"],
                row["close"],
                row["high"],
                row["low"],
                row["volume"],
                row["amount"],
            )
            for _, row in df_kline.iterrows()
        ]
        cursor.executemany(sql, payload)
        conn.commit()
    finally:
        conn.close()


def is_trading_time(now: datetime | None = None) -> bool:
    """
    判断当前是否处于 A 股交易时段（工作日 09:30-11:30、13:00-15:00）。
    非交易时段用于跳过实时价格刷新，但仍可拉取基础主表。
    """
    # 固定到沪深时区，避免服务器时区为 UTC 等导致误判
    base = now or datetime.now(tz=SH_TZ)
    if base.tzinfo is None:
        base = base.replace(tzinfo=SH_TZ)
    else:
        base = base.astimezone(SH_TZ)

    # 周一=0 ... 周日=6，周末不交易
    if base.weekday() >= 5:
        return False
    hhmm = base.strftime("%H%M")
    return ("0930" <= hhmm <= "1130") or ("1300" <= hhmm <= "1500")


def main() -> None:
    """
    示例流程：
    1) 初始化数据库与表结构
    2) 全量拉取 A 股主表并写入 SQLite
    3) 从数据库取出部分代码刷新实时价格字段
    4) 针对示例代码获取日线历史并入库
    """
    init_db()
    _log(f"数据库初始化完成，路径：{DB_PATH}")

    master_df = fetch_a_stock_list()
    _log(f"主表拉取完成，记录数：{len(master_df)}")
    save_master_to_db(master_df)
    _log("主表已写入 a_stock_master。")

    # 取前 N 只股票做示例刷新
    conn = sqlite3.connect(DB_PATH)
    try:
        codes = [row[0] for row in conn.execute("SELECT code FROM a_stock_master LIMIT 5;")]
    finally:
        conn.close()

    trading = is_trading_time()
    if trading and codes:
        refresh_realtime_quotes_in_db(codes)
        _log(f"交易时段，已刷新 {len(codes)} 只股票的实时价格。")
        sample_code = codes[0]
    elif trading:
        sample_code = "000001"
        refresh_realtime_quotes_in_db([sample_code])
        _log("交易时段且表为空，使用 000001 进行示例刷新。")
    else:
        sample_code = codes[0] if codes else "000001"
        _log("非交易时段，跳过实时价格刷新，仅拉取主表和日线示例。")

    kline_df = fetch_kline_history(sample_code)
    save_kline_to_db(sample_code, kline_df)
    _log(f"{sample_code} 日线数据已写入，共 {len(kline_df)} 条。")


if __name__ == "__main__":
    main()
