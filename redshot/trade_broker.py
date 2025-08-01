"""
Trade execution layer.

The **Trade Broker** encapsulates interactions with cryptocurrency exchanges.
It leverages the open‑source [`ccxt`](https://github.com/ccxt/ccxt) library,
which provides a unified API for more than 100 exchanges【326200776287954†L150-L152】.
Through this class you can place market and limit orders in a consistent way
across different exchanges.

To use this broker, you must install the `ccxt` package and provide your
exchange credentials.  For safety, API keys should be stored outside of
source code (e.g. in environment variables or a separate configuration file).

This module will not execute real orders unless valid credentials are
provided.  The default behaviour is to log the order details and return a
mock response.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

try:
    import ccxt  # type: ignore
except ImportError:
    ccxt = None  # the library may not be installed in some environments

from .entities import Asset, Exchange, Order, Trade


LOGGER = logging.getLogger(__name__)


@dataclass
class TradeBroker:
    """
    A wrapper around the ccxt library to place trades on supported exchanges.
    """

    exchange_id: str
    api_key: str
    api_secret: str
    test_mode: bool = True  # when True, orders are logged but not sent

    def __post_init__(self) -> None:
        if ccxt is None:
            LOGGER.warning(
                "ccxt is not installed; TradeBroker will operate in mock mode only"
            )
            self.exchange = None
            return
        # Create an instance of the exchange from ccxt
        exchange_class = getattr(ccxt, self.exchange_id)
        self.exchange = exchange_class({
            "apiKey": self.api_key,
            "secret": self.api_secret,
            "enableRateLimit": True,
        })
        LOGGER.info("Initialised exchange %s via ccxt", self.exchange_id)

    def place_order(
        self,
        asset: Asset,
        side: str,
        quantity: float,
        price: Optional[float] = None,
        order_type: str = "market",
    ) -> Optional[Trade]:
        """
        Place an order to buy or sell an asset.

        :param asset: asset to trade
        :param side: 'buy' or 'sell'
        :param quantity: amount to buy or sell
        :param price: limit price for limit orders; ignored for market orders
        :param order_type: 'market' or 'limit'
        :returns: Trade object if the order is executed, or None in test mode
        """
        LOGGER.info(
            "Placing %s order for %s %s at price %s (type=%s)",
            side,
            quantity,
            asset.code,
            price,
            order_type,
        )
        if self.test_mode or self.exchange is None:
            # In test mode we simply log the order and return a mock trade
            LOGGER.debug("Test mode enabled; not sending order to exchange")
            trade = Trade(
                exchange=Exchange(name=self.exchange_id),
                asset=asset,
                price=price or 0.0,
                quantity=quantity,
                date=datetime.utcnow(),
                side=side,
            )
            try:
                # record trade in local database for accounting/reporting
                from .database import add_trade  # imported here to avoid circular import at module level

                add_trade(trade)
            except Exception as exc:
                LOGGER.error("Failed to record trade: %s", exc)
            return trade
        try:
            symbol = asset.code  # ccxt uses symbols like 'BTC/USDT'
            if order_type == "market":
                result = self.exchange.create_market_order(symbol, side, quantity)
            else:
                result = self.exchange.create_limit_order(symbol, side, quantity, price)
            LOGGER.info("Order executed: %s", result)
            trade = Trade(
                exchange=Exchange(name=self.exchange_id),
                asset=asset,
                price=result.get("price", price or 0.0),
                quantity=result.get("amount", quantity),
                date=datetime.utcnow(),
                side=side,
            )
            # record executed trade
            try:
                from .database import add_trade

                add_trade(trade)
            except Exception as exc:
                LOGGER.error("Failed to record trade: %s", exc)
            return trade
        except Exception as exc:
            LOGGER.error("Failed to execute order: %s", exc)
            return None
