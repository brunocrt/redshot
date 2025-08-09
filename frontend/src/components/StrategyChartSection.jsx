import React from 'react';
import { Line } from 'react-chartjs-2';

/**
 * Strategy chart section.  Allows selection of an asset and displays a
 * multi-series chart with price, short and long SMAs and optional threshold
 * bands.  The ``seriesData`` prop contains arrays of x labels, prices,
 * short_sma and long_sma.  ``strategyParams.threshold`` is used to compute
 * threshold bands when provided.
 */
export default function StrategyChartSection({
  selectedAsset,
  setSelectedAsset,
  selectableAssets,
  seriesData,
  strategyParams,
  fetchSeries,
}) {
  // Compute threshold bands when threshold is numeric
  const threshold = parseFloat(strategyParams.threshold);
  const hasThreshold = !isNaN(threshold);
  const upper = hasThreshold
    ? seriesData.short_sma.map((v) => (v != null ? v * (1 + threshold) : null))
    : [];
  const lower = hasThreshold
    ? seriesData.short_sma.map((v) => (v != null ? v * (1 - threshold) : null))
    : [];
  const datasets = [
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
  ];
  if (hasThreshold) {
    datasets.push({
      label: 'Upper Threshold',
      data: upper,
      borderColor: 'rgba(255, 206, 86, 1)',
      backgroundColor: 'rgba(255, 206, 86, 0.2)',
      borderDash: [5, 5],
      tension: 0.1,
    });
    datasets.push({
      label: 'Lower Threshold',
      data: lower,
      borderColor: 'rgba(153, 102, 255, 1)',
      backgroundColor: 'rgba(153, 102, 255, 0.2)',
      borderDash: [5, 5],
      tension: 0.1,
    });
  }
  return (
    <div>
      <h2>Strategy Series Chart</h2>
      <div className="mb-3">
        <label htmlFor="assetSelect" className="form-label">
          Select Asset:
        </label>
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
            <option key={asset} value={asset}>
              {asset}
            </option>
          ))}
        </select>
      </div>
      <div className="chart-container" style={{ position: 'relative', height: '400px' }}>
        <Line
          data={{ labels: seriesData.x, datasets }}
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
              },
              y: {
                ticks: { color: 'rgba(255,255,255,0.9)' },
              },
            },
          }}
        />
      </div>
    </div>
  );
}