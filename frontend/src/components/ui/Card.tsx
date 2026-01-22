import { clsx } from "clsx";
import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
}

export function Card({ children, className, hover = false, glow = false }: CardProps) {
  return (
    <div
      className={clsx(
        "bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] p-6 transition-all duration-300",
        hover && "hover:shadow-lg hover:shadow-primary-500/10 hover:border-primary-500/30 hover:-translate-y-1",
        glow && "shadow-lg shadow-primary-500/20",
        className
      )}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
        {subtitle && <p className="text-sm text-[var(--text-tertiary)]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
