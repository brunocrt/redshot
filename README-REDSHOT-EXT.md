
# Redshot: Risk-Boosted Upgrade Pack

This folder contains **drop-in modules** and a **research workflow** to add controlled, higher-conviction risk to your trading system.

## What's inside
- `redshot_ext/risk.py` — target-vol sizing, fractional Kelly overlay, ATR trailing, drawdown throttle, regime filter, correlation caps.
- `redshot_ext/strategy.py` — reference MA/RSI momentum strategy with pluggable params.
- `redshot_ext/portfolio.py` — backtest helpers (vectorbt) + portfolio caps.
- `redshot_ext/supervisor.py` — live-trading safety rails (DD throttles, kill switch hooks).
- `research/optuna_study.py` — walk-forward Optuna tuning maximizing Sortino with MaxDD/ES penalties.
- `research/loader.py` — data loaders from CSV or via CCXT (exchange API) for crypto pairs.
- `dashboards/streamlit_app.py` — minimal dashboard to inspect runs and metrics (points to `mlflow` artifacts if used).
- `.github/workflows/backtest.yml` — CI pipeline: nightly backtest + artifact upload.
- `requirements-ext.txt` — extra dependencies.

## Quick start

1. **Install extras**
   ```bash
   pip install -r requirements-ext.txt
   ```

2. **Backtest & tune** (example for BTC/USDT from Binance, 1h candles):
   ```bash
   export EXCHANGE=binance SYMBOL=BTC/USDT TIMEFRAME=1h
   python research/optuna_study.py --symbol "$SYMBOL" --exchange "$EXCHANGE" --timeframe "$TIMEFRAME" --trials 150
   ```

   Or use your local CSVs:
   ```bash
   python research/optuna_study.py --csv data/BTCUSDT_1h.csv
   ```

3. **Dashboard**
   ```bash
   streamlit run dashboards/streamlit_app.py
   ```

4. **CI**
   - Push `.github/workflows/backtest.yml` and configure repository secrets if using CCXT (API keys).

## Wire-up into your services

- **AD (Asset Advisor)**: Import `redshot_ext.risk.position_sizer` and `redshot_ext.risk.regime_filter` to propose sizes.
- **PR (Portfolio Manager)**: Apply `redshot_ext.risk.apply_caps` and `redshot_ext.risk.drawdown_throttle` before sending orders.
- **TB (Trade Broker)**: Keep as-is; this pack uses `vectorbt` for *simulated* execution and `ccxt` for data acquisition and can be used for paper/live too.
- **SS (Supervisor Service)**: Call `supervisor.live_safety_checks` on each cycle with recent equity/effects.

## Objective used for tuning

We maximize **Sortino (daily)** with penalties:
```
score = sortino - 0.5 * max_drawdown - 0.2 * expected_shortfall_95
```
Adjust the penalty weights to taste.

---

Generated: 2025-08-09T05:05:55.828865Z
