import React from 'react';

/**
 * Portfolio section component.  Displays current cash and positions value
 * and renders a table of positions.  Expects a ``portfolio`` object with
 * ``cash``, ``total_value`` and ``positions``.  Formatting helpers are
 * provided by the parent component.
 */
export default function PortfolioSection({ portfolio, formatNumber }) {
  const positionsValue = typeof portfolio.total_value === 'number' && typeof portfolio.cash === 'number'
    ? portfolio.total_value - portfolio.cash
    : null;
  return (
    <div>
      <h2>Portfolio</h2>
      <p>
        Cash: <strong>${formatNumber(portfolio.cash)}</strong> | Positions Value: <strong>${formatNumber(positionsValue)}</strong>
      </p>
      <div className="table-responsive">
        <table className="table table-dark table-hover table-striped table-bordered">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Amount</th>
              <th>Price</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {portfolio.positions && portfolio.positions.length > 0 ? (
              portfolio.positions.map((pos) => (
                <tr key={pos.asset}>
                  <td>{pos.asset}</td>
                  <td>{formatNumber(pos.amount, 4)}</td>
                  <td>{formatNumber(pos.price, 4)}</td>
                  <td>{formatNumber(pos.value)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="text-center">
                  No positions yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}