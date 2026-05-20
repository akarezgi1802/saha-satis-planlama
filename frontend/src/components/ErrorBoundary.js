import { Component } from "react";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: "center" }}>
          <h2 style={{ color: "#ef4444", marginBottom: 12 }}>Sayfa yüklenirken hata oluştu</h2>
          <p style={{ color: "#666", marginBottom: 16 }}>{this.state.error?.message || "Bilinmeyen hata"}</p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{
              padding: "8px 20px", borderRadius: 8, border: "none",
              background: "#3b82f6", color: "#fff", cursor: "pointer", fontSize: 14,
            }}
          >
            Sayfayı Yenile
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
