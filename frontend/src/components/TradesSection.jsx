import React from 'react';

/**
 * Trades section component.  Displays a table of executed trades along with
 * the current price and profit/loss percentage.  Applies colour coding to
 * buy/sell sides and positive/negative P&L.  Formatting helpers are
 * supplied from the parent.
 */
export default function TradesSection({ tradePerformance, formatNumber, formatDateTime }) {
  return (
    <div>
      <h2>Trades</h2>
      <div className="table-responsive">
        <table className="table table-dark table-hover table-striped table-bordered">
          <thead>
            <tr>
              <th>Time</th>
              <th>Exchange</th>
              <th>Asset</th>
              <th>Quantity</th>
              <th>Price</th>
              <th>Side</th>
              <th>Current Price</th>
              <th>P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {tradePerformance && tradePerformance.length > 0 ? (
              tradePerformance.map((trade) => {
                const pnl = trade.pnl_pct;
                const pnlFormatted =
                  typeof pnl === 'number' && Number.isFinite(pnl) ? pnl.toFixed(2) + '%' : '—';
                return (
                  <tr key={trade.id}>
                    <td>{formatDateTime(trade.timestamp)}</td>
                    <td>{trade.exchange}</td>
                    <td>{trade.asset_code}</td>
                    <td>{formatNumber(trade.quantity, 4)}</td>
                    <td>{formatNumber(trade.price, 4)}</td>
                    <td className={trade.side && trade.side.toLowerCase() === 'buy' ? 'text-success' : 'text-danger'}>
                      {trade.side ? trade.side.toUpperCase() : '—'}
                    </td>
                    <td>{formatNumber(trade.current_price, 4)}</td>
                    <td
                      className={
                        typeof pnl === 'number' && Number.isFinite(pnl)
                          ? pnl >= 0
                            ? 'text-success'
                            : 'text-danger'
                          : ''
                      }
                    >
                      {pnlFormatted}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="8" className="text-center">
                  No trades executed yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}