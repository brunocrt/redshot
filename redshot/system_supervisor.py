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
from dataclasses import dataclass, field
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

    # Risk management parameters.  ``max_risk_pct`` defines the maximum
    # proportion of the portfolio’s total value to risk on any single trade
    # (e.g. 0.02 for 2%).  ``stop_loss_pct`` sets a hard stop‑loss below the
    # entry price, while ``trailing_stop_pct`` defines the trailing stop
    # distance as a percentage of the highest price achieved since entry.
    max_risk_pct: float = 0.02
    stop_loss_pct: float = 0.05
    trailing_stop_pct: float = 0.05

    # Internal state used to track stop‑loss and trailing stops for each asset.
    # Keys are asset codes; values contain ``entry_price``, ``stop_loss``,
    # ``highest_price`` and ``trailing_stop``.
    stop_levels: dict = field(default_factory=dict)

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
            # Start by retrieving the strategy recommendation
            recommendation = self.advisor.advise(asset)
            current_price = recommendation.price
            # If we hold a position, update trailing stop and check stop losses
            pos = self.portfolio_manager.positions.get(asset.code)
            if pos and pos.amount > 0 and current_price:
                level = self.stop_levels.get(asset.code)
                if level:
                    # Update highest price since entry
                    if current_price > level["highest_price"]:
                        level["highest_price"] = current_price
                    # Calculate trailing stop price
                    trailing_price = level["highest_price"] * (1.0 - self.trailing_stop_pct)
                    level["trailing_stop"] = trailing_price
                    # Check if price has fallen below stop loss or trailing stop
                    if current_price <= level["stop_loss"] or current_price <= trailing_price:
                        LOGGER.info(
                            "%s hit stop loss/trailing stop (current=%.4f, stop=%.4f, trailing=%.4f), overriding to sell",
                            asset.code,
                            current_price,
                            level["stop_loss"],
                            trailing_price,
                        )
                        # Override recommendation to sell
                        recommendation = recommendation.__class__(
                            asset=recommendation.asset,
                            exchange=recommendation.exchange,
                            side="sell",
                            price=current_price,
                            date=recommendation.date,
                            confidence=recommendation.confidence,
                        )
            # Only attempt a trade if we have a clear buy or sell signal and a valid price
            if recommendation.side in ("buy", "sell") and current_price:
                if recommendation.side == "buy":
                    # Compute total portfolio value for risk sizing
                    total_value = self.portfolio_manager.compute_total_value()
                    # Determine the risk capital available: max risk % times total value
                    max_investment = total_value * self.max_risk_pct
                    # Never exceed available cash
                    invest_dollars = min(self.portfolio_manager.cash, max_investment)
                    quantity = invest_dollars / current_price if current_price > 0 else 0
                    if quantity <= 0:
                        LOGGER.info(
                            "Insufficient cash to buy %s; skipping trade", asset.code
                        )
                        continue
                else:  # sell
                    # Sell the entire position
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
                    price=current_price,
                    order_type="market",
                )
                if trade:
                    # Update portfolio positions and cash
                    self.portfolio_manager.update_position(trade)
                    # On buy, set initial stop loss and tracking levels
                    if recommendation.side == "buy":
                        entry_price = current_price
                        stop_price = entry_price * (1.0 - self.stop_loss_pct)
                        self.stop_levels[asset.code] = {
                            "entry_price": entry_price,
                            "stop_loss": stop_price,
                            "highest_price": entry_price,
                            "trailing_stop": entry_price * (1.0 - self.trailing_stop_pct),
                        }
                    # On sell, clear any stop level
                    elif recommendation.side == "sell" and asset.code in self.stop_levels:
                        del self.stop_levels[asset.code]
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
