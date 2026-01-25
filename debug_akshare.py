
import akshare as ak
import traceback

print("Testing Akshare...")
try:
    print("Fetching stock_zh_a_spot_em...")
    df = ak.stock_zh_a_spot_em()
    print(f"Success! Retrieved {len(df)} records.")
    print(df.head())
except Exception:
    traceback.print_exc()
