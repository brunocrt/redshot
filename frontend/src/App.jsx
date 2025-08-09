import React, { useEffect, useState, useRef } from 'react';
// Import child components for modular UI
import LoginPage from './components/LoginPage';
import Sidebar from './components/Sidebar';
import StatusBar from './components/StatusBar';
import PortfolioSection from './components/PortfolioSection';
import RecommendationsSection from './components/RecommendationsSection';
import TradesSection from './components/TradesSection';
import ResearchSection from './components/ResearchSection';
import StrategySection from './components/StrategySection';
import StrategyChartSection from './components/StrategyChartSection';
import SimulationSettingsSection from './components/SimulationSettingsSection';

// Constants
const NY_TIME_ZONE = 'America/New_York';

export default function App() {
  // State hooks for data returned from API
  const [portfolio, setPortfolio] = useState({ total_value: 0, cash: 0, positions: [] });
  const [trades, setTrades] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
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
  const [strategyParams, setStrategyParams] = useState({});
  const [seriesData, setSeriesData] = useState({ x: [], prices: [], short_sma: [], long_sma: [] });
  const [selectedAsset, setSelectedAsset] = useState('BTC/USDT');
  const [simulationInterval, setSimulationInterval] = useState(null);
  const [capitalInput, setCapitalInput] = useState('');
  const [intervalInput, setIntervalInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Toast notifications
  const [toasts, setToasts] = useState([]);
  function addToast(message) {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }

  // Refs to track previous values for change detection
  const prevStatusRef = useRef({ last_cycle: null });
  const prevTradesLenRef = useRef(0);
  const prevPortfolioValueRef = useRef(0);

  // Authentication state
  const [token, setToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Active section and sidebar collapse state
  const [activeSection, setActiveSection] = useState('portfolio');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  /** Helper: perform an authenticated fetch.  If the response status is 401,
   *  the user will be logged out and an error thrown. */
  async function authFetch(url, options = {}) {
    const opts = { ...options };
    opts.headers = { ...(options.headers || {}) };
    if (token) {
      opts.headers['Authorization'] = token;
    }
    const res = await fetch(url, opts);
    if (res.status === 401) {
      handleLogout();
      throw new Error('Unauthorized');
    }
    return res;
  }

  // Fetch individual endpoints
  async function fetchPortfolio() {
    const res = await authFetch('/api/portfolio');
    setPortfolio(await res.json());
  }
  async function fetchTrades() {
    const res = await authFetch('/api/trades');
    setTrades(await res.json());
  }
  async function fetchRecommendations() {
    const res = await authFetch('/api/recommendations');
    setRecommendations(await res.json());
  }
  async function fetchStatus() {
    const res = await authFetch('/api/status');
    setStatus(await res.json());
  }
  async function fetchResearchActivity() {
    const res = await authFetch('/api/research_activity');
    setResearchActivity(await res.json());
  }
  async function fetchStrategies() {
    const res = await authFetch('/api/strategies');
    setStrategies(await res.json());
  }
  async function fetchTradePerformance() {
    const res = await authFetch('/api/trade_performance');
    setTradePerformance(await res.json());
  }
  async function fetchStrategyDetails() {
    const res = await authFetch('/api/strategy_details');
    setStrategyDetails(await res.json());
  }
  async function fetchStrategyParams() {
    const res = await authFetch('/api/strategy_params');
    setStrategyParams(await res.json());
  }
  async function fetchSeries(asset = selectedAsset) {
    const encoded = encodeURIComponent(asset);
    const res = await authFetch(`/api/strategy_series/${encoded}?days=60`);
    setSeriesData(await res.json());
  }
  async function fetchSimulationInterval() {
    const res = await authFetch('/api/simulation_interval');
    const data = await res.json();
    setSimulationInterval(data.minutes);
  }

  async function updateSimulationInterval() {
    if (!intervalInput) return;
    const value = parseFloat(intervalInput);
    if (isNaN(value) || value <= 0) {
      alert('Please enter a valid positive number of minutes');
      return;
    }
    await authFetch('/api/simulation_interval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutes: value }),
    });
    setIntervalInput('');
    await fetchSimulationInterval();
  }

  async function applyStrategyParams() {
    await authFetch('/api/strategy_params', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(strategyParams),
    });
    await fetchStrategies();
    await fetchStrategyDetails();
  }

  function handleParamChange(e, key) {
    const value = e.target.value;
    setStrategyParams((prev) => ({ ...prev, [key]: value }));
  }

  async function setInitialCapital() {
    if (!capitalInput) return;
    const value = parseFloat(capitalInput);
    if (isNaN(value) || value < 0) {
      alert('Please enter a valid non-negative number');
      return;
    }
    await authFetch('/api/initial_capital', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capital: value }),
    });
    setCapitalInput('');
    await fetchStatus();
    await fetchPortfolio();
  }

  // Consolidated refresh function
  async function refreshAllData() {
    try {
      const encoded = encodeURIComponent(selectedAsset);
      const [portfolioRes, tradesRes, recsRes, statusRes, researchRes, strategiesRes, tradePerfRes, detailsRes, paramsRes, seriesRes, intervalRes] =
        await Promise.all([
          authFetch('/api/portfolio'),
          authFetch('/api/trades'),
          authFetch('/api/recommendations'),
          authFetch('/api/status'),
          authFetch('/api/research_activity'),
          authFetch('/api/strategies'),
          authFetch('/api/trade_performance'),
          authFetch('/api/strategy_details'),
          authFetch('/api/strategy_params'),
          authFetch(`/api/strategy_series/${encoded}?days=60`),
          authFetch('/api/simulation_interval'),
        ]);
      const [
        portfolioData,
        tradesData,
        recsData,
        statusData,
        researchData,
        strategiesData,
        tradePerfData,
        detailsData,
        paramsData,
        seriesDataResp,
        intervalData,
      ] = await Promise.all([
        portfolioRes.json(),
        tradesRes.json(),
        recsRes.json(),
        statusRes.json(),
        researchRes.json(),
        strategiesRes.json(),
        tradePerfRes.json(),
        detailsRes.json(),
        paramsRes.json(),
        seriesRes.json(),
        intervalRes.json(),
      ]);
      setPortfolio(portfolioData);
      setTrades(tradesData);
      setRecommendations(recsData);
      setStatus(statusData);
      setResearchActivity(researchData);
      setStrategies(strategiesData);
      setTradePerformance(tradePerfData);
      setStrategyDetails(detailsData);
      setStrategyParams(paramsData);
      setSeriesData(seriesDataResp);
      setSimulationInterval(intervalData.minutes);
      // Toast notifications
      if (statusData && statusData.last_cycle && statusData.last_cycle !== prevStatusRef.current.last_cycle) {
        if (prevStatusRef.current.last_cycle) {
          addToast('Simulation cycle completed');
        }
        prevStatusRef.current.last_cycle = statusData.last_cycle;
      }
      if (Array.isArray(tradePerfData) && tradePerfData.length > prevTradesLenRef.current) {
        if (prevTradesLenRef.current > 0) {
          addToast('New trade executed');
        }
        prevTradesLenRef.current = tradePerfData.length;
      }
      if (portfolioData && typeof portfolioData.total_value === 'number' && Number.isFinite(portfolioData.total_value)) {
        if (prevPortfolioValueRef.current > 0 && portfolioData.total_value !== prevPortfolioValueRef.current) {
          addToast('Portfolio updated');
        }
        prevPortfolioValueRef.current = portfolioData.total_value;
      }
    } catch (error) {
      console.error('Failed to refresh dashboard data', error);
    }
  }

  // Polling effect: refresh data every minute when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    refreshAllData();
    const id = setInterval(() => {
      refreshAllData();
    }, 60000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, selectedAsset]);

  async function simulate() {
    setLoading(true);
    try {
      await authFetch('/api/simulate', { method: 'POST' });
      await refreshAllData();
    } catch (err) {
      console.error('Simulation failed', err);
    } finally {
      setLoading(false);
    }
  }

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
      setToken(data.token);
      setIsAuthenticated(true);
      setLoginUsername('');
      setLoginPassword('');
    } catch (err) {
      console.error('Login failed', err);
    }
  }

  function handleLogout() {
    setToken('');
    setIsAuthenticated(false);
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

  // Helper formatting functions
  function formatNumber(value, decimals = 2) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      const formatter = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
      return formatter.format(value);
    }
    return '—';
  }

  function formatDateTime(isoString) {
    if (!isoString) return '—';
    try {
      let toParse = isoString;
      if (!isoString.endsWith('Z')) {
        toParse = isoString + 'Z';
      }
      const date = new Date(toParse);
      return date.toLocaleString('en-US', { timeZone: NY_TIME_ZONE });
    } catch {
      return '—';
    }
  }

  // Determine list of assets for chart selection
  const assetsList = Array.from(new Set(recommendations.map((r) => r.asset))).filter(Boolean);
  const defaultAssets = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'ADA/USDT', 'XRP/USDT', 'SOL/USDT'];
  const selectableAssets = assetsList.length > 0 ? assetsList : defaultAssets;

  if (!isAuthenticated) {
    return (
      <LoginPage
        handleLogin={handleLogin}
        loginUsername={loginUsername}
        loginPassword={loginPassword}
        setLoginUsername={setLoginUsername}
        setLoginPassword={setLoginPassword}
      />
    );
  }

  return (
    <div className="container-fluid">
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark mb-3">
        <div className="container-fluid d-flex align-items-center">
          <button
            className="btn btn-dark me-2"
            type="button"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
          >
            &#9776;
          </button>
          <span className="navbar-brand mb-0 h1">Redshot</span>
        </div>
      </nav>
      <div className="row">
        <Sidebar
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          handleLogout={handleLogout}
          sidebarCollapsed={sidebarCollapsed}
        />
        <main className="col-md-10 ms-sm-auto px-md-4">
          <div className="pt-4">
            <h1 className="mb-4">Redshot Dashboard</h1>
            <div className="d-flex flex-wrap align-items-end mb-4 gap-3">
              <button className="btn btn-primary" onClick={simulate} disabled={loading}>
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
            <StatusBar
              status={status}
              portfolio={portfolio}
              formatNumber={formatNumber}
              formatDateTime={formatDateTime}
            />
            {activeSection === 'portfolio' && (
              <PortfolioSection portfolio={portfolio} formatNumber={formatNumber} />
            )}
            {activeSection === 'recommendations' && (
              <RecommendationsSection
                recommendations={recommendations}
                formatNumber={formatNumber}
                formatDateTime={formatDateTime}
              />
            )}
            {activeSection === 'trades' && (
              <TradesSection
                tradePerformance={tradePerformance}
                formatNumber={formatNumber}
                formatDateTime={formatDateTime}
              />
            )}
            {activeSection === 'research' && (
              <ResearchSection
                researchActivity={researchActivity}
                formatNumber={formatNumber}
                formatDateTime={formatDateTime}
              />
            )}
            {activeSection === 'strategy' && (
              <StrategySection
                strategies={strategies}
                strategyDetails={strategyDetails}
                strategyParams={strategyParams}
                handleParamChange={handleParamChange}
                applyStrategyParams={applyStrategyParams}
                formatNumber={formatNumber}
                formatDateTime={formatDateTime}
              />
            )}
            {activeSection === 'strategy_chart' && (
              <StrategyChartSection
                selectedAsset={selectedAsset}
                setSelectedAsset={setSelectedAsset}
                selectableAssets={selectableAssets}
                seriesData={seriesData}
                strategyParams={strategyParams}
                fetchSeries={fetchSeries}
              />
            )}
            {activeSection === 'simulation' && (
              <SimulationSettingsSection
                simulationInterval={simulationInterval}
                intervalInput={intervalInput}
                setIntervalInput={setIntervalInput}
                updateSimulationInterval={updateSimulationInterval}
              />
            )}
          </div>
          <div className="position-fixed top-0 end-0 p-3" style={{ zIndex: 1080 }}>
            {toasts.map((toast) => (
              <div key={toast.id} className="alert alert-info alert-dismissible fade show" role="alert">
                {toast.message}
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}