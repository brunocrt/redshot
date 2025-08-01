"""
Example entry point for the Redshot proof‑of‑concept.

This script demonstrates how the various components of the Redshot system can
be assembled and run together.  It constructs a market researcher, portfolio
manager, asset advisor with a simple moving average strategy, trade broker
(running in test mode by default), and a system supervisor that orchestrates
their interaction.

Run this module directly to execute a single cycle of data retrieval,
analysis and (mock) trading.  Adjust the `assets` list and configuration as
needed.
"""

from __future__ import annotations

import logging
import os

from .entities import Asset
from .market_data import MarketResearcher
from .portfolio_manager import PortfolioManager
from .asset_advisor import AssetAdvisor
from .trade_broker import TradeBroker
from .system_supervisor import SystemSupervisor
from .config import get_exchange_credentials


def configure_logging() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")


def main() -> None:
    configure_logging()
    # Initialise database for storing trades
    from .database import init_db

    init_db()
    # Create a market researcher (CoinGecko)
    researcher = MarketResearcher()
    # Create a portfolio manager
    portfolio = PortfolioManager(researcher)
    # Create an asset advisor with default strategies
    advisor = AssetAdvisor(researcher)
    # Determine exchange credentials; default to environment variables
    try:
        creds = get_exchange_credentials("BINANCE")  # example: use Binance
        test_mode = False
    except KeyError:
        # If credentials are not set, operate in test mode
        creds = None
        test_mode = True
    # Create the trade broker
    broker = TradeBroker(
        exchange_id="binance",  # or another exchange supported by ccxt
        api_key=creds.api_key if creds else "",
        api_secret=creds.api_secret if creds else "",
        test_mode=test_mode,
    )
    # Define the assets we want to track/trade
    assets = [
        Asset(code="BTC/USDT", name="Bitcoin", type="spot", market="bitcoin"),
        Asset(code="ETH/USDT", name="Ethereum", type="spot", market="ethereum"),
    ]
    # Create the supervisor
    supervisor = SystemSupervisor(
        assets=assets,
        portfolio_manager=portfolio,
        advisor=advisor,
        broker=broker,
        interval_seconds=3600,
    )
    # Run a single cycle for demonstration
    supervisor.run_once()


if __name__ == "__main__":
    main()
