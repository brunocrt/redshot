import React from 'react';

/**
 * Recommendations section component.  Renders a table of current asset
 * recommendations including side, price, confidence and timestamp.  Uses
 * provided formatting helpers for numbers and dates.
 */
export default function RecommendationsSection({ recommendations, formatNumber, formatDateTime }) {
  return (
    <div>
      <h2>Recommendations</h2>
      <div className="table-responsive">
        <table className="table table-dark table-hover table-striped table-bordered">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Side</th>
              <th>Price</th>
              <th>Confidence</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {recommendations && recommendations.length > 0 ? (
              recommendations.map((rec, idx) => (
                <tr key={idx}>
                  <td>{rec.asset}</td>
                  <td
                    className={
                      rec.side && rec.side.toLowerCase() === 'buy'
                        ? 'text-success'
                        : rec.side && rec.side.toLowerCase() === 'sell'
                        ? 'text-danger'
                        : ''
                    }
                  >
                    {rec.side ? rec.side.toUpperCase() : '—'}
                  </td>
                  <td>{formatNumber(rec.price, 4)}</td>
                  <td>
                    {typeof rec.confidence === 'number' && Number.isFinite(rec.confidence)
                      ? (rec.confidence * 100).toFixed(1) + '%'
                      : '—'}
                  </td>
                  <td>{formatDateTime(rec.timestamp)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="text-center">
                  No recommendations available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}