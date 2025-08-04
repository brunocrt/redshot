"""
Market data retrieval utilities.

This module implements the **Market Researcher** component responsible for
fetching real‑time and historical market data.  It currently integrates
with the [CoinGecko](https://coingecko.com) public API to retrieve pricing
information.  CoinGecko offers endpoints such as `/simple/price` for current
prices and `/coins/{id}/market_chart` for historical data【942473905016508†L142-L149】.

The API is free to use for basic endpoints, but note that rate limits apply.
Refer to CoinGecko's documentation for details on quotas and restrictions.

If you wish to use another data provider, you can extend this class or
implement a new data source class adhering to the same interface.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional

import requests


LOGGER = logging.getLogger(__name__)

# Mapping from CoinGecko coin IDs to Binance trading pairs.  The CoinGecko
# API identifies coins by human‑readable slugs such as ``bitcoin`` or
# ``ethereum``.  Binance uses ticker symbols like ``BTCUSDT`` to refer to
# trading pairs.  When falling back to Binance for market data, this
# dictionary is used to translate the CoinGecko identifier into the
# corresponding Binance symbol.  Feel free to extend this mapping as you
# introduce more assets into the system.  See Binance’s REST API
# documentation for details on the ``/api/v3/ticker/price`` and
# ``/api/v3/klines`` endpoints【147101240560605†L625-L656】【147101240560605†L189-L250】.
COINGECKO_ID_TO_BINANCE_SYMBOL: Dict[str, str] = {
    "bitcoin": "BTCUSDT",
    "ethereum": "ETHUSDT",
    # Add more mappings here if you track additional assets
    "binancecoin": "BNBUSDT",
    "cardano": "ADAUSDT",
    "ripple": "XRPUSDT",
    "solana": "SOLUSDT",
}


def _current_timestamp() -> str:
    """
    Return the current UTC time as an ISO 8601 string.  This helper is used
    throughout the MarketResearcher to timestamp activity log entries.
    """
    return datetime.utcnow().isoformat()


@dataclass
class MarketResearcher:
    """Fetches price and market data from public APIs such as CoinGecko."""

    base_url: str = "https://api.coingecko.com/api/v3"
    session: requests.Session = field(default_factory=requests.Session)
    # Activity log keyed by coin ID.  Each entry contains the latest price and
    # historical fetch details (timestamp, provider, price list etc.).  This
    # structure is updated on every call to get_price() and get_historical_prices().
    activity_log: Dict[str, Dict[str, dict]] = field(default_factory=dict)

    def get_price(self, coin_id: str, vs_currency: str = "usd") -> Optional[float]:
        """
        Fetch the current price of a single coin in a given currency.

        The primary source is CoinGecko’s `/simple/price` endpoint【942473905016508†L142-L149】.
        If the request fails (e.g. due to rate limiting) or returns no data,
        a secondary lookup is performed against Binance’s public API
        (`/api/v3/ticker/price`) using a symbol derived from the coin ID.  The
        Binance API returns prices in quote currency (USDT) which we treat as
        equivalent to USD for the purposes of this demo.  See Binance
        documentation for details【147101240560605†L625-L656】.

        :param coin_id: the CoinGecko identifier for the asset (e.g. 'bitcoin')
        :param vs_currency: fiat currency for pricing (default 'usd')
        :returns: current price or ``None`` on failure
        """
        # Record the start time for this price fetch
        timestamp = _current_timestamp()
        provider: Optional[str] = None
        price: Optional[float] = None

        # Attempt CoinGecko first
        endpoint = f"/simple/price?ids={coin_id}&vs_currencies={vs_currency}"
        url = self.base_url + endpoint
        LOGGER.debug("Requesting price for %s via CoinGecko", coin_id)
        try:
            resp = self.session.get(url, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            value = data.get(coin_id, {}).get(vs_currency)
            if value is not None:
                provider = "CoinGecko"
                price = float(value)
        except Exception as exc:
            # Log at warning level for CoinGecko errors (e.g. HTTP 429) and fall
            # through to the Binance fallback.  This prevents frequent rate limit
            # errors from cluttering the logs at the ERROR level.
            LOGGER.warning("CoinGecko price request failed for %s: %s", coin_id, exc)

        # Fallback to Binance if necessary
        if price is None:
            symbol = COINGECKO_ID_TO_BINANCE_SYMBOL.get(coin_id)
            if symbol:
                # Binance suggests using the `data-api.binance.vision` host for public
                # market data【745036274426035†L57-L59】.
                binance_url = f"https://data-api.binance.vision/api/v3/ticker/price?symbol={symbol}"
                LOGGER.debug("Requesting price for %s via Binance (%s)", coin_id, symbol)
                try:
                    resp = requests.get(binance_url, timeout=10)
                    resp.raise_for_status()
                    data = resp.json()
                    price_str = data.get("price")
                    if price_str is not None:
                        provider = "Binance"
                        price = float(price_str)
                except Exception as exc:
                    LOGGER.error("Failed to fetch price for %s from Binance: %s", coin_id, exc)
            else:
                LOGGER.warning(
                    "No Binance symbol mapping for %s; unable to fetch price via fallback", coin_id
                )
        # Update activity log
        self.activity_log.setdefault(coin_id, {})["price"] = {
            "timestamp": timestamp,
            "provider": provider,
            "price": price,
            "success": price is not None,
        }
        return price

    def get_market_data(
        self, coin_id: str, vs_currency: str = "usd"
    ) -> Optional[Dict[str, any]]:
        """
        Retrieve bulk market data for a coin.

        Uses the `/coins/markets` endpoint【942473905016508†L142-L149】, which returns
        a list of market entries.  The first entry is returned here.
        """
        endpoint = (
            f"/coins/markets?vs_currency={vs_currency}&ids={coin_id}&price_change_percentage=1h,24h,7d"
        )
        url = self.base_url + endpoint
        LOGGER.debug("Requesting market data for %s", coin_id)
        try:
            resp = self.session.get(url, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            return data[0] if data else None
        except Exception as exc:
            LOGGER.error("Failed to fetch market data for %s: %s", coin_id, exc)
            return None

    def get_historical_prices(
        self, coin_id: str, days: int = 30, vs_currency: str = "usd"
    ) -> Optional[List[float]]:
        """
        Return a list of daily closing prices for the given coin over the
        specified number of days.

        By default, this method queries CoinGecko’s
        `/coins/{id}/market_chart` endpoint【942473905016508†L142-L149】, which returns an array
        of price entries in `[timestamp_ms, price]` format.  If that fails
        (e.g. due to rate limits), the method falls back to Binance’s
        `/api/v3/klines` endpoint which returns OHLC data as described in
        Binance documentation【147101240560605†L189-L250】.  The closing price (5th element in
        each kline record) is extracted to build the historical series.

        :param coin_id: CoinGecko identifier of the asset
        :param days: number of days of data to retrieve
        :param vs_currency: fiat currency (unused for Binance fallback)
        :returns: list of closing prices or ``None`` on failure
        """
        timestamp = _current_timestamp()
        provider: Optional[str] = None
        prices: Optional[List[float]] = None

        endpoint = (
            f"/coins/{coin_id}/market_chart?vs_currency={vs_currency}&days={days}&interval=daily"
        )
        url = self.base_url + endpoint
        LOGGER.debug(
            "Requesting historical prices for %s over %d days via CoinGecko", coin_id, days
        )
        try:
            resp = self.session.get(url, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            price_entries = data.get("prices", [])
            prices = [entry[1] for entry in price_entries]
            provider = "CoinGecko"
        except Exception as exc:
            # Log at warning level for expected failures (e.g. HTTP 429 rate limits)
            LOGGER.warning(
                "CoinGecko historical data request failed for %s: %s", coin_id, exc
            )

        if prices is None:
            # Fallback to Binance
            symbol = COINGECKO_ID_TO_BINANCE_SYMBOL.get(coin_id)
            if symbol:
                binance_url = (
                    f"https://data-api.binance.vision/api/v3/klines?symbol={symbol}&interval=1d&limit={days}"
                )
                LOGGER.debug(
                    "Requesting historical prices for %s via Binance (%s)", coin_id, symbol
                )
                try:
                    resp = requests.get(binance_url, timeout=10)
                    resp.raise_for_status()
                    data = resp.json()
                    # Each kline entry is [openTime, open, high, low, close, ...]. Extract close price.
                    prices = [float(entry[4]) for entry in data]
                    provider = "Binance"
                except Exception as exc:
                    LOGGER.error(
                        "Failed to fetch historical data for %s from Binance: %s", coin_id, exc
                    )
            else:
                LOGGER.warning(
                    "No Binance symbol mapping for %s; unable to fetch historical data via fallback", coin_id
                )
        # Update activity log
        self.activity_log.setdefault(coin_id, {})["historical"] = {
            "timestamp": timestamp,
            "provider": provider,
            "prices_count": len(prices) if prices else 0,
            "success": prices is not None,
        }
        return prices

    def get_activity_log(self) -> Dict[str, Dict[str, dict]]:
        """
        Return a copy of the current activity log.  Each key in the returned
        dictionary corresponds to a CoinGecko ID and contains details of the
        most recent price and historical data fetches (timestamp, provider,
        success status, etc.).
        """
        # Return a shallow copy to prevent external mutation
        return {k: v.copy() for k, v in self.activity_log.items()}

    #
    # Volume and technical indicator helpers
    #
    def get_historical_data(
        self, coin_id: str, days: int = 30, vs_currency: str = "usd"
    ) -> Optional[Dict[str, List[float]]]:
        """
        Retrieve historical price and volume data for a coin.

        This method wraps CoinGecko's `/coins/{id}/market_chart` endpoint to
        obtain both price and volume series.  If CoinGecko returns an error
        (e.g. HTTP 429 rate limit), the method falls back to Binance's
        `/api/v3/klines` endpoint, which provides OHLC and volume data.  The
        returned dictionary has two keys: ``prices`` (a list of closing prices)
        and ``volumes`` (a list of volumes).  Both lists are ordered from
        oldest to newest.  If data retrieval fails, ``None`` is returned.

        :param coin_id: CoinGecko identifier of the asset
        :param days: number of days of data to retrieve
        :param vs_currency: fiat currency (unused for Binance fallback)
        :returns: dict with ``prices`` and ``volumes`` lists or ``None`` on failure
        """
        timestamp = _current_timestamp()
        provider: Optional[str] = None
        result: Optional[Dict[str, List[float]]] = None
        # Try CoinGecko first
        endpoint = (
            f"/coins/{coin_id}/market_chart?vs_currency={vs_currency}&days={days}&interval=daily"
        )
        url = self.base_url + endpoint
        LOGGER.debug("Requesting historical price/volume data for %s via CoinGecko", coin_id)
        try:
            resp = self.session.get(url, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            price_entries = data.get("prices", [])
            volume_entries = data.get("total_volumes", [])
            prices = [entry[1] for entry in price_entries]
            volumes = [entry[1] for entry in volume_entries]
            if prices and volumes and len(prices) == len(volumes):
                result = {"prices": prices, "volumes": volumes}
                provider = "CoinGecko"
        except Exception as exc:
            LOGGER.warning(
                "CoinGecko historical price/volume request failed for %s: %s", coin_id, exc
            )
        # Fallback to Binance if necessary
        if result is None:
            symbol = COINGECKO_ID_TO_BINANCE_SYMBOL.get(coin_id)
            if symbol:
                binance_url = (
                    f"https://data-api.binance.vision/api/v3/klines?symbol={symbol}&interval=1d&limit={days}"
                )
                LOGGER.debug(
                    "Requesting historical price/volume data for %s via Binance (%s)", coin_id, symbol
                )
                try:
                    resp = requests.get(binance_url, timeout=10)
                    resp.raise_for_status()
                    data = resp.json()
                    # Each kline entry: [openTime, open, high, low, close, volume, closeTime, ...]
                    prices = [float(entry[4]) for entry in data]
                    volumes = [float(entry[5]) for entry in data]
                    result = {"prices": prices, "volumes": volumes}
                    provider = "Binance"
                except Exception as exc:
                    LOGGER.error(
                        "Failed to fetch historical price/volume data for %s from Binance: %s", coin_id, exc
                    )
            else:
                LOGGER.warning(
                    "No Binance symbol mapping for %s; unable to fetch historical data via fallback", coin_id
                )
        # Update activity log for volumes if result obtained
        if result:
            self.activity_log.setdefault(coin_id, {})["historical_full"] = {
                "timestamp": timestamp,
                "provider": provider,
                "prices_count": len(result["prices"]),
                "success": True,
            }
        return result
