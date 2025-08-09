import React from 'react';

/**
 * Compact horizontal status bar.  Displays key metrics such as last cycle
 * time, initial capital, cash, positions value, total portfolio value,
 * variation and P&L.  Values are formatted via helper functions passed
 * from the parent component to ensure consistency.
 */
export default function StatusBar({ status, portfolio, formatNumber, formatDateTime }) {
  // Compute positions value as total minus cash; handle NaN gracefully
  const positionsValue = typeof portfolio.total_value === 'number' && typeof portfolio.cash === 'number'
    ? portfolio.total_value - portfolio.cash
    : null;
  return (
    <div className="table-responsive mb-4">
      <table className="table table-dark table-bordered table-sm mb-0">
        <thead>
          <tr className="small">
            <th>Last Cycle</th>
            <th>Initial Capital</th>
            <th>Cash</th>
            <th>Positions Value</th>
            <th>Total Value</th>
            <th>Variation</th>
            <th>P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          <tr className="small">
            <td>{formatDateTime(status.last_cycle)}</td>
            <td>${formatNumber(status.initial_capital)}</td>
            <td>${formatNumber(portfolio.cash)}</td>
            <td>${formatNumber(positionsValue)}</td>
            <td>${formatNumber(portfolio.total_value)}</td>
            <td
              className={
                typeof status.variation === 'number' && Number.isFinite(status.variation)
                  ? status.variation >= 0
                    ? 'text-success'
                    : 'text-danger'
                  : ''
              }
            >
              {
                typeof status.variation === 'number' && Number.isFinite(status.variation)
                  ? (status.variation * 100).toFixed(2) + '%'
                  : '—'
              }
            </td>
            <td
              className={
                typeof status.pnl === 'number' && Number.isFinite(status.pnl)
                  ? status.pnl >= 0
                    ? 'text-success'
                    : 'text-danger'
                  : ''
              }
            >
              {
                typeof status.pnl === 'number' && Number.isFinite(status.pnl)
                  ? (status.pnl * 100).toFixed(2) + '%'
                  : '—'
              }
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}