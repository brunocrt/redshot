import React, { useEffect, useState } from 'react';

export default function App() {
  // Initialise portfolio with total_value, cash and positions.  Cash is set to 0
  // initially and will be updated via the API.
  const [portfolio, setPortfolio] = useState({ total_value: 0, cash: 0, positions: [] });
  const [trades, setTrades] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  // Status includes fields from the /api/status endpoint, including last_cycle,
  // portfolio_value, variation, pnl and initial_capital.  Initialise them to
  // sensible defaults.
  const [status, setStatus] = useState({
    last_cycle: null,
    portfolio_value: null,
    variation: null,
    pnl: null,
    initial_capital: null,
  });
  const [researchActivity, setResearchActivity] = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [tradePerformance, setTradePerformance] = useState([]);
  const [strategyDetails, setStrategyDetails] = useState([]);
  const [capitalInput, setCapitalInput] = useState('');
  const [loading, setLoading] = useState(false);

  async function fetchPortfolio() {
    const res = await fetch('/api/portfolio');
    const data = await res.json();
    setPortfolio(data);
  }

  async function fetchTrades() {
    const res = await fetch('/api/trades');
    const data = await res.json();
    setTrades(data);
  }

  async function fetchRecommendations() {
    const res = await fetch('/api/recommendations');
    const data = await res.json();
    setRecommendations(data);
  }

  async function fetchStatus() {
    const res = await fetch('/api/status');
    const data = await res.json();
    setStatus(data);
  }

  async function fetchResearchActivity() {
    const res = await fetch('/api/research_activity');
    const data = await res.json();
    setResearchActivity(data);
  }

  async function fetchStrategies() {
    const res = await fetch('/api/strategies');
    const data = await res.json();
    setStrategies(data);
  }

  async function fetchTradePerformance() {
    const res = await fetch('/api/trade_performance');
    const data = await res.json();
    setTradePerformance(data);
  }

  async function fetchStrategyDetails() {
    const res = await fetch('/api/strategy_details');
    const data = await res.json();
    setStrategyDetails(data);
  }

  async function setInitialCapital() {
    if (!capitalInput) return;
    const value = parseFloat(capitalInput);
    if (isNaN(value) || value < 0) {
      alert('Please enter a valid non-negative number');
      return;
    }
    try {
      await fetch('/api/initial_capital', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capital: value }),
      });
      // Reload relevant data after setting capital
      await fetchStatus();
      await fetchPortfolio();
      setCapitalInput('');
    } catch (error) {
      console.error('Failed to set initial capital', error);
    }
  }

  useEffect(() => {
    fetchPortfolio();
    fetchTrades();
    fetchRecommendations();
    fetchStatus();
    fetchResearchActivity();
    fetchStrategies();
    fetchTradePerformance();
    fetchStrategyDetails();
  }, []);

  async function simulate() {
    setLoading(true);
    try {
      await fetch('/api/simulate', { method: 'POST' });
      await fetchPortfolio();
      await fetchTrades();
      await fetchRecommendations();
      await fetchStatus();
      await fetchResearchActivity();
      await fetchStrategies();
      await fetchTradePerformance();
      await fetchStrategyDetails();
    } catch (error) {
      console.error('Simulation failed', error);
    } finally {
      setLoading(false);
    }
  }

  // Helper for formatting numeric values.  If the value is not a finite
  // number, an em dash is returned instead.  The default precision is two
  // decimals but can be overridden.  This helper is used throughout the
  // component to consistently format portfolio values, prices and quantities.
  function formatNumber(value, decimals = 2) {
    return typeof value === 'number' && Number.isFinite(value)
      ? value.toFixed(decimals)
      : '—';
  }

  return (
    <div className="container py-4">
      <h1 className="mb-4">Redshot Dashboard</h1>
      {/* Controls section: run simulation and set initial capital */}
      <div className="d-flex flex-wrap align-items-end mb-3 gap-3">
        <button
          className="btn btn-primary"
          onClick={simulate}
          disabled={loading}
        >
          {loading ? 'Running...' : 'Run Simulation Cycle'}
        </button>
        <div className="input-group" style={{ maxWidth: '300px' }}>
          <input
            type="number"
            className="form-control"
            placeholder="Set initial capital"
            value={capitalInput}
            onChange={(e) => setCapitalInput(e.target.value)}
            min="0"
            step="0.01"
          />
          <button className="btn btn-secondary" onClick={setInitialCapital}>
            Update Capital
          </button>
        </div>
      </div>
      <h2>System Status</h2>
      <p>
        Last Cycle:{' '}
        <strong>{status.last_cycle ? new Date(status.last_cycle).toLocaleString() : '—'}</strong>
      </p>
      <p>
        Initial Capital:{' '}
        <strong>${formatNumber(status.initial_capital)}</strong>
      </p>
      <p>
        Cash Balance:{' '}
        <strong>${formatNumber(portfolio.cash)}</strong>
      </p>
      <p>
        Positions Value:{' '}
        <strong>${formatNumber(portfolio.total_value - portfolio.cash)}</strong>
      </p>
      <p>
        Total Portfolio Value:{' '}
        <strong>${formatNumber(portfolio.total_value)}</strong>
      </p>
      <p>
        Variation (since last cycle):{' '}
        <strong>{
          typeof status.variation === 'number' && Number.isFinite(status.variation)
            ? (status.variation * 100).toFixed(2) + '%'
            : '—'
        }</strong>
      </p>
      <p>
        P&amp;L (overall):{' '}
        <strong>{
          typeof status.pnl === 'number' && Number.isFinite(status.pnl)
            ? (status.pnl * 100).toFixed(2) + '%'
            : '—'
        }</strong>
      </p>
      <h2>Portfolio</h2>
      <p>
        Cash: <strong>${formatNumber(portfolio.cash)}</strong> | Positions Value:{' '}
        <strong>${formatNumber(portfolio.total_value - portfolio.cash)}</strong>
      </p>
      <div className="table-responsive">
        <table className="table table-dark table-striped table-bordered">
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
      <h2>Recommendations</h2>
      <div className="table-responsive">
        <table className="table table-dark table-striped table-bordered">
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
                  <td>{
                    typeof rec.confidence === 'number' && Number.isFinite(rec.confidence)
                      ? (rec.confidence * 100).toFixed(1) + '%'
                      : '—'
                  }</td>
                  <td>{rec.timestamp ? new Date(rec.timestamp).toLocaleString() : '—'}</td>
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
      <h2>Trades</h2>
      <div className="table-responsive">
        <table className="table table-dark table-striped table-bordered">
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
                const pnlFormatted = typeof pnl === 'number' && Number.isFinite(pnl)
                  ? pnl.toFixed(2) + '%'
                  : '—';
                return (
                  <tr key={trade.id}>
                    <td>{new Date(trade.timestamp).toLocaleString()}</td>
                    <td>{trade.exchange}</td>
                    <td>{trade.asset_code}</td>
                    <td>{formatNumber(trade.quantity, 4)}</td>
                    <td>{formatNumber(trade.price, 4)}</td>
                    <td
                      className={
                        trade.side && trade.side.toLowerCase() === 'buy'
                          ? 'text-success'
                          : 'text-danger'
                      }
                    >
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
                  No trades recorded
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2>Market Research & Strategy Activity</h2>
      <div className="table-responsive">
        <table className="table table-dark table-striped table-bordered">
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
                    <td>{
                      typeof priceInfo.price === 'number' && Number.isFinite(priceInfo.price)
                        ? priceInfo.price.toFixed(4)
                        : '—'
                    }</td>
                    <td>{priceInfo.timestamp ? new Date(priceInfo.timestamp).toLocaleString() : '—'}</td>
                    <td>{histInfo.provider || '—'}</td>
                    <td>{histInfo.timestamp ? new Date(histInfo.timestamp).toLocaleString() : '—'}</td>
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

      {/* List configured strategies */}
      <h2>Configured Strategies</h2>
      <ul className="list-group mb-4">
        {strategies && strategies.length > 0 ? (
          strategies.map((strat, idx) => (
            <li key={idx} className="list-group-item bg-dark text-light">
              <strong>{strat.name}</strong>: {strat.description}
              {strat.parameters && Object.keys(strat.parameters).length > 0 && (
                <span>
                  {' '}(parameters: {Object.entries(strat.parameters).map(([k, v]) => `${k}=${v}`).join(', ')})
                </span>
              )}
            </li>
          ))
        ) : (
          <li className="list-group-item bg-dark text-light">No strategies configured</li>
        )}
      </ul>

      {/* Strategy details showing raw calculation data (e.g. moving averages) */}
      <h2>Strategy Calculation Details</h2>
      <div className="table-responsive">
        <table className="table table-dark table-striped table-bordered">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Window</th>
              <th>Average Price</th>
              <th>Current Price</th>
              <th>Delta</th>
              <th>Threshold</th>
              <th>Recommendation</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {strategyDetails && strategyDetails.length > 0 ? (
              strategyDetails.map((detail, idx) => {
                const delta = detail.delta;
                // Format delta as percentage
                const deltaFmt = typeof delta === 'number' && Number.isFinite(delta)
                  ? (delta * 100).toFixed(2) + '%'
                  : '—';
                const thresholdFmt = typeof detail.threshold === 'number' && Number.isFinite(detail.threshold)
                  ? (detail.threshold * 100).toFixed(2) + '%'
                  : '—';
                return (
                  <tr key={idx}>
                    <td>{detail.asset}</td>
                    <td>{detail.window !== null && detail.window !== undefined ? detail.window : '—'}</td>
                    <td>{formatNumber(detail.average_price, 4)}</td>
                    <td>{formatNumber(detail.current_price, 4)}</td>
                    <td
                      className={
                        typeof delta === 'number' && Number.isFinite(delta)
                          ? delta >= 0
                            ? 'text-success'
                            : 'text-danger'
                          : ''
                      }
                    >
                      {deltaFmt}
                    </td>
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
                    <td>{detail.timestamp ? new Date(detail.timestamp).toLocaleString() : '—'}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="8" className="text-center">
                  No strategy details available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}