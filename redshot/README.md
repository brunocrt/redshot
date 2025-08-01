# Redshot Autonomous Crypto Asset Management System

This repository contains a **proof‑of‑concept** implementation of the high level
design described in the top–level [redshot](https://github.com/brunocrt/redshot) README.
The goal is to show how the system could be structured in code and how open
source APIs and libraries can be integrated to fetch external market data and
execute trades.  The code is organised into modular components that mirror
the autonomous applications described in the original specification:

* **Portfolio Manager (`redshot/portfolio_manager.py`)** – Maintains the current
  portfolio of crypto assets, tracks positions and computes portfolio value and
  variations.
* **Asset Advisor (`redshot/asset_advisor.py`)** – Implements investment
  strategies and produces buy/sell recommendations based on market data.
* **Market Researcher (`redshot/market_data.py`)** – Retrieves real‑time and
  historical market information from open APIs.  For example, it uses the
  CoinGecko public API to fetch current prices, market data and historical
  charts.  CoinGecko’s API provides endpoints such as `/simple/price` for
  current prices and `/coins/{id}/market_chart` for historical data【942473905016508†L142-L149】.
* **Trade Broker (`redshot/trade_broker.py`)** – Encapsulates the logic for
  interacting with cryptocurrency exchanges.  It uses the open‑source
  [`ccxt`](https://github.com/ccxt/ccxt) library which offers a unified API for
  more than 100 crypto exchanges【326200776287954†L150-L152】.  The broker class
  accepts API keys via configuration and exposes simple methods for placing
  orders.
* **System Supervisor (`redshot/system_supervisor.py`)** – Coordinates the
  interaction between components, schedules data updates, applies investment
  strategies, executes trades and records performance metrics.

## Running the example

This codebase is written for **Python 3.9+**.  To run the demonstration you will
need the following dependencies:

```sh
pip install requests ccxt
```

> **Note:** The demo code fetches public market data from CoinGecko which does
> not require an API key for basic endpoints【942473905016508†L142-L149】.  If you
> intend to place real orders through an exchange, you must supply your own
> exchange credentials in the `.env` file (see `redshot/config.py` for details).

A simple entry point is provided in `redshot/main.py`.  It constructs the
components, fetches market data for a handful of assets, runs a trivial moving
average strategy and optionally executes mock trades.  This is intended for
educational purposes only and **should not be used to manage real money**.

## Extending this project

The architecture is intentionally kept modular so that you can extend it in
different directions:

* Add additional market data sources such as [CryptoCompare](https://www.cryptocompare.com/),
  [CoinMarketCap](https://coinmarketcap.com/), or on‑chain DEX APIs.  See the
  alternatives section in the CoinGecko API guide for pros and cons of each
  provider【942473905016508†L242-L274】.
* Implement more sophisticated investment strategies in `asset_advisor.py`.
* Integrate more robust scheduling, error handling and health checks in the
  system supervisor.  Follow best practices for API integration such as
  caching and rate‑limit handling【942473905016508†L280-L293】.

Pull requests and contributions are welcome!  Feel free to open issues or
discuss improvements.