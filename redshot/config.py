"""
Configuration utilities.

This module centralises the loading of configuration values such as API keys
for exchanges.  Credentials are read from environment variables to avoid
hardcoding sensitive data in source code.  You can optionally create a
`.env` file in the project root with lines like `BINANCE_API_KEY=...` and
`BINANCE_API_SECRET=...` which will be picked up automatically if
`python-dotenv` is installed.  Otherwise, set the variables in your shell.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

try:
    from dotenv import load_dotenv  # type: ignore

    load_dotenv()
except Exception:
    # dotenv is optional
    pass


@dataclass
class ExchangeCredentials:
    api_key: str
    api_secret: str


def get_exchange_credentials(exchange_prefix: str) -> ExchangeCredentials:
    """
    Retrieve API key and secret for a given exchange.

    :param exchange_prefix: prefix used in environment variables, e.g. 'BINANCE'
    :returns: `ExchangeCredentials` object
    :raises: `KeyError` if variables are missing
    """
    key = os.environ[f"{exchange_prefix}_API_KEY"]
    secret = os.environ[f"{exchange_prefix}_API_SECRET"]
    return ExchangeCredentials(api_key=key, api_secret=secret)
