import React from 'react';

/**
 * Login form component.  Displays username and password inputs and calls
 * ``handleLogin`` when the form is submitted.  All state is managed by
 * the parent component and passed in via props.
 */
export default function LoginPage({ handleLogin, loginUsername, loginPassword, setLoginUsername, setLoginPassword }) {
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