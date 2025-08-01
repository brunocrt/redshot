"""
Orchestration and supervision for the Redshot system.

The **System Supervisor** ties together all other components.  It manages
communication between the portfolio manager, asset advisor, market researcher
and trade broker.  In a production deployment this component would also
handle scheduling, health checks, error reporting and persistence.  Here we
provide a simple synchronous loop for demonstration purposes.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from datetime import datetime
from typing import List

from .entities import Asset, Trade, Performance
from .market_data import MarketResearcher
from .portfolio_manager import PortfolioManager
from .asset_advisor import AssetAdvisor
from .trade_broker import TradeBroker


LOGGER = logging.getLogger(__name__)


@dataclass
class SystemSupervisor:
    """
    Coordinates periodic data fetching, strategy evaluation and trade execution.

    A single call to `run_once()` will fetch fresh data for each tracked asset,
    obtain a recommendation from the advisor, execute a trade if appropriate
    and update the portfolio.  In a real system this would run continuously
    with proper timing and error handling.
    """

    assets: List[Asset]
    portfolio_manager: PortfolioManager
    advisor: AssetAdvisor
    broker: TradeBroker
    interval_seconds: int = 3600  # default hourly

    # The following fields capture the most recent supervisor cycle information.  They
    # are updated on each call to ``run_once`` so that external components (e.g.
    # the API server) can report the latest status without re‑executing a cycle.
    last_cycle_start: datetime | None = None
    last_performance: Performance | None = None

    def run_once(self) -> None:
        """Execute one cycle of data retrieval, analysis and trading."""
        start_time = datetime.utcnow()
        self.last_cycle_start = start_time
        LOGGER.info("Starting supervisor cycle at %s", start_time.isoformat())
        # Compute previous total value (cash + positions)
        previous_value = self.portfolio_manager.compute_total_value()
        for asset in self.assets:
            recommendation = self.advisor.advise(asset)
            # Only attempt a trade if we have a clear buy or sell signal and a valid price
            if recommendation.side in ("buy", "sell") and recommendation.price:
                # Determine the maximum quantity we can trade based on current cash or holdings.
                quantity = 1.0  # default target quantity per trade
                if recommendation.side == "buy":
                    # For buy trades, compute the maximum quantity we can afford.  We
                    # invest all available cash into the asset, thereby purchasing
                    # fractional units if necessary.  If there is no available
                    # cash or price is invalid, we skip the trade.
                    max_affordable = self.portfolio_manager.cash / recommendation.price
                    quantity = max_affordable
                    if quantity <= 0:
                        LOGGER.info(
                            "Insufficient cash to buy %s; skipping trade", asset.code
                        )
                        continue
                else:  # sell
                    # For sell trades, liquidate the entire position.  Only proceed
                    # if we hold a positive amount.
                    pos = self.portfolio_manager.positions.get(asset.code)
                    if pos is None or pos.amount <= 0:
                        LOGGER.info(
                            "No position available to sell %s; skipping trade", asset.code
                        )
                        continue
                    quantity = pos.amount
                # Execute the trade via the broker
                trade = self.broker.place_order(
                    asset=asset,
                    side=recommendation.side,
                    quantity=quantity,
                    price=recommendation.price,
                    order_type="market",
                )
                if trade:
                    # Update portfolio positions and cash
                    self.portfolio_manager.update_position(trade)
        # Record performance snapshot
        performance = self.portfolio_manager.compute_performance(previous_value, datetime.utcnow())
        # Save the performance for external access
        self.last_performance = performance
        LOGGER.info(
            "Cycle complete. Portfolio value: %s, variation: %.2f%%",
            performance.portfolio_value,
            performance.variation * 100,
        )

    def run(self) -> None:
        """
        Continuously run the supervisor at regular intervals.  Press Ctrl+C to
        stop.  Each cycle calls `run_once()` then sleeps for the configured
        interval.
        """
        try:
            while True:
                self.run_once()
                LOGGER.info("Sleeping for %d seconds", self.interval_seconds)
                time.sleep(self.interval_seconds)
        except KeyboardInterrupt:
            LOGGER.info("Supervisor stopped by user")
