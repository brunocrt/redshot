import React from 'react';

/**
 * Research & Strategy activity section.  Displays the last market data
 * providers and timestamps used for price and historical data, as well as the
 * strategy currently applied for each asset.
 */
export default function ResearchSection({ researchActivity, formatNumber, formatDateTime }) {
  return (
    <div>
      <h2>Market Research &amp; Strategy Activity</h2>
      <div className="table-responsive">
        <table className="table table-dark table-hover table-striped table-bordered">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Last Price Provider</th>
              <th>Price</th>
              <th>Price Timestamp</th>
              <th>Historical Provider</th>
              <th>Historical Timestamp</th>
              <th>Strategy</th>
            </tr>
          </thead>
          <tbody>
            {researchActivity && researchActivity.length > 0 ? (
              researchActivity.map((item, idx) => {
                const priceInfo = item.price || {};
                const histInfo = item.historical || {};
                const strategy = item.strategy || {};
                return (
                  <tr key={idx}>
                    <td>{item.asset}</td>
                    <td>{priceInfo.provider || '—'}</td>
                    <td>
                      {typeof priceInfo.price === 'number' && Number.isFinite(priceInfo.price)
                        ? priceInfo.price.toFixed(4)
                        : '—'}
                    </td>
                    <td>{formatDateTime(priceInfo.timestamp)}</td>
                    <td>{histInfo.provider || '—'}</td>
                    <td>{formatDateTime(histInfo.timestamp)}</td>
                    <td>{strategy.name || '—'}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="7" className="text-center">
                  No research activity yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}