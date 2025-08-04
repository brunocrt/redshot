"""
Backend API server for the Redshot system.

This FastAPI application exposes a simple REST interface for the frontend UI.
It provides endpoints to query current portfolio state, list recorded trades and
trigger simulation cycles.  A lightweight SQLite database is used to store
executed trades for accounting purposes.  See `redshot/database.py` for
details on the database schema and configuration.
"""

from __future__ import annotations

import logging
import os
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi import Path, Query
from fastapi.middleware.cors import CORSMiddleware

from redshot.entities import Asset, Position
from redshot.market_data import MarketResearcher
from redshot.portfolio_manager import PortfolioManager
from redshot.asset_advisor import AssetAdvisor
from redshot.trade_broker import TradeBroker
from redshot.system_supervisor import SystemSupervisor
from redshot.database import init_db, get_all_trades
from redshot.config import get_exchange_credentials


LOGGER = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

app = FastAPI(title="Redshot API", version="0.1.0")

# Allow CORS from frontend (localhost:3000) during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve the compiled frontend if available.  In production, the Dockerfile copies
# the `frontend-dist` directory into the working directory.  Mount it here so
# that visiting `/` loads the React application.
if os.path.isdir("frontend-dist"):
    # Serve the compiled frontend from a dedicated static path.  Mount assets under
    # `/static` and return the index.html for the root path.  This avoids
    # interfering with API routes like `/api/...`.
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import FileResponse

    # Static assets (JavaScript, CSS, images) live in the `assets` folder.
    static_dir = os.path.join("frontend-dist", "assets")
    if os.path.isdir(static_dir):
        app.mount("/assets", StaticFiles(directory=static_dir), name="assets")

    index_path = os.path.join("frontend-dist", "index.html")

    @app.get("/")
    def serve_frontend() -> FileResponse:
        return FileResponse(index_path)

# Initialise global objects
researcher = MarketResearcher()
portfolio_manager = PortfolioManager(researcher)
advisor = AssetAdvisor(researcher)

try:
    creds = get_exchange_credentials("BINANCE")
    test_mode = False
except KeyError:
    creds = None
    test_mode = True

broker = TradeBroker(
    exchange_id="binance",
    api_key=creds.api_key if creds else "",
    api_secret=creds.api_secret if creds else "",
    test_mode=test_mode,
)

# Define assets to track; these could be configurable via API calls or config file.
# In addition to Bitcoin and Ethereum, include other high‑capitalisation assets
# with significant liquidity.  According to a Forbes report, cryptocurrencies
# with a market cap greater than $5 billion are typically more stable and
# widely adopted【666017706182758†L635-L637】.  We therefore add Binance Coin (BNB),
# Cardano (ADA), Ripple (XRP) and Solana (SOL) to the watch list.  CoinGecko's
# API allows us to retrieve market cap and trading volume data via the
# `/coins/markets` endpoint【913065948320041†L76-L80】【913065948320041†L142-L145】, making it easy to
# programmatically select assets with high liquidity.
assets = [
    Asset(code="BTC/USDT", name="Bitcoin", type="spot", market="bitcoin"),
    Asset(code="ETH/USDT", name="Ethereum", type="spot", market="ethereum"),
    Asset(code="BNB/USDT", name="Binance Coin", type="spot", market="binancecoin"),
    Asset(code="ADA/USDT", name="Cardano", type="spot", market="cardano"),
    Asset(code="XRP/USDT", name="Ripple", type="spot", market="ripple"),
    Asset(code="SOL/USDT", name="Solana", type="spot", market="solana"),
]

supervisor = SystemSupervisor(
    assets=assets,
    portfolio_manager=portfolio_manager,
    advisor=advisor,
    broker=broker,
    interval_seconds=3600,
    # Risk management parameters
    max_risk_pct=0.02,
    stop_loss_pct=0.05,
    trailing_stop_pct=0.05,
)


@app.on_event("startup")
def startup_event() -> None:
    """Initialise the database at application startup."""
    init_db()
    LOGGER.info("API server started")


@app.get("/api/portfolio")
def get_portfolio() -> dict:
    """
    Return current portfolio positions and total value.
    """
    # Total includes both cash and positions value
    total_value = portfolio_manager.compute_total_value()
    positions: List[dict] = []
    for code, position in portfolio_manager.positions.items():
        price = researcher.get_price(position.asset.market)
        positions.append({
            "asset": position.asset.code,
            "amount": position.amount,
            "price": price,
            "value": position.amount * price if price is not None else None,
        })
    return {
        "total_value": total_value,
        "cash": portfolio_manager.cash,
        "positions": positions,
    }


@app.get("/api/trades")
def list_trades() -> List[dict]:
    """Return a list of all recorded trades."""
    return get_all_trades()


@app.get("/api/trade_performance")
def trade_performance() -> List[dict]:
    """Return all trades along with their current profit/loss percentage."""
    records = get_all_trades()
    result = []
    for record in records:
        # Find the asset object to determine market ID
        asset_obj = next((a for a in assets if a.code == record["asset_code"]), None)
        current_price = None
        pnl_pct = None
        if asset_obj is not None:
            current_price = researcher.get_price(asset_obj.market)
            if current_price is not None and record["price"]:
                if record["side"].lower() == "buy":
                    pnl_pct = (current_price - record["price"]) / record["price"] * 100.0
                else:
                    pnl_pct = (record["price"] - current_price) / record["price"] * 100.0
        result.append(
            {
                **record,
                "current_price": current_price,
                "pnl_pct": pnl_pct,
            }
        )
    return result


@app.post("/api/simulate")
def simulate_once() -> dict:
    """
    Trigger a single supervisor cycle to simulate a trading iteration.  Returns
    the resulting portfolio value and variation.
    """
    previous_value = portfolio_manager.compute_portfolio_value()
    # Run a single cycle of data fetch, advice and (mock) trade execution
    supervisor.run_once()
    from datetime import datetime
    performance = portfolio_manager.compute_performance(previous_value, datetime.utcnow())
    return {
        "portfolio_value": performance.portfolio_value,
        "variation": performance.variation,
    }


# Additional endpoints for diagnostics and recommendations

@app.get("/api/recommendations")
def get_recommendations() -> list[dict]:
    """Return current recommendations for all tracked assets."""
    recs: list[dict] = []
    for asset in assets:
        # Use the advisor to compute a recommendation.  This will fetch market data.
        rec = advisor.advise(asset)
        recs.append(
            {
                "asset": rec.asset.code,
                "side": rec.side,
                "price": rec.price,
                "confidence": rec.confidence,
                "timestamp": rec.date.isoformat(),
            }
        )
    return recs


@app.get("/api/status")
def get_status() -> dict:
    """Return the timestamp of the last supervisor cycle and performance metrics."""
    if supervisor.last_cycle_start is None or supervisor.last_performance is None:
        return {
            "last_cycle": None,
            "portfolio_value": None,
            "variation": None,
            "pnl": None,
            "initial_capital": portfolio_manager.initial_cash,
        }
    perf = supervisor.last_performance
    # Compute profit/loss relative to initial capital
    pnl = None
    if portfolio_manager.initial_cash > 0:
        pnl = (perf.portfolio_value - portfolio_manager.initial_cash) / portfolio_manager.initial_cash
    return {
        "last_cycle": supervisor.last_cycle_start.isoformat() if supervisor.last_cycle_start else None,
        "portfolio_value": perf.portfolio_value,
        "variation": perf.variation,
        "pnl": pnl,
        "initial_capital": portfolio_manager.initial_cash,
    }


@app.get("/api/research_activity")
def get_research_activity() -> list[dict]:
    """Return recent activity of the market researcher and strategy used per asset."""
    activity = researcher.get_activity_log()
    results: list[dict] = []
    for asset in assets:
        log = activity.get(asset.market, {})
        price_info = log.get("price")
        hist_info = log.get("historical")
        # Determine the strategy used (assumes the first strategy applies to all assets)
        strategy_name = advisor.strategies[0].name if advisor.strategies else None
        strategy_description = advisor.strategies[0].description if advisor.strategies else None
        results.append(
            {
                "asset": asset.code,
                "price": price_info,
                "historical": hist_info,
                "strategy": {
                    "name": strategy_name,
                    "description": strategy_description,
                },
            }
        )
    return results


@app.get("/api/strategies")
def list_strategies() -> list[dict]:
    """Return metadata about all configured strategies."""
    info = []
    for strat in advisor.strategies:
        # Attempt to include key parameters if they exist
        params = {}
        # Some strategies may have arbitrary attributes such as window and threshold
        for attr_name in dir(strat):
            if not attr_name.startswith("_") and attr_name not in ("name", "description", "generate_recommendations"):
                try:
                    value = getattr(strat, attr_name)
                    # Only include simple types (int, float, str)
                    if isinstance(value, (int, float, str)):
                        params[attr_name] = value
                except Exception:
                    pass
        info.append(
            {
                "name": strat.name,
                "description": strat.description,
                "parameters": params,
            }
        )
    return info


# Endpoint to expose detailed strategy calculations.  Returns, for each
# tracked asset, the window size, average price, current price, delta,
# threshold, recommendation and timestamp of the most recent strategy
# execution.  This allows the frontend to display the raw numbers used
# in the strategy (e.g. the 7‑day moving average for the SMA strategy).

@app.get("/api/strategy_details")
def get_strategy_details() -> list[dict]:
    details: list[dict] = []
    for asset in assets:
        info = advisor.last_details.get(asset.code, None)
        if info is None:
            # If no details recorded yet, return placeholders.  Attempt to infer
            # expected keys based on the first strategy's attributes.
            strat = advisor.strategies[0] if advisor.strategies else None
            placeholder = {
                "asset": asset.code,
                "current_price": None,
                "recommendation": None,
                "timestamp": None,
            }
            # Include typical fields for EnhancedSMAStrategy
            if hasattr(strat, "short_window"):
                placeholder.update({
                    "short_window": None,
                    "long_window": None,
                    "short_sma": None,
                    "long_sma": None,
                    "average_volume": None,
                    "current_volume": None,
                    "rsi": None,
                    "threshold": getattr(strat, "threshold", None),
                })
            else:
                # Fallback simple strategy keys
                placeholder.update({
                    "window": None,
                    "average_price": None,
                    "delta": None,
                    "threshold": getattr(strat, "threshold", None) if strat else None,
                })
            details.append(placeholder)
        else:
            details.append({
                "asset": asset.code,
                **info,
            })
    return details


@app.get("/api/strategy_params")
def get_strategy_params() -> dict:
    """
    Return the current configuration of the first strategy (assumed to be
    ``EnhancedSMAStrategy``).  Clients can use this endpoint to display
    adjustable parameters to users.
    """
    strat = advisor.strategies[0] if advisor.strategies else None
    if strat is None:
        raise HTTPException(status_code=404, detail="No strategy configured")
    # Extract numeric parameters that can be tuned
    params = {}
    for name in ("short_window", "long_window", "threshold", "volume_window", "rsi_period", "overbought", "oversold"):
        if hasattr(strat, name):
            params[name] = getattr(strat, name)
    return params


@app.post("/api/strategy_params")
def set_strategy_params(payload: dict) -> dict:
    """
    Update the parameters of the first strategy.  Accepts a JSON payload
    containing any subset of supported fields (short_window, long_window,
    threshold, volume_window, rsi_period, overbought, oversold).  Values
    should be numeric (int or float).  Returns the updated parameter set.
    """
    strat = advisor.strategies[0] if advisor.strategies else None
    if strat is None:
        raise HTTPException(status_code=404, detail="No strategy configured")
    updated = {}
    for name, value in payload.items():
        if name in ("short_window", "long_window", "volume_window", "rsi_period"):
            try:
                ivalue = int(value)
            except Exception:
                raise HTTPException(status_code=400, detail=f"Invalid integer value for {name}")
            setattr(strat, name, ivalue)
            updated[name] = ivalue
        elif name in ("threshold", "overbought", "oversold"):
            try:
                fvalue = float(value)
            except Exception:
                raise HTTPException(status_code=400, detail=f"Invalid float value for {name}")
            setattr(strat, name, fvalue)
            updated[name] = fvalue
    # Recompute description to reflect new parameters
    strat.description = (
        f"Buy when price exceeds the {getattr(strat, 'short_window', '?')}-day SMA by more than"
        f" {getattr(strat, 'threshold', 0.0)*100:.1f}% and volume is above average; sell when price falls"
        f" below it by more than {getattr(strat, 'threshold', 0.0)*100:.1f}%. Additional filters: price must be above the"
        f" {getattr(strat, 'long_window', '?')}-day SMA for buys, avoid buys near resistance, avoid sells near support,"
        f" avoid buys when RSI>{getattr(strat, 'overbought', 0.0):.1f} and sells when RSI<{getattr(strat, 'oversold', 0.0):.1f}."
    )
    return updated


@app.get("/api/strategy_series/{asset_code:path}")
def get_strategy_series(
    asset_code: str = Path(..., description="Asset code, e.g. BTC/USDT"),
    days: int = Query(60, gt=1, le=365, description="Number of days of historical data"),
) -> dict:
    """
    Return historical series for a given asset including closing prices and
    moving averages used by the strategy.  This endpoint is intended for
    charting in the frontend.  It computes short and long SMAs based on
    the current strategy configuration.
    """
    # Find matching asset by code
    asset_obj = next((a for a in assets if a.code.lower() == asset_code.lower()), None)
    if asset_obj is None:
        raise HTTPException(status_code=404, detail=f"Unknown asset {asset_code}")
    # Get historical price/volume data
    data = researcher.get_historical_data(asset_obj.market, days=days)
    if not data:
        raise HTTPException(status_code=500, detail="Failed to retrieve historical data")
    prices = data.get("prices", [])
    strat = advisor.strategies[0] if advisor.strategies else None
    if strat is None:
        raise HTTPException(status_code=500, detail="No strategy configured")
    short_window = getattr(strat, "short_window", 7)
    long_window = getattr(strat, "long_window", 50)
    # Compute SMAs
    short_sma_series: List[Optional[float]] = []
    long_sma_series: List[Optional[float]] = []
    for i in range(len(prices)):
        if i + 1 < short_window:
            short_sma_series.append(None)
        else:
            window_prices = prices[i + 1 - short_window : i + 1]
            short_sma_series.append(sum(window_prices) / short_window)
        if i + 1 < long_window:
            long_sma_series.append(None)
        else:
            window_prices_long = prices[i + 1 - long_window : i + 1]
            long_sma_series.append(sum(window_prices_long) / long_window)
    # Build x axis labels as relative day offsets (e.g. -n .. 0)
    x = list(range(-len(prices) + 1, 1))
    return {
        "x": x,
        "prices": prices,
        "short_sma": short_sma_series,
        "long_sma": long_sma_series,
    }


@app.post("/api/initial_capital")
def set_initial_capital(payload: dict) -> dict:
    """
    Set the initial capital (cash) for the portfolio manager.  The payload
    should contain a numeric ``capital`` field.  The cash balance and
    initial_cash are both updated to this value.
    """
    capital = payload.get("capital") if isinstance(payload, dict) else None
    try:
        capital_value = float(capital)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid capital value")
    if capital_value < 0:
        raise HTTPException(status_code=400, detail="Capital must be non-negative")
    # Update portfolio manager balances
    portfolio_manager.initial_cash = capital_value
    portfolio_manager.cash = capital_value
    # Clear positions?  For now we leave positions unchanged
    return {
        "initial_capital": portfolio_manager.initial_cash,
        "cash": portfolio_manager.cash,
    }
