"""
Investment strategy and recommendation engine.

The **Asset Advisor** applies one or more strategies to market data to
determine whether the system should buy, sell or hold assets.  Strategies
inherit from the base `Strategy` class defined in `entities.py`.  This module
includes an example simple moving average (SMA) strategy for demonstration
purposes.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict

from .entities import Asset, Recommendation, Strategy, Exchange
from .market_data import MarketResearcher


LOGGER = logging.getLogger(__name__)


class SimpleMovingAverageStrategy(Strategy):
    """
    A naive moving‑average strategy.

    The strategy compares the current price to the average of the past `window`
    days.  If the current price is above the average by a threshold, it emits
    a **buy** recommendation.  If the price is below the average by a threshold,
    it emits a **sell** recommendation.  Otherwise it recommends to hold.

    This is meant to illustrate how a strategy can be implemented; it should
    not be considered a profitable trading strategy in isolation.
    """

    def __init__(self, window: int = 7, threshold: float = 0.02):
        super().__init__(
            name="Simple Moving Average Strategy",
            description=(
                f"Buy when price exceeds the {window}-day average by more than {threshold*100:.1f}%, "
                f"sell when price falls below it by more than {threshold*100:.1f}%"
            ),
        )
        self.window = window
        self.threshold = threshold

    def generate_recommendations(
        self,
        asset: Asset,
        historical_prices: List[float],
        current_price: float,
    ) -> Recommendation:
        if not historical_prices:
            return Recommendation(
                asset=asset,
                exchange=Exchange(name="unknown"),
                side="hold",
                price=current_price,
                date=datetime.utcnow(),
                confidence=0.0,
            )
        # Compute the average of the most recent `window` prices
        window_prices = historical_prices[-self.window:]
        average_price = sum(window_prices) / len(window_prices)
        delta = (current_price - average_price) / average_price
        side = "hold"
        confidence = abs(delta)
        if delta > self.threshold:
            side = "buy"
        elif delta < -self.threshold:
            side = "sell"
        LOGGER.debug(
            "SMA strategy for %s: current=%.4f, avg=%.4f, delta=%.4f, side=%s",
            asset.code,
            current_price,
            average_price,
            delta,
            side,
        )
        return Recommendation(
            asset=asset,
            exchange=Exchange(name="unknown"),
            side=side,
            price=current_price,
            date=datetime.utcnow(),
            confidence=float(min(confidence, 1.0)),
        )


@dataclass
class AssetAdvisor:
    """
    Coordinates one or more strategies and produces recommendations for assets.
    """

    researcher: MarketResearcher
    strategies: List[Strategy] = field(default_factory=lambda: [SimpleMovingAverageStrategy()])
    # Track the details of the most recent strategy calculation for each asset.
    # Keys are asset codes; values include window, average_price, current_price,
    # delta, threshold, recommendation and timestamp.  This allows external
    # components to inspect the underlying calculations (e.g. the 7‑day
    # moving average) for transparency.
    last_details: Dict[str, dict] = field(default_factory=dict)

    def advise(self, asset: Asset) -> Recommendation:
        """
        Produce a recommendation for a given asset by applying all configured
        strategies and aggregating the results.  Currently this method simply
        returns the recommendation from the first strategy; more complex logic
        (e.g. voting or weighted scoring) can be added here.
        """
        # Fetch current and historical data
        current_price = self.researcher.get_price(asset.market)
        historical_prices = self.researcher.get_historical_prices(asset.market, days=30) or []
        if current_price is None:
            LOGGER.warning("Current price unavailable for %s; holding", asset.code)
            return Recommendation(
                asset=asset,
                exchange=Exchange(name="unknown"),
                side="hold",
                price=None,
                date=datetime.utcnow(),
                confidence=0.0,
            )
        # Apply the first strategy
        strategy = self.strategies[0]
        recommendation = strategy.generate_recommendations(asset, historical_prices, current_price)

        # Capture calculation details for inspection.  Compute the average of
        # the last ``window`` prices and the delta relative to the current price.
        avg_price = None
        delta = None
        if historical_prices:
            window_prices = historical_prices[-getattr(strategy, "window", len(historical_prices)) :]
            if window_prices:
                avg_price = sum(window_prices) / len(window_prices)
                if avg_price:
                    delta = (current_price - avg_price) / avg_price
        # Store details keyed by asset code
        self.last_details[asset.code] = {
            "window": getattr(strategy, "window", None),
            "average_price": avg_price,
            "current_price": current_price,
            "delta": delta,
            "threshold": getattr(strategy, "threshold", None),
            "recommendation": recommendation.side,
            "timestamp": recommendation.date.isoformat(),
        }

        LOGGER.info("Advisor recommendation for %s: %s", asset.code, recommendation.side)
        return recommendation
