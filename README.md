# redshot
Autonomous Crypto Currency Asset Management System

This systems is composoed of the following autonomous applications:

- [redshot-PR] - _Portfolio Manager_ - manages asset position and trade decisions
- [redshot-AD] - _Asset Advisor_ - manages the investment strategies
- [redshot-MR] - _Market Researcher_ - using market information and analysis recommends asset buy or sell
- [redshot-TB] - _Trade Broker_ - manages exchange information, order executions and trade capture
- [redshot-SS] - _System Supervisor_ - manages the system communication, security and health

These applications interact with each other in order to increase value to the portfolio based on target goals

Key entities and attributes:
  - Asset: code, name, type, market 
  - Position: asset, amount
  - Exchange: name
  - Account: exchange, access_id, access_code, position_list
  - Portfolio: position, market_value, variation
  - Order: exchange, asset, price, date, stop_range
  - Trade: exchange, asset, price, date
  - Recomendation: asset, exchange, date, expire_datetime
  - Portfolio: position_list, market_value
  - Performance: portfolio_variation, datetime
  - Goal
  - Strategy
