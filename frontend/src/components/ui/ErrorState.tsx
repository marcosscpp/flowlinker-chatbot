import { AlertCircle, RefreshCw, WifiOff } from "lucide-react";
import { clsx } from "clsx";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  variant?: "default" | "compact" | "inline";
  className?: string;
}

export function ErrorState({
  title = "Erro ao carregar dados",
  message = "Ocorreu um erro inesperado. Tente novamente.",
  onRetry,
  variant = "default",
  className,
}: ErrorStateProps) {
  if (variant === "inline") {
    return (
      <div className={clsx("flex items-center gap-2 text-red-500 dark:text-red-400", className)}>
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm">{message}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-sm underline hover:no-underline"
          >
            Tentar novamente
          </button>
        )}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div
        className={clsx(
          "flex items-center gap-3 p-4 rounded-xl",
          "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800",
          className
        )}
      >
        <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-red-700 dark:text-red-300">{message}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg
                     bg-red-100 dark:bg-red-800/50 text-red-700 dark:text-red-300
                     hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        )}
      </div>
    );
  }

  // Default variant - full card
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center p-8 rounded-xl text-center",
        "bg-[var(--bg-secondary)] border border-[var(--border-color)]",
        className
      )}
    >
      <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
        <WifiOff className="w-8 h-8 text-red-500 dark:text-red-400" />
      </div>
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
        {title}
      </h3>
      <p className="text-sm text-[var(--text-secondary)] max-w-sm mb-6">
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium
                   bg-primary-500 hover:bg-primary-600 text-white
                   transition-colors duration-200"
        >
          <RefreshCw className="w-4 h-4" />
          Tentar novamente
        </button>
      )}
    </div>
  );
}

// Empty state component
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  message,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center p-8 rounded-xl text-center",
        "bg-[var(--bg-secondary)] border border-[var(--border-color)]",
        className
      )}
    >
      {icon && (
        <div className="w-16 h-16 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
        {title}
      </h3>
      {message && (
        <p className="text-sm text-[var(--text-secondary)] max-w-sm mb-6">
          {message}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium
                   bg-primary-500 hover:bg-primary-600 text-white
                   transition-colors duration-200"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
