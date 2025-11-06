
import pandas as pd
import ccxt
from pathlib import Path

def load_from_csv(path: str) -> pd.DataFrame:
    df = pd.read_csv(path, parse_dates=[0])
    df.columns = [c.capitalize() for c in df.columns]
    df = df.rename(columns={df.columns[0]: 'Date'})
    df = df.set_index('Date').sort_index()
    # Expected columns: Open, High, Low, Close, Volume
    return df[['Open','High','Low','Close','Volume']]

def load_from_ccxt(symbol: str, exchange: str = 'binance', timeframe: str = '1h', limit: int = 2000) -> pd.DataFrame:
    ex = getattr(ccxt, exchange)()
    ohlcv = ex.fetch_ohlcv(symbol, timeframe=timeframe, limit=limit)
    df = pd.DataFrame(ohlcv, columns=['Date','Open','High','Low','Close','Volume'])
    df['Date'] = pd.to_datetime(df['Date'], unit='ms')
    df = df.set_index('Date')
    return df

def load_prices(csv: str | None = None, symbol: str | None = None, exchange: str = 'binance', timeframe: str = '1h'):
    if csv and Path(csv).exists():
        return load_from_csv(csv)
    if symbol:
        return load_from_ccxt(symbol, exchange=exchange, timeframe=timeframe)
    raise ValueError("Provide either --csv or --symbol")
