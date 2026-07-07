import type { ReactNode } from 'react'

function PageTransition({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`animate-fade-in-up ${className}`}>
      {children}
    </div>
  )
}

export default PageTransition
