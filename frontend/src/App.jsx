import React, { useEffect, useState } from 'react';
// Chart.js components for plotting strategy metrics
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
);

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

  // Strategy parameter state and series data for charting
  const [strategyParams, setStrategyParams] = useState({});
  const [selectedAsset, setSelectedAsset] = useState('BTC/USDT');
  const [seriesData, setSeriesData] = useState({ x: [], prices: [], short_sma: [], long_sma: [] });
  // Simulation interval in minutes and input value for updates
  const [simulationInterval, setSimulationInterval] = useState(null);
  const [intervalInput, setIntervalInput] = useState('');

  // Authentication token and login state.  The token is persisted in
  // localStorage so that the session survives page reloads.  Login form
  // values are stored in dedicated states.
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(localStorage.getItem('token')));
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Track which section of the dashboard is currently active.  This controls
  // which panel is displayed in the main content area.  Initial section
  // defaults to 'status' to show the system status overview.
  const [activeSection, setActiveSection] = useState('status');

  async function fetchPortfolio() {
    const res = await fetch('/api/portfolio', { headers: { Authorization: token } });
    const data = await res.json();
    setPortfolio(data);
  }

  async function fetchStrategyParams() {
    try {
      const res = await fetch('/api/strategy_params', { headers: { Authorization: token } });
      const data = await res.json();
      setStrategyParams(data);
    } catch (error) {
      console.error('Failed to fetch strategy params', error);
    }
  }

  async function fetchSeries(assetCode = selectedAsset) {
    try {
      const encoded = encodeURIComponent(assetCode);
      const res = await fetch(`/api/strategy_series/${encoded}?days=60`, { headers: { Authorization: token } });
      const data = await res.json();
      setSeriesData(data);
    } catch (error) {
      console.error('Failed to fetch series data', error);
    }
  }

  // Fetch the current simulation interval from the server
  async function fetchSimulationInterval() {
    try {
      const res = await fetch('/api/simulation_interval', { headers: { Authorization: token } });
      const data = await res.json();
      setSimulationInterval(data.minutes);
    } catch (error) {
      console.error('Failed to fetch simulation interval', error);
    }
  }

  // Update the simulation interval on the server
  async function updateSimulationInterval() {
    if (!intervalInput) return;
    const value = parseFloat(intervalInput);
    if (isNaN(value) || value <= 0) {
      alert('Please enter a valid positive number of minutes');
      return;
    }
    try {
      await fetch('/api/simulation_interval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ minutes: value }),
      });
      await fetchSimulationInterval();
      setIntervalInput('');
    } catch (error) {
      console.error('Failed to update simulation interval', error);
    }
  }

  // Apply updated strategy parameters
  async function applyStrategyParams() {
    try {
      await fetch('/api/strategy_params', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify(strategyParams),
      });
      // Refresh strategies and details
      await fetchStrategies();
      await fetchStrategyDetails();
    } catch (error) {
      console.error('Failed to update strategy parameters', error);
    }
  }

  // Handle changes in parameter input
  function handleParamChange(e, key) {
    const value = e.target.value;
    setStrategyParams((prev) => ({ ...prev, [key]: value }));
  }

  // Determine list of assets for selection (unique asset codes from recommendations or default)
  const assetsList = Array.from(new Set(recommendations.map((r) => r.asset))).filter(Boolean);
  // If no recommendations yet, fallback to known assets
  const defaultAssets = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'ADA/USDT', 'XRP/USDT', 'SOL/USDT'];
  const selectableAssets = assetsList.length > 0 ? assetsList : defaultAssets;

  async function fetchTrades() {
    const res = await fetch('/api/trades', { headers: { Authorization: token } });
    const data = await res.json();
    setTrades(data);
  }

  async function fetchRecommendations() {
    const res = await fetch('/api/recommendations', { headers: { Authorization: token } });
    const data = await res.json();
    setRecommendations(data);
  }

  async function fetchStatus() {
    const res = await fetch('/api/status', { headers: { Authorization: token } });
    const data = await res.json();
    setStatus(data);
  }

  async function fetchResearchActivity() {
    const res = await fetch('/api/research_activity', { headers: { Authorization: token } });
    const data = await res.json();
    setResearchActivity(data);
  }

  async function fetchStrategies() {
    const res = await fetch('/api/strategies', { headers: { Authorization: token } });
    const data = await res.json();
    setStrategies(data);
  }

  async function fetchTradePerformance() {
    const res = await fetch('/api/trade_performance', { headers: { Authorization: token } });
    const data = await res.json();
    setTradePerformance(data);
  }

  async function fetchStrategyDetails() {
    const res = await fetch('/api/strategy_details', { headers: { Authorization: token } });
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
        headers: { 'Content-Type': 'application/json', Authorization: token },
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

  // Fetch data after the user has authenticated.  This effect depends on
  // ``isAuthenticated`` so that it only fires once a token is available.  It
  // reloads data whenever the selected asset changes to update the chart.
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchPortfolio();
    fetchTrades();
    fetchRecommendations();
    fetchStatus();
    fetchResearchActivity();
    fetchStrategies();
    fetchTradePerformance();
    fetchStrategyDetails();
    fetchStrategyParams();
    fetchSeries(selectedAsset);
    fetchSimulationInterval();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, selectedAsset]);

  async function simulate() {
    setLoading(true);
    try {
      await fetch('/api/simulate', { method: 'POST', headers: { Authorization: token } });
      await fetchPortfolio();
      await fetchTrades();
      await fetchRecommendations();
      await fetchStatus();
      await fetchResearchActivity();
      await fetchStrategies();
      await fetchTradePerformance();
      await fetchStrategyDetails();
      await fetchStrategyParams();
      await fetchSeries(selectedAsset);
    } catch (error) {
      console.error('Simulation failed', error);
    } finally {
      setLoading(false);
    }
  }

  // Handle user login.  Submits credentials to the API and stores the returned
  // token on success.  After authentication, initial data is loaded.
  async function handleLogin(e) {
    e.preventDefault();
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      if (!res.ok) {
        alert('Invalid credentials');
        return;
      }
      const data = await res.json();
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setIsAuthenticated(true);
      // Clear login form
      setLoginUsername('');
      setLoginPassword('');
      // Load data after login
      fetchPortfolio();
      fetchTrades();
      fetchRecommendations();
      fetchStatus();
      fetchResearchActivity();
      fetchStrategies();
      fetchTradePerformance();
      fetchStrategyDetails();
      fetchStrategyParams();
      fetchSeries();
      fetchSimulationInterval();
    } catch (error) {
      console.error('Login failed', error);
    }
  }

  // Handle user logout.  Clears the stored token, resets auth state and
  // clears loaded data.  This simply sets isAuthenticated to false so that
  // the login form is shown again.
  function handleLogout() {
    localStorage.removeItem('token');
    setToken('');
    setIsAuthenticated(false);
    // Clear cached data on logout
    setPortfolio({ total_value: 0, cash: 0, positions: [] });
    setTrades([]);
    setRecommendations([]);
    setStatus({ last_cycle: null, portfolio_value: null, variation: null, pnl: null, initial_capital: null });
    setResearchActivity([]);
    setStrategies([]);
    setTradePerformance([]);
    setStrategyDetails([]);
    setStrategyParams({});
    setSeriesData({ x: [], prices: [], short_sma: [], long_sma: [] });
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

  // If the user is not authenticated, display a login form instead of the dashboard.
  if (!isAuthenticated) {
    return (
      <div className="container d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <form onSubmit={handleLogin} className="bg-dark p-4 rounded" style={{ minWidth: '320px' }}>
          <h2 className="mb-3 text-light">Login</h2>
          <div className="mb-3">
            <label className="form-label text-light" htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              className="form-control"
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value)}
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label text-light" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-control"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary w-100">
            Login
          </button>
        </form>
      </div>
    );
  }

  // Render navigation bar on the left and the main content on the right.
  // Each navigation item corresponds to a section of the dashboard.
  return (
    <div className="container-fluid">
      <div className="row">
        {/* Sidebar navigation */}
        <nav className="col-md-2 d-none d-md-block bg-dark sidebar py-4">
          <div className="position-sticky">
            <h4 className="text-light px-3 mb-4">Redshot</h4>
            <ul className="nav nav-pills flex-column mb-auto">
              <li className="nav-item">
                <button className={`nav-link text-start ${activeSection === 'status' ? 'active' : ''}`} onClick={() => setActiveSection('status')}>
                  System Status
                </button>
              </li>
              <li className="nav-item">
                <button className={`nav-link text-start ${activeSection === 'portfolio' ? 'active' : ''}`} onClick={() => setActiveSection('portfolio')}>
                  Portfolio
                </button>
              </li>
              <li className="nav-item">
                <button className={`nav-link text-start ${activeSection === 'recommendations' ? 'active' : ''}`} onClick={() => setActiveSection('recommendations')}>
                  Recommendations
                </button>
              </li>
              <li className="nav-item">
                <button className={`nav-link text-start ${activeSection === 'trades' ? 'active' : ''}`} onClick={() => setActiveSection('trades')}>
                  Trades
                </button>
              </li>
              <li className="nav-item">
                <button className={`nav-link text-start ${activeSection === 'research' ? 'active' : ''}`} onClick={() => setActiveSection('research')}>
                  Research & Strategy
                </button>
              </li>
              <li className="nav-item">
                <button className={`nav-link text-start ${activeSection === 'strategies' ? 'active' : ''}`} onClick={() => setActiveSection('strategies')}>
                  Strategies
                </button>
              </li>
              <li className="nav-item">
                <button className={`nav-link text-start ${activeSection === 'strategy_details' ? 'active' : ''}`} onClick={() => setActiveSection('strategy_details')}>
                  Strategy Details
                </button>
              </li>
              <li className="nav-item">
                <button className={`nav-link text-start ${activeSection === 'strategy_params' ? 'active' : ''}`} onClick={() => setActiveSection('strategy_params')}>
                  Strategy Parameters
                </button>
              </li>
              <li className="nav-item">
                <button className={`nav-link text-start ${activeSection === 'strategy_chart' ? 'active' : ''}`} onClick={() => setActiveSection('strategy_chart')}>
                  Strategy Chart
                </button>
              </li>
              <li className="nav-item">
                <button className={`nav-link text-start ${activeSection === 'simulation' ? 'active' : ''}`} onClick={() => setActiveSection('simulation')}>
                  Simulation Settings
                </button>
              </li>
              <li className="nav-item mt-3">
                <button className="nav-link text-start text-danger" onClick={handleLogout}>
                  Logout
                </button>
              </li>
            </ul>
          </div>
        </nav>
        {/* Main content area */}
        <main className="col-md-10 ms-sm-auto px-md-4">
          <div className="pt-4">
            <h1 className="mb-4">Redshot Dashboard</h1>
            {/* Controls: run simulation and set capital */}
            <div className="d-flex flex-wrap align-items-end mb-4 gap-3">
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
            {/* Conditional sections */}
            {activeSection === 'status' && (
              <div>
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
              </div>
            )}
            {activeSection === 'portfolio' && (
              <div>
                <h2>Portfolio</h2>
                <p>
                  Cash: <strong>${formatNumber(portfolio.cash)}</strong> | Positions Value:{' '}
                  <strong>${formatNumber(portfolio.total_value - portfolio.cash)}</strong>
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
            )}
            {activeSection === 'recommendations' && (
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
              </div>
            )}
            {activeSection === 'trades' && (
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
              </div>
            )}
            {activeSection === 'research' && (
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
              </div>
            )}
            {activeSection === 'strategies' && (
              <div>
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
              </div>
            )}
            {activeSection === 'strategy_details' && (
              <div>
                <h2>Strategy Calculation Details</h2>
                <div className="table-responsive">
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
                          const thresholdFmt = typeof thresholdVal === 'number' && Number.isFinite(thresholdVal)
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
                              <td>{detail.timestamp ? new Date(detail.timestamp).toLocaleString() : '—'}</td>
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
              </div>
            )}
            {activeSection === 'strategy_params' && (
              <div>
                <h2>Strategy Parameters</h2>
                <div className="row mb-3">
                  {Object.keys(strategyParams).map((key) => (
                    <div className="col-6 col-md-3 mb-2" key={key}>
                      <label className="form-label text-capitalize" htmlFor={key}>{key.replace('_', ' ')}</label>
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
                    <button className="btn btn-secondary" onClick={applyStrategyParams}>Apply Strategy Parameters</button>
                  </div>
                </div>
              </div>
            )}
            {activeSection === 'strategy_chart' && (
              <div>
                <h2>Strategy Series Chart</h2>
                <div className="mb-3">
                  <label htmlFor="assetSelect" className="form-label">Select Asset:</label>
                  <select
                    id="assetSelect"
                    className="form-select"
                    value={selectedAsset}
                    onChange={(e) => {
                      const asset = e.target.value;
                      setSelectedAsset(asset);
                      fetchSeries(asset);
                    }}
                  >
                    {selectableAssets.map((asset) => (
                      <option key={asset} value={asset}>{asset}</option>
                    ))}
                  </select>
                </div>
                <div className="chart-container" style={{ position: 'relative', height: '400px' }}>
                  <Line
                    data={{
                      labels: seriesData.x,
                      datasets: [
                        {
                          label: 'Price',
                          data: seriesData.prices,
                          borderColor: 'rgba(75, 192, 192, 1)',
                          backgroundColor: 'rgba(75, 192, 192, 0.2)',
                          tension: 0.1,
                        },
                        {
                          label: 'Short SMA',
                          data: seriesData.short_sma,
                          borderColor: 'rgba(255, 99, 132, 1)',
                          backgroundColor: 'rgba(255, 99, 132, 0.2)',
                          tension: 0.1,
                        },
                        {
                          label: 'Long SMA',
                          data: seriesData.long_sma,
                          borderColor: 'rgba(54, 162, 235, 1)',
                          backgroundColor: 'rgba(54, 162, 235, 0.2)',
                          tension: 0.1,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'top',
                          labels: { color: 'rgba(255,255,255,0.9)' },
                        },
                        title: {
                          display: false,
                        },
                        tooltip: {
                          mode: 'index',
                          intersect: false,
                        },
                      },
                      scales: {
                        x: {
                          ticks: { color: 'rgba(255,255,255,0.9)' },
                          title: {
                            display: true,
                            text: 'Days (oldest to newest)',
                            color: 'rgba(255,255,255,0.9)',
                          },
                        },
                        y: {
                          ticks: { color: 'rgba(255,255,255,0.9)' },
                          title: {
                            display: true,
                            text: 'Price',
                            color: 'rgba(255,255,255,0.9)',
                          },
                        },
                      },
                    }}
                  />
                </div>
              </div>
            )}

            {activeSection === 'simulation' && (
              <div>
                <h2>Simulation Settings</h2>
                <p>
                  Current interval: {' '}
                  <strong>{
                    simulationInterval !== null && simulationInterval !== undefined
                      ? simulationInterval.toFixed(2) + ' minutes'
                      : '—'
                  }</strong>
                </p>
                <div className="input-group" style={{ maxWidth: '300px' }}>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="Set interval (minutes)"
                    value={intervalInput}
                    onChange={(e) => setIntervalInput(e.target.value)}
                    min="0.1"
                    step="0.1"
                  />
                  <button className="btn btn-secondary" onClick={updateSimulationInterval}>
                    Update Interval
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}