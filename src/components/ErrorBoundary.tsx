import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Captura erros de runtime em qualquer página filha e evita que o SPA
 * inteiro quebre (tela branca). Mostra um fallback com opção de reset.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Erro capturado:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 p-4">
          <div className="w-full max-w-md rounded-2xl border border-indigo-500/30 bg-white/95 p-8 text-center shadow-2xl backdrop-blur dark:bg-gray-950/95">
            <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-rose-600 shadow-lg shadow-red-500/20">
              <AlertTriangle className="size-8 text-white" />
            </div>
            <h2 className="mb-2 text-xl font-bold">Algo deu errado</h2>
            <p className="mb-1 text-sm text-muted-foreground">
              Ocorreu um erro inesperado. Você pode tentar novamente.
            </p>
            {this.state.error?.message && (
              <p className="mb-5 mt-2 line-clamp-3 rounded-lg bg-muted px-3 py-2 text-left text-xs text-muted-foreground">
                {this.state.error.message}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={this.handleReset}
                className="flex-1 rounded-xl border border-indigo-500/20 px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:border-indigo-500/50 hover:bg-indigo-500/10"
              >
                Tentar novamente
              </button>
              <button
                onClick={this.handleReload}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:from-indigo-500 hover:to-blue-500"
              >
                <RotateCcw className="size-4" /> Recarregar
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
