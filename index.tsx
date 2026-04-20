
import React, { Component, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
// @ts-ignore
import { HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

// Simple Error Boundary to catch crashes and show them
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("React Application Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', color: '#ff5555', fontFamily: 'sans-serif', backgroundColor: '#111', minHeight: '100vh' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Something went wrong.</h1>
          <p>The application crashed with the following error:</p>
          <pre style={{ backgroundColor: '#222', padding: '1rem', borderRadius: '0.5rem', overflowX: 'auto', marginTop: '1rem' }}>
            {this.state.error?.toString()}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            style={{ marginTop: '1rem', padding: '0.5rem 1rem', backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '0.25rem', cursor: 'pointer' }}
          >
            Reload App
          </button>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Ensure deep links without a hash (e.g. legacy printed codes) are forwarded to the HashRouter
if (window.location.pathname && window.location.pathname.length > 1) {
  const hash = window.location.hash;
  if (!hash) {
    const newUrl = window.location.origin + '/#' + window.location.pathname + window.location.search;
    window.location.replace(newUrl);
  }
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <App />
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
