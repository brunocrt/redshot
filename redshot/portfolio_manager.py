"""
Portfolio management logic.

The **Portfolio Manager** maintains the current positions in the portfolio,
computes portfolio value based on market prices and tracks performance.  It
exposes methods to update the portfolio in response to executed trades and to
generate summary metrics.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from .entities import Asset, Position, Order, Trade, Performance
from .market_data import MarketResearcher


LOGGER = logging.getLogger(__name__)


@dataclass
class PortfolioManager:
    """Manages asset positions and calculates portfolio metrics."""

    researcher: MarketResearcher
    positions: Dict[str, Position] = field(default_factory=dict)  # keyed by asset code
    # Initial cash balance (in USD).  This represents the amount of money
    # available for investment.  It defaults to 1000 USD but can be set via
    # constructor or through the API.  The current cash balance is stored in
    # ``cash`` and is updated as trades are executed.
    initial_cash: float = 1000.0
    cash: float = 1000.0

    def __post_init__(self) -> None:
        # Ensure the cash balance starts equal to the initial cash
        self.cash = float(self.initial_cash)

    def update_position(self, trade: Trade) -> None:
        """
        Update positions after a trade has been executed.

        For a buy trade, increase the amount; for a sell trade, decrease it.  If
        the position does not exist, create it.
        """
        code = trade.asset.code
        pos = self.positions.get(code)
        # Update cash balance based on trade side and quantity.  Buy trades
        # decrease cash (price * quantity) while sell trades increase it.  We
        # assume all trades are positive quantities and the side attribute
        # indicates the direction.
        trade_value = trade.price * trade.quantity
        if trade.side == "buy":
            self.cash -= trade_value
        elif trade.side == "sell":
            self.cash += trade_value
        # Ensure cash does not drift due to floating point arithmetic
        self.cash = float(self.cash)
        # Update positions
        delta = trade.quantity if trade.side == "buy" else -trade.quantity
        if pos is None:
            self.positions[code] = Position(asset=trade.asset, amount=delta)
            LOGGER.debug("Created new position %s with amount %s", code, delta)
        else:
            pos.amount += delta
            LOGGER.debug("Updated position %s to new amount %s", code, pos.amount)

    def compute_portfolio_value(self) -> float:
        """
        Return the market value of all asset positions (excluding cash) using
        current prices.  Cash is not included in this value; see
        ``compute_total_value`` for the combined cash and positions value.
        """
        total_value = 0.0
        for code, pos in self.positions.items():
            price = self.researcher.get_price(pos.asset.market)
            if price is not None:
                value = pos.market_value(price)
                total_value += value
                LOGGER.debug(
                    "Position %s: amount %s * price %s = %s", code, pos.amount, price, value
                )
            else:
                LOGGER.warning("Price for %s unavailable, skipping valuation", code)
        LOGGER.info("Positions value: %s", total_value)
        return total_value

    def compute_total_value(self) -> float:
        """Return the total value of the portfolio including cash and positions."""
        positions_value = self.compute_portfolio_value()
        total = self.cash + positions_value
        LOGGER.info("Total portfolio value (cash + positions): %s", total)
        return total

    def compute_performance(
        self, previous_value: float, current_datetime
    ) -> Performance:
        """
        Calculate portfolio performance relative to a previous value.

        The variation is computed as `(current - previous) / previous`.  If the
        previous value is zero or unavailable, the variation is zero.
        """
        current_value = self.compute_total_value()
        variation = 0.0
        if previous_value > 0:
            variation = (current_value - previous_value) / previous_value
        LOGGER.info(
            "Performance snapshot: current_value=%s, previous_value=%s, variation=%s",
            current_value,
            previous_value,
            variation,
        )
        return Performance(portfolio_value=current_value, variation=variation, datetime=current_datetime)
