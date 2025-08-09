import React from 'react';

/**
 * Simulation settings section.  Displays the current automatic simulation
 * interval and provides a form to update it.  Users can specify the
 * interval in minutes; negative or zero values are rejected.
 */
export default function SimulationSettingsSection({
  simulationInterval,
  intervalInput,
  setIntervalInput,
  updateSimulationInterval,
}) {
  return (
    <div>
      <h2>Simulation Settings</h2>
      <p>Current interval: {simulationInterval != null ? `${simulationInterval.toFixed(2)} minutes` : '—'}</p>
      <div className="row g-3 align-items-end">
        <div className="col-auto">
          <label htmlFor="intervalInput" className="form-label">
            New interval (minutes)
          </label>
          <input
            id="intervalInput"
            type="number"
            min="0.1"
            step="0.1"
            className="form-control"
            value={intervalInput}
            onChange={(e) => setIntervalInput(e.target.value)}
          />
        </div>
        <div className="col-auto">
          <button className="btn btn-secondary" onClick={updateSimulationInterval}>
            Update Interval
          </button>
        </div>
      </div>
    </div>
  );
}