
import streamlit as st
import pandas as pd
import numpy as np
import vectorbt as vbt
from empyrical import max_drawdown, sortino_ratio
from research.loader import load_prices
from redshot_ext.strategy import signals_ma_rsi
from redshot_ext.risk import position_sizer

st.title("Redshot Dashboard — Risk-Boosted Backtest")

src = st.sidebar.selectbox('Data source', ['CCXT', 'CSV'])
if src == 'CSV':
    csv = st.sidebar.text_input('CSV path', 'data/BTCUSDT_1h.csv')
    df = load_prices(csv=csv)
else:
    symbol = st.sidebar.text_input('Symbol', 'BTC/USDT')
    exchange = st.sidebar.text_input('Exchange', 'binance')
    timeframe = st.sidebar.text_input('Timeframe', '1h')
    df = load_prices(symbol=symbol, exchange=exchange, timeframe=timeframe)

price = df['Close']
returns = price.pct_change().fillna(0.0)
rsi_win = st.sidebar.slider('RSI window', 7, 21, 14)
rsi = vbt.RSI.run(price, window=rsi_win).rsi

ma_fast = st.sidebar.slider('MA fast', 5, 50, 10)
ma_slow = st.sidebar.slider('MA slow', 80, 250, 200)
rsi_buy = st.sidebar.slider('RSI buy <', 10, 50, 35)
rsi_sell = st.sidebar.slider('RSI sell >', 50, 90, 65)

entries, exits = signals_ma_rsi(price, ma_fast, ma_slow, rsi, rsi_buy, rsi_sell)
fees = st.sidebar.slider('Fees', 0.0000, 0.0030, 0.0010, 0.0001)
slip = st.sidebar.slider('Slippage', 0.0000, 0.0020, 0.0005, 0.0001)

pf = vbt.Portfolio.from_signals(price, entries, exits, fees=fees, slippage=slip, size=1.0)

target_vol = st.sidebar.slider('Target vol (ann.)', 0.05, 0.60, 0.20, 0.01)
vol_win = st.sidebar.slider('Vol window', 5, 60, 20)
max_w = st.sidebar.slider('Max weight', 0.01, 0.50, 0.20, 0.01)
fkelly = st.sidebar.slider('Fractional Kelly', 0.0, 1.0, 0.25, 0.05)

w = position_sizer(returns.to_frame('asset'), target_vol=target_vol, vol_window=vol_win, max_weight=max_w, f_kelly=fkelly)['asset']
equity = (1 + pf.returns * w).cumprod()

st.line_chart(price, height=220)
st.line_chart(equity, height=220)

r = equity.pct_change().dropna()
sortino = float(sortino_ratio(r, period='daily') or 0.0)
mdd = float(abs(max_drawdown(equity)))
st.metric('Sortino (daily)', f"{sortino:.3f}")
st.metric('Max Drawdown', f"{mdd:.2%}")
