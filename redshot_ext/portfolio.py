
import numpy as np
import pandas as pd
import vectorbt as vbt
from empyrical import max_drawdown, sortino_ratio
from .risk import position_sizer, apply_caps

def build_portfolio(price: pd.Series, entries: pd.Series, exits: pd.Series,
                    fees: float = 0.001, slippage: float = 0.0005):
    pf = vbt.Portfolio.from_signals(price, entries, exits, fees=fees, slippage=slippage, size=1.0)
    return pf

def apply_weights(pf: vbt.portfolio.base.Portfolio, returns: pd.Series, weights: pd.Series):
    equity = (1 + pf.returns.fillna(0) * weights.fillna(0)).cumprod()
    return equity

def metrics_from_equity(equity: pd.Series):
    r = equity.pct_change().dropna()
    srt = (sortino_ratio(r, period='daily') or 0.0)
    mdd = float(abs(max_drawdown(equity)))
    return {'sortino': float(srt), 'maxdd': mdd}
