import React, { Component, ErrorInfo, ReactNode } from "react"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught Error Boundary catch:", error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="page" style={{ padding: "40px 20px", textAlign: "center" }}>
          <div className="stress-error-card" style={{ maxWidth: "600px", margin: "0 auto", padding: "24px" }}>
            <h2 style={{ fontSize: "18px", marginBottom: "8px", color: "var(--text)" }}>
              Something went wrong while rendering this page
            </h2>
            <p style={{ fontSize: "13px", color: "var(--secondary)", marginBottom: "16px" }}>
              {this.state.error?.message || "An unexpected error occurred in the application UI."}
            </p>
            <button
              className="button button-primary"
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
