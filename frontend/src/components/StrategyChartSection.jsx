// This is an updated version of the StrategyChartSection component from the
// upstream redshot project.  The original implementation expected an
// `assetsList` prop but the parent component (`App.jsx`) was passing
// `selectableAssets` instead.  As a result, `assetsList` was `undefined`
// which caused a runtime error when calling `.map` on it.  To make the
// component resilient to either prop name, we accept both `assetsList` and
// `selectableAssets` and default to an empty array if neither is provided.

import React, { useEffect } from 'react';
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
  // Prefer `assetsList` if provided.  Fallback to `selectableAssets` to
  // maintain backwards compatibility with App.jsx.  Default to an empty array.
  assetsList,
  selectableAssets,
  selectedAsset,
  setSelectedAsset,
  seriesData,         // { x:[], prices:[], short_sma:[], long_sma:[] }
  strategyParams,     // { threshold?: number, ... }
  fetchSeries,        // optional callback to refresh series when asset changes
}) {
  // Derive the options for the asset selector.  If `assetsList` is not an
  // array or is empty, fall back to `selectableAssets`.  Use an empty array as
  // a final fallback.  This prevents `.map` from being called on `undefined`.
  const assetOptions = Array.isArray(assetsList) && assetsList.length > 0
    ? assetsList
    : Array.isArray(selectableAssets)
      ? selectableAssets
      : [];

  // Extract series arrays safely; default to empty arrays if undefined.
  const labels    = Array.isArray(seriesData?.x)         ? seriesData.x         : [];
  const prices    = Array.isArray(seriesData?.prices)    ? seriesData.prices    : [];
  const shortSMA  = Array.isArray(seriesData?.short_sma) ? seriesData.short_sma : [];
  const longSMA   = Array.isArray(seriesData?.long_sma)  ? seriesData.long_sma  : [];

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
      { label: 'Price',  data: prices,   borderWidth: 2, pointRadius: 0 },
      { label: 'Short SMA', data: shortSMA, borderWidth: 2, pointRadius: 0 },
      { label: 'Long SMA',  data: longSMA,  borderWidth: 2, pointRadius: 0 },
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
      title:  { display: true, text: `Strategy Series: ${selectedAsset}` },
      tooltip: { intersect: false },
    },
    elements: { line: { tension: 0.1 } },
    scales: {
      x: { ticks: { maxTicksLimit: 10 } },
      y: { ticks: { callback: v => v } },
    },
  };

  // When the selected asset changes, call `fetchSeries` to refresh the data
  // if the callback has been provided.  Use an effect to avoid unnecessary
  // API calls on initial render.
  useEffect(() => {
    if (typeof fetchSeries === 'function') {
      fetchSeries(selectedAsset);
    }
  }, [selectedAsset, fetchSeries]);

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
          {assetOptions.map(a => (
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