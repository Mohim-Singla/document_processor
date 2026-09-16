import React from 'react';
import ErrorView from './ErrorView';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled React Application Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorView
          title={this.props.title || 'Something went wrong'}
          subtitle={
            this.props.subtitle ||
            'An unexpected application error occurred. You can reload the page or return to the dashboard.'
          }
          error={this.state.error}
          errorCode="500"
          onRetry={this.handleReset}
          onGoHome={() => {
            window.location.href = '/';
          }}
        />
      );
    }

    return this.props.children;
  }
}
