
import argparse, optuna, numpy as np, pandas as pd, vectorbt as vbt
from empyrical import max_drawdown, sortino_ratio
from redshot_ext.strategy import signals_ma_rsi
from redshot_ext.risk import position_sizer, apply_caps
from research.loader import load_prices

def objective_builder(df: pd.DataFrame, trials: int = 150):
    price = df['Close']
    returns = price.pct_change().fillna(0.0)

    rsi = vbt.RSI.run(price, window=14).rsi

    def objective(trial: optuna.Trial) -> float:
        p = dict(
            ma_fast=trial.suggest_int('ma_fast', 5, 50),
            ma_slow=trial.suggest_int('ma_slow', 80, 250),
            rsi_buy=trial.suggest_int('rsi_buy', 25, 45),
            rsi_sell=trial.suggest_int('rsi_sell', 55, 75),
            vol_win=trial.suggest_int('vol_win', 10, 30),
            target_vol=trial.suggest_float('target_vol', 0.10, 0.40),
            max_w=trial.suggest_float('max_w', 0.05, 0.25),
            f_kelly=trial.suggest_float('f_kelly', 0.1, 0.5),
            fees=trial.suggest_float('fees', 0.0005, 0.002),
            slippage=trial.suggest_float('slippage', 0.0002, 0.001)
        )
        entries, exits = signals_ma_rsi(price, p['ma_fast'], p['ma_slow'], rsi, p['rsi_buy'], p['rsi_sell'])

        pf = vbt.Portfolio.from_signals(price, entries, exits, fees=p['fees'], slippage=p['slippage'], size=1.0)
        w = position_sizer(returns.to_frame('asset'), target_vol=p['target_vol'], vol_window=p['vol_win'],
                           max_weight=p['max_w'], f_kelly=p['f_kelly'])['asset']
        equity = (1 + pf.returns * w).cumprod()

        r = equity.pct_change().dropna()
        sortino = sortino_ratio(r, period='daily') or 0.0
        mdd = float(abs(max_drawdown(equity)))
        # Expected shortfall (CVaR) @ 95%
        tail = r[r < r.quantile(0.05)]
        es95 = float(abs(tail.mean())) if len(tail) else 0.0
        score = sortino - 0.5*mdd - 0.2*es95
        return float(score)

    return objective

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--csv', type=str, default=None)
    ap.add_argument('--symbol', type=str, default=None)
    ap.add_argument('--exchange', type=str, default='binance')
    ap.add_argument('--timeframe', type=str, default='1h')
    ap.add_argument('--trials', type=int, default=150)
    args = ap.parse_args()

    df = load_prices(args.csv, args.symbol, args.exchange, args.timeframe)
    study = optuna.create_study(direction='maximize')
    study.optimize(objective_builder(df), n_trials=args.trials)
    print('Best params:', study.best_params)
    print('Best value:', study.best_value)

if __name__ == '__main__':
    main()
