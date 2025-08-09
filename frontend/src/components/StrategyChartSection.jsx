// frontend/src/components/StrategyChartSection.jsx
import React from 'react';
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

// Ensure Chart.js is registered even if App.jsx doesn’t do it
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function StrategyChartSection({
  assetsList,
  selectedAsset,
  setSelectedAsset,
  seriesData,         // { x:[], prices:[], short_sma:[], long_sma:[] }
  strategyParams      // { threshold?: number, ... }
}) {
  const labels = Array.isArray(seriesData?.x) ? seriesData.x : [];
  const prices = Array.isArray(seriesData?.prices) ? seriesData.prices : [];
  const shortSMA = Array.isArray(seriesData?.short_sma) ? seriesData.short_sma : [];
  const longSMA  = Array.isArray(seriesData?.long_sma) ? seriesData.long_sma : [];

  // Compute threshold bands if we have a numeric threshold AND short SMA
  let upperBand = [];
  let lowerBand = [];
  if (typeof strategyParams?.threshold === 'number' && shortSMA.length) {
    const th = strategyParams.threshold; // e.g. 0.02 for 2%
    upperBand = shortSMA.map(v => (Number.isFinite(v) ? v * (1 + th) : null));
    lowerBand = shortSMA.map(v => (Number.isFinite(v) ? v * (1 - th) : null));
  } else {
    // Keep arrays aligned with labels but null so they don’t render
    upperBand = labels.map(() => null);
    lowerBand = labels.map(() => null);
  }

  const data = {
    labels,
    datasets: [
      { label: 'Price', data: prices, borderWidth: 2, pointRadius: 0 },
      { label: 'Short SMA', data: shortSMA, borderWidth: 2, pointRadius: 0 },
      { label: 'Long SMA', data: longSMA, borderWidth: 2, pointRadius: 0 },
      {
        label: 'Upper Threshold',
        data: upperBand,
        borderWidth: 1,
        borderDash: [6, 6],
        pointRadius: 0,
      },
      {
        label: 'Lower Threshold',
        data: lowerBand,
        borderWidth: 1,
        borderDash: [6, 6],
        pointRadius: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: `Strategy Series: ${selectedAsset}` },
      tooltip: { intersect: false },
    },
    elements: { line: { tension: 0.1 } },
    scales: {
      x: { ticks: { maxTicksLimit: 10 } },
      y: { ticks: { callback: v => v } },
    },
  };

  return (
    <div>
      <h2>Strategy Series Chart</h2>
      <div className="mb-3" style={{ maxWidth: 300 }}>
        <label className="form-label">Asset</label>
        <select
          className="form-select"
          value={selectedAsset}
          onChange={e => setSelectedAsset(e.target.value)}
        >
          {assetsList.map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      <div className="chart-container" style={{ position: 'relative', height: 400 }}>
        <Line data={data} options={options} />
      </div>
    </div>
  );
}
