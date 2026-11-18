import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}

export function Card({ children, className = '', padded = true }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-border bg-surface-raised ${padded ? 'p-5 sm:p-6' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
