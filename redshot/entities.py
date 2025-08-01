"""
Definition of core entities used throughout the Redshot system.

This module declares simple data structures for representing assets,
positions, accounts, portfolios and other objects that appear in the
specification of the autonomous crypto currency asset management system.  The
classes are deliberately lightweight (they mainly store data) so that other
components can build on them without dragging in heavy dependencies.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional


@dataclass
class Asset:
    """Represents a tradeable asset (e.g. a cryptocurrency token)."""

    code: str
    name: str
    type: str  # e.g. 'spot', 'token', 'stablecoin'
    market: str  # the identifier used by external APIs (e.g. 'bitcoin')


@dataclass
class Position:
    """Represents the amount of a given asset held by the portfolio."""

    asset: Asset
    amount: float

    def market_value(self, price: float) -> float:
        """Return the market value of this position given a current price."""
        return self.amount * price


@dataclass
class Exchange:
    """Represents an exchange where assets can be traded."""

    name: str
    ccxt_id: Optional[str] = None  # optional ID used by ccxt to reference this exchange


@dataclass
class Account:
    """Represents a user account on a specific exchange."""

    exchange: Exchange
    api_key: str
    api_secret: str
    positions: List[Position] = field(default_factory=list)

    def get_position(self, asset_code: str) -> Optional[Position]:
        """Return the position for a particular asset code, if present."""
        for pos in self.positions:
            if pos.asset.code == asset_code:
                return pos
        return None


@dataclass
class Order:
    """Represents an order to buy or sell an asset."""

    exchange: Exchange
    asset: Asset
    price: float
    quantity: float
    side: str  # 'buy' or 'sell'
    date: datetime
    stop_range: Optional[float] = None


@dataclass
class Trade:
    """Represents a completed trade on an exchange."""

    exchange: Exchange
    asset: Asset
    price: float
    quantity: float
    date: datetime
    side: str  # 'buy' or 'sell'


@dataclass
class Recommendation:
    """Represents a recommendation to buy or sell an asset."""

    asset: Asset
    exchange: Exchange
    side: str  # 'buy' or 'sell'
    price: Optional[float]
    date: datetime
    expire_datetime: Optional[datetime] = None
    confidence: float = 0.0  # confidence score between 0 and 1


@dataclass
class Performance:
    """Represents a snapshot of portfolio performance at a point in time."""

    portfolio_value: float
    variation: float  # variation relative to a baseline (e.g. previous day)
    datetime: datetime


@dataclass
class Goal:
    """Represents a high level investment goal (e.g. maximise returns, minimise risk)."""

    name: str
    description: str


@dataclass
class Strategy:
    """Base class for investment strategies."""

    name: str
    description: str

    def generate_recommendations(
        self,
        asset: Asset,
        historical_prices: List[float],
    ) -> Recommendation:
        """
        Produce a buy or sell recommendation based on historical price data.

        Concrete strategies should override this method and return a
        Recommendation object reflecting the recommended action.  The default
        implementation makes no recommendation.
        """
        return Recommendation(
            asset=asset,
            exchange=Exchange(name="unknown"),
            side="hold",
            price=None,
            date=datetime.utcnow(),
            confidence=0.0,
        )
