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
import math


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


class EnhancedSMAStrategy(Strategy):
    """
    An enhanced moving average strategy with multiple filters and risk controls.

    The strategy extends the simple SMA approach by adding:

    - **Volume confirmation**: only buy when the latest volume exceeds the
      average volume over a configurable window.  This helps confirm that
      a price move is supported by trading activity.
    - **Multi‑SMA filter**: ensure the market is in an uptrend by requiring
      the current price to be above a longer moving average (e.g. 50‑day).
    - **Support/resistance filter**: avoid buying near recent highs (resistance)
      and avoid selling near recent lows (support).
    - **RSI filter**: avoid buying when the market is overbought (RSI > 70)
      and avoid selling when oversold (RSI < 30).  RSI is computed over a
      configurable period (default 14 days).

    The strategy outputs a ``Recommendation`` indicating whether to buy,
    sell or hold.  The confidence measure reflects the magnitude of the
    price deviation from the short moving average.
    """

    def __init__(
        self,
        short_window: int = 7,
        long_window: int = 50,
        threshold: float = 0.02,
        volume_window: int = 7,
        rsi_period: int = 14,
        overbought: float = 70.0,
        oversold: float = 30.0,
    ):
        description = (
            f"Buy when price exceeds the {short_window}-day SMA by > {threshold*100:.1f}% and"
            f" volume is above average; sell when price falls below the SMA by > {threshold*100:.1f}%"
            ". Additional filters: price must be above the {long_window}-day SMA for buys,"
            " avoid buys near resistance, avoid sells near support, avoid buys when RSI>70 and"
            " sells when RSI<30."
        )
        super().__init__(
            name="Enhanced SMA Strategy",
            description=description,
        )
        self.short_window = short_window
        self.long_window = long_window
        self.threshold = threshold
        self.volume_window = volume_window
        self.rsi_period = rsi_period
        self.overbought = overbought
        self.oversold = oversold

    def _sma(self, values: List[float], window: int) -> Optional[float]:
        if not values or len(values) < window:
            return None
        window_values = values[-window:]
        return sum(window_values) / len(window_values)

    def _rsi(self, prices: List[float], period: int) -> Optional[float]:
        """
        Compute the Relative Strength Index (RSI) for the given price series.

        RSI is calculated by computing the average gains and losses over the
        specified period and then converting the relative strength into an
        index between 0 and 100.  Returns ``None`` if there are insufficient
        price data points.
        """
        if len(prices) < period + 1:
            return None
        gains = []
        losses = []
        # Compute price changes over the period
        for i in range(-period, 0):
            change = prices[i] - prices[i - 1]
            if change >= 0:
                gains.append(change)
            else:
                losses.append(abs(change))
        avg_gain = sum(gains) / period if gains else 0.0
        avg_loss = sum(losses) / period if losses else 0.0
        if avg_loss == 0:
            # Avoid division by zero: RSI = 100 when no losses
            return 100.0
        rs = avg_gain / avg_loss
        rsi = 100.0 - (100.0 / (1.0 + rs))
        return rsi

    def generate_recommendations(
        self,
        asset: Asset,
        historical_data: Dict[str, List[float]],
        current_price: float,
    ) -> Recommendation:
        # Validate historical data
        prices = historical_data.get("prices", []) if historical_data else []
        volumes = historical_data.get("volumes", []) if historical_data else []
        # Compute technical indicators
        short_sma = self._sma(prices, self.short_window)
        long_sma = self._sma(prices, self.long_window)
        # Average volume over the volume_window
        avg_volume = None
        volume_ok = True
        if volumes and len(volumes) >= self.volume_window:
            recent_vols = volumes[-self.volume_window:]
            avg_volume = sum(recent_vols[:-1]) / (len(recent_vols) - 1) if len(recent_vols) > 1 else recent_vols[0]
            volume_ok = recent_vols[-1] > avg_volume
        # RSI
        rsi_value = self._rsi(prices, self.rsi_period)
        rsi_ok_buy = rsi_value is None or rsi_value <= self.overbought
        rsi_ok_sell = rsi_value is None or rsi_value >= self.oversold
        # Support and resistance: use recent high/low over long_window
        support_ok = True
        resistance_ok = True
        if prices and len(prices) >= self.long_window:
            recent_prices = prices[-self.long_window:]
            recent_high = max(recent_prices)
            recent_low = min(recent_prices)
            # Avoid buying if current price within 2% of recent high
            resistance_ok = (recent_high - current_price) / recent_high > 0.02
            # Avoid selling if current price within 2% above recent low
            support_ok = (current_price - recent_low) / recent_low > 0.02
        # Determine buy/sell signals based on SMA deviations
        side = "hold"
        confidence = 0.0
        if short_sma:
            delta = (current_price - short_sma) / short_sma
            confidence = abs(delta)
            # Buy conditions
            if (
                delta > self.threshold
                and (long_sma is None or current_price > long_sma)
                and volume_ok
                and resistance_ok
                and rsi_ok_buy
            ):
                side = "buy"
            # Sell conditions
            elif (
                delta < -self.threshold
                and (long_sma is None or current_price < long_sma)
                and support_ok
                and rsi_ok_sell
            ):
                side = "sell"
        LOGGER.debug(
            "Enhanced SMA strategy for %s: current=%.4f, short_sma=%s, long_sma=%s, "
            "volume_ok=%s, rsi=%.2f, rsi_ok_buy=%s, rsi_ok_sell=%s, support_ok=%s, resistance_ok=%s, side=%s",
            asset.code,
            current_price,
            f"{short_sma:.4f}" if short_sma is not None else "None",
            f"{long_sma:.4f}" if long_sma is not None else "None",
            volume_ok,
            rsi_value if rsi_value is not None else -1,
            rsi_ok_buy,
            rsi_ok_sell,
            support_ok,
            resistance_ok,
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
    strategies: List[Strategy] = field(default_factory=lambda: [EnhancedSMAStrategy()])
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
        # Retrieve combined price/volume data for more advanced metrics
        historical_data = self.researcher.get_historical_data(asset.market, days= max([
            getattr(strategy, "long_window", 50) for strategy in self.strategies
        ]) or 30) or None
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
        strategy = self.strategies[0]
        # For the enhanced strategy we pass the full historical_data; for simple strategies
        # we extract prices only.
        if isinstance(strategy, EnhancedSMAStrategy):
            recommendation = strategy.generate_recommendations(asset, historical_data or {"prices": [], "volumes": []}, current_price)
        else:
            # Fallback to simple strategy if provided
            prices_only = historical_data.get("prices", []) if historical_data else []
            recommendation = strategy.generate_recommendations(asset, prices_only, current_price)
        # Compute details for transparency
        details: Dict[str, Optional[float]] = {}
        # For EnhancedSMAStrategy capture additional metrics
        if isinstance(strategy, EnhancedSMAStrategy):
            prices = historical_data.get("prices", []) if historical_data else []
            volumes = historical_data.get("volumes", []) if historical_data else []
            short_window = strategy.short_window
            long_window = strategy.long_window
            short_sma = None
            long_sma = None
            avg_volume = None
            rsi_value = None
            if prices:
                if len(prices) >= short_window:
                    short_sma = sum(prices[-short_window:]) / short_window
                if len(prices) >= long_window:
                    long_sma = sum(prices[-long_window:]) / long_window
            if volumes and len(volumes) >= strategy.volume_window:
                recent_vols = volumes[-strategy.volume_window:]
                if len(recent_vols) > 1:
                    avg_volume = sum(recent_vols[:-1]) / (len(recent_vols) - 1)
                else:
                    avg_volume = recent_vols[0]
            # RSI
            def compute_rsi(prices_list: List[float], period: int) -> Optional[float]:
                if len(prices_list) < period + 1:
                    return None
                gains = []
                losses = []
                for i in range(-period, 0):
                    change = prices_list[i] - prices_list[i - 1]
                    if change >= 0:
                        gains.append(change)
                    else:
                        losses.append(abs(change))
                avg_gain = sum(gains) / period if gains else 0.0
                avg_loss = sum(losses) / period if losses else 0.0
                if avg_loss == 0:
                    return 100.0
                rs = avg_gain / avg_loss
                return 100.0 - (100.0 / (1.0 + rs))
            rsi_value = compute_rsi(prices, strategy.rsi_period) if prices else None
            details = {
                "short_window": short_window,
                "long_window": long_window,
                "short_sma": short_sma,
                "long_sma": long_sma,
                "average_volume": avg_volume,
                "current_volume": volumes[-1] if volumes else None,
                "rsi": rsi_value,
                "threshold": strategy.threshold,
            }
        else:
            # Basic SMA details
            prices = historical_data.get("prices", []) if historical_data else []
            avg_price = None
            delta = None
            window = getattr(strategy, "window", len(prices))
            if prices and len(prices) >= 1:
                window_prices = prices[-window:]
                if window_prices:
                    avg_price = sum(window_prices) / len(window_prices)
                    if avg_price:
                        delta = (current_price - avg_price) / avg_price
            details = {
                "window": getattr(strategy, "window", None),
                "average_price": avg_price,
                "delta": delta,
                "threshold": getattr(strategy, "threshold", None),
            }
        # Store details keyed by asset code
        self.last_details[asset.code] = {
            **details,
            "current_price": current_price,
            "recommendation": recommendation.side,
            "timestamp": recommendation.date.isoformat(),
        }
        LOGGER.info("Advisor recommendation for %s: %s", asset.code, recommendation.side)
        return recommendation
