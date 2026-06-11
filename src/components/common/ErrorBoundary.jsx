import { Component } from 'react'
import ErrorFallback from './ErrorFallback'
import { captureException } from '../../lib/sentry'

// 경량 에러 바운더리 — Sentry 지연 로딩과 분리(첫 페인트에 Sentry 불필요).
//   에러 발생 시 ErrorFallback 렌더 + captureException 으로 Sentry 에 전달(로드됐으면).
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    try { captureException(error) } catch { /* 추적 실패는 무시 */ }
  }

  render() {
    if (this.state.error) return <ErrorFallback error={this.state.error} />
    return this.props.children
  }
}

export default ErrorBoundary
