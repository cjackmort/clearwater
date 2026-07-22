import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  message: string
  action?: ReactNode
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="card flex flex-col items-center gap-3 py-12 text-center">
      <div className="animate-float flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-400 to-teal-500 text-white shadow-lg shadow-cyan-500/25">
        {icon}
      </div>
      <div>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500">{message}</p>
      </div>
      {action}
    </div>
  )
}
