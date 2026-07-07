import { cn } from '@/lib/utils'

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />
}

export function CardSkeleton() {
  return (
    <div className="rounded-lg border p-4">
      <Skeleton className="mb-2 h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  )
}

export function StatsCardSkeleton() {
  return (
    <div className="rounded-lg border p-6">
      <Skeleton className="mb-3 h-3 w-20" />
      <Skeleton className="h-8 w-16" />
    </div>
  )
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}

export default Skeleton
