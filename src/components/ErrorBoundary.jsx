// ─────────────────────────────────────────────────────────────────────────────
// ErrorBoundary.jsx – TennisVantage global crash net
//
// React requires class components for error boundaries. This one:
//  • Catches any unhandled render/lifecycle error below it in the tree
//  • Shows a styled recovery screen that matches the design system
//  • Lets the user reset state and try again without a full page reload
//  • Logs errors to console (swap console.error for Sentry etc. later)
// ─────────────────────────────────────────────────────────────────────────────
import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[TennisVantage ErrorBoundary]', error, info.componentStack);
  }

  handleReset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const msg = this.state.error?.message ?? 'An unexpected error occurred.';

    return (
      <div style={{
        minHeight: '100vh',
        background: '#070B14',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '24px',
        padding: '32px',
        fontFamily: '"DM Sans", system-ui, sans-serif',
      }}>
        {/* Icon */}
        <div style={{ fontSize: 56 }}>🎾</div>

        {/* Heading */}
        <div style={{ textAlign: 'center', maxWidth: 480 }}>
          <h1 style={{
            fontFamily: '"Syne", system-ui, sans-serif',
            fontWeight: 800,
            fontSize: 'clamp(22px, 5vw, 30px)',
            color: '#f1f5f9',
            margin: '0 0 12px',
          }}>
            Something went wrong
          </h1>
          <p style={{
            color: '#94a3b8',
            fontSize: 15,
            lineHeight: 1.6,
            margin: 0,
          }}>
            TennisVantage hit an unexpected error. Your session is safe — tap
            below to recover, or reload the page if the problem persists.
          </p>
        </div>

        {/* Error detail (collapsed, dev-friendly) */}
        <details style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10,
          padding: '12px 16px',
          maxWidth: 480,
          width: '100%',
          cursor: 'pointer',
        }}>
          <summary style={{ color: '#475569', fontSize: 13, userSelect: 'none' }}>
            Error details
          </summary>
          <pre style={{
            color: '#f87171',
            fontSize: 12,
            marginTop: 10,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: '"JetBrains Mono", monospace',
          }}>
            {msg}
          </pre>
        </details>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={this.handleReset}
            style={{
              padding: '12px 28px',
              background: 'linear-gradient(135deg, #9fef66, #6bc940)',
              border: 'none',
              borderRadius: 10,
              color: '#070B14',
              fontWeight: 700,
              fontSize: 15,
              cursor: 'pointer',
              fontFamily: '"DM Sans", system-ui, sans-serif',
            }}
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 28px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10,
              color: '#f1f5f9',
              fontWeight: 600,
              fontSize: 15,
              cursor: 'pointer',
              fontFamily: '"DM Sans", system-ui, sans-serif',
            }}
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}