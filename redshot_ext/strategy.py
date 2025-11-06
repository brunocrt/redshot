
import pandas as pd

def signals_ma_rsi(price: pd.Series, ma_fast: int, ma_slow: int, rsi: pd.Series, rsi_buy: int, rsi_sell: int):
    fast = price.rolling(ma_fast).mean()
    slow = price.rolling(ma_slow).mean()
    long = (fast > slow) & (rsi < rsi_buy)
    exit_long = (rsi > rsi_sell) | (fast < slow)
    entries = long & ~long.shift(1).fillna(False)
    exits = exit_long & ~exit_long.shift(1).fillna(False)
    return entries.fillna(False), exits.fillna(False)
