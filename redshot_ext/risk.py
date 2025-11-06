
import numpy as np
import pandas as pd

def annualize_vol(daily_std: pd.Series, periods_per_year: int = 365):
    return daily_std * np.sqrt(periods_per_year)

def target_vol_weights(returns: pd.Series,
                       target_vol: float = 0.20,
                       vol_window: int = 20,
                       max_weight: float = 0.20,
                       min_weight: float = 0.0) -> pd.Series:
    """Compute volatility-targeted weights for a single asset.
    returns: daily/periodic returns (not log).
    target_vol: annualized target volatility (e.g., 0.20 for 20%).
    """
    vol = returns.rolling(vol_window).std()
    ann_vol = annualize_vol(vol)
    with np.errstate(divide='ignore', invalid='ignore'):
        raw = (target_vol / ann_vol).replace([np.inf, -np.inf], 0.0)
    w = raw.clip(lower=min_weight, upper=max_weight).fillna(0.0)
    return w

def fractional_kelly(edge: pd.Series, odds: float = 1.0, f: float = 0.25) -> pd.Series:
    """Fractional Kelly fraction vector.
    edge: expected edge per trade/period (probability*odds - (1 - probability)).
    odds: payoff ratio (default 1:1).
    f: fraction of full Kelly to apply (0..1).
    """
    # A practical proxy: use recent Sharpe as edge proxy if proper edge unavailable.
    kelly = edge / odds
    return (kelly * f).clip(lower=0.0)

def atr(series: pd.DataFrame, period: int = 14) -> pd.Series:
    high, low, close = series['High'], series['Low'], series['Close']
    tr = pd.concat([
        (high - low),
        (high - close.shift()).abs(),
        (low - close.shift()).abs()
    ], axis=1).max(axis=1)
    return tr.rolling(period).mean()

def atr_trailing_stop(ohlc: pd.DataFrame, entry_price: pd.Series, k: float = 3.0, period: int = 14) -> pd.Series:
    """Returns a trailing stop series for long positions."""
    a = atr(ohlc, period)
    trail = (entry_price - k * a).cummax()  # ratchet only upward for long
    return trail

def drawdown(equity: pd.Series) -> pd.Series:
    peak = equity.cummax()
    dd = (equity / peak) - 1.0
    return dd

def drawdown_throttle(equity: pd.Series,
                      warn: float = -0.10,
                      hard: float = -0.15) -> float:
    """Return a risk multiplier based on current drawdown."""
    dd_now = drawdown(equity).iloc[-1] if len(equity) else 0.0
    if dd_now <= hard:
        return 0.0
    if dd_now <= warn:
        return 0.5
    return 1.0

def regime_filter(price: pd.Series, ma_window: int = 200, adx: pd.Series | None = None, adx_floor: float = 0.0) -> pd.Series:
    ma = price.rolling(ma_window).mean()
    regime = price > ma
    if adx is not None:
        regime = regime & (adx > adx_floor)
    return regime.fillna(False)

def apply_caps(weights: pd.DataFrame,
               per_asset_cap: float = 0.20,
               group_caps: dict[str, float] | None = None,
               groups: dict[str, str] | None = None) -> pd.DataFrame:
    w = weights.clip(upper=per_asset_cap)
    if group_caps and groups:
        df = pd.DataFrame({'group': pd.Series(groups)})
        for g, cap in group_caps.items():
            assets = df.index[df['group'] == g]
            if len(assets) == 0: 
                continue
            total = w[assets].sum(axis=1)
            scale = (cap / total).where(total > cap, 1.0)
            w[assets] = w[assets].mul(scale, axis=0)
    # normalize to <=1 total
    total_w = w.sum(axis=1)
    scale_all = (1.0 / total_w).where(total_w > 1.0, 1.0)
    w = w.mul(scale_all, axis=0)
    return w

def correlation_caps(returns: pd.DataFrame, threshold: float = 0.8, cap: float = 0.40) -> dict[tuple[str,str], float]:
    """Returns pairwise caps for highly correlated assets (info only)."""
    corr = returns.rolling(90).corr().dropna()
    pairs = {}
    if corr.empty:
        return pairs
    last_corr = corr.groupby(level=1).tail(returns.shape[1])
    cols = returns.columns.tolist()
    for i in range(len(cols)):
        for j in range(i+1, len(cols)):
            c = last_corr.loc[(cols[i], cols[j])]
            if isinstance(c, pd.Series):
                c = c.iloc[-1]
            if c >= threshold:
                pairs[(cols[i], cols[j])] = cap
    return pairs

def position_sizer(returns: pd.DataFrame,
                   target_vol: float = 0.20,
                   vol_window: int = 20,
                   max_weight: float = 0.20,
                   f_kelly: float = 0.25) -> pd.DataFrame:
    """Compute per-asset position sizes (weights) using target-vol and fractional Kelly proxy."""
    w = pd.DataFrame(index=returns.index, columns=returns.columns, dtype=float).fillna(0.0)
    for c in returns.columns:
        tv = target_vol_weights(returns[c], target_vol=target_vol, vol_window=vol_window, max_weight=max_weight)
        # proxy edge: rolling Sharpe (using mean/std). Avoid small windows to reduce noise.
        mu = returns[c].rolling(30).mean()
        sd = returns[c].rolling(30).std().replace(0, np.nan)
        sharpe_proxy = (mu / sd).fillna(0.0)
        fk = (sharpe_proxy * f_kelly).clip(lower=0.0, upper=1.0)
        w[c] = (tv * fk).clip(upper=max_weight).fillna(0.0)
    return w
