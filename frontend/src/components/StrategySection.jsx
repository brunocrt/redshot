import React from 'react';

/**
 * Strategy overview section.  Displays a list of configured strategies,
 * detailed calculation metrics for the last run of each strategy and a
 * parameter adjustment form.  Colour coding is applied to recommendations
 * and thresholds.
 */
export default function StrategySection({
  strategies,
  strategyDetails,
  strategyParams,
  handleParamChange,
  applyStrategyParams,
  formatNumber,
  formatDateTime,
}) {
  return (
    <div>
      <h2>Strategy</h2>
      {/* Configured strategies list */}
      <h3>Configured Strategies</h3>
      <ul className="list-group mb-4">
        {strategies && strategies.length > 0 ? (
          strategies.map((strat, idx) => (
            <li key={idx} className="list-group-item bg-dark text-light">
              <strong>{strat.name}</strong>: {strat.description}
              {strat.parameters && Object.keys(strat.parameters).length > 0 && (
                <span>
                  {' '}(parameters: {Object.entries(strat.parameters)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(', ')})
                </span>
              )}
            </li>
          ))
        ) : (
          <li className="list-group-item bg-dark text-light">No strategies configured</li>
        )}
      </ul>
      {/* Strategy calculation details */}
      <h3>Strategy Calculation Details</h3>
      <div className="table-responsive mb-4">
        <table className="table table-dark table-hover table-striped table-bordered">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Short Window</th>
              <th>Long Window</th>
              <th>Short SMA</th>
              <th>Long SMA</th>
              <th>Avg Volume</th>
              <th>Current Volume</th>
              <th>RSI</th>
              <th>Threshold</th>
              <th>Recommendation</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {strategyDetails && strategyDetails.length > 0 ? (
              strategyDetails.map((detail, idx) => {
                const isEnhanced = detail.hasOwnProperty('short_window');
                const thresholdVal = detail.threshold;
                const thresholdFmt =
                  typeof thresholdVal === 'number' && Number.isFinite(thresholdVal)
                    ? (thresholdVal * 100).toFixed(2) + '%'
                    : '—';
                return (
                  <tr key={idx}>
                    <td>{detail.asset}</td>
                    {isEnhanced ? (
                      <>
                        <td>{detail.short_window ?? '—'}</td>
                        <td>{detail.long_window ?? '—'}</td>
                        <td>{formatNumber(detail.short_sma, 4)}</td>
                        <td>{formatNumber(detail.long_sma, 4)}</td>
                        <td>{formatNumber(detail.average_volume)}</td>
                        <td>{formatNumber(detail.current_volume)}</td>
                        <td>{detail.rsi !== null && detail.rsi !== undefined ? detail.rsi.toFixed(2) : '—'}</td>
                      </>
                    ) : (
                      <>
                        <td>{detail.window ?? '—'}</td>
                        <td>—</td>
                        <td>{formatNumber(detail.average_price, 4)}</td>
                        <td>—</td>
                        <td>—</td>
                        <td>—</td>
                        <td>{detail.delta !== null && detail.delta !== undefined ? (detail.delta * 100).toFixed(2) + '%' : '—'}</td>
                      </>
                    )}
                    <td>{thresholdFmt}</td>
                    <td
                      className={
                        detail.recommendation && detail.recommendation.toLowerCase() === 'buy'
                          ? 'text-success'
                          : detail.recommendation && detail.recommendation.toLowerCase() === 'sell'
                          ? 'text-danger'
                          : ''
                      }
                    >
                      {detail.recommendation ? detail.recommendation.toUpperCase() : '—'}
                    </td>
                    <td>{formatDateTime(detail.timestamp)}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="11" className="text-center">
                  No strategy details available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Strategy parameter adjustment */}
      <h3>Strategy Parameters</h3>
      <div className="row mb-3">
        {Object.keys(strategyParams || {}).map((key) => (
          <div className="col-6 col-md-3 mb-2" key={key}>
            <label className="form-label text-capitalize" htmlFor={key}>
              {key.replace(/_/g, ' ')}
            </label>
            <input
              id={key}
              type="number"
              className="form-control"
              value={strategyParams[key]}
              onChange={(e) => handleParamChange(e, key)}
            />
          </div>
        ))}
        <div className="col-12 mt-2">
          <button className="btn btn-secondary" onClick={applyStrategyParams}>
            Apply Strategy Parameters
          </button>
        </div>
      </div>
    </div>
  );
}