
import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join("server", "database.sqlite")

def seed():
    print(f"Seeding {DB_PATH}...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Ensure table exists
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS a_stock_master (
        code TEXT PRIMARY KEY,
        market_id INTEGER,
        name TEXT,
        last REAL,
        chg_pct REAL,
        chg REAL,
        volume REAL,
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
    """)
    
    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    
    stocks = [
        ("600519", 1, "贵州茅台", 1700.0, 1.5, 25.0, 50000, 85000000, 1710.0, 1690.0, 1695.0, 1675.0, 210000000, 210000000, 30.5, 8.2),
        ("000001", 0, "平安银行", 10.5, -0.5, -0.05, 1000000, 10500000, 10.6, 10.4, 10.55, 10.55, 200000, 200000, 6.5, 0.8),
        ("300750", 0, "宁德时代", 180.0, 2.0, 3.6, 200000, 36000000, 182.0, 178.0, 179.0, 176.4, 800000, 700000, 25.0, 4.5),
        ("601127", 1, "赛力斯", 90.0, 5.0, 4.3, 300000, 27000000, 92.0, 88.0, 88.5, 85.7, 130000, 130000, 50.0, 10.0),
        ("002594", 0, "比亚迪", 240.0, 0.0, 0.0, 150000, 36000000, 242.0, 238.0, 240.0, 240.0, 700000, 600000, 22.0, 4.0)
    ]
    
    sql = """
    INSERT OR REPLACE INTO a_stock_master (
      code, market_id, name, last, chg_pct, chg, volume, amount, high, low,
      open, pre_close, total_mv, float_mv, pe_dynamic, pb, last_updated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    
    count = 0
    for s in stocks:
        record = s + (now_str,)
        cursor.execute(sql, record)
        count += 1
        
    conn.commit()
    conn.close()
    print(f"Seeded {count} records successfully.")

if __name__ == "__main__":
    seed()
