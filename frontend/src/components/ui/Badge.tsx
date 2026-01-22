import { clsx } from "clsx";

type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "neutral";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-gray-100 text-gray-800",
  success: "bg-green-100 text-green-800",
  warning: "bg-yellow-100 text-yellow-800",
  error: "bg-red-100 text-red-800",
  info: "bg-blue-100 text-blue-800",
  neutral: "bg-gray-100 text-gray-600",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

// Mapeia status para variante
export function getStatusVariant(
  status: string
): BadgeVariant {
  const statusMap: Record<string, BadgeVariant> = {
    ACTIVE: "success",
    INACTIVE: "warning",
    REACTIVATING: "info",
    CONVERTED: "success",
    DISCARDED: "error",
    SCHEDULED: "info",
    COMPLETED: "success",
    CANCELLED: "error",
    NO_SHOW: "warning",
    PENDING: "warning",
    SENT: "success",
    FAILED: "error",
  };

  return statusMap[status] || "default";
}

// Mapeia sentiment para variante
export function getSentimentVariant(
  sentiment: string
): BadgeVariant {
  const sentimentMap: Record<string, BadgeVariant> = {
    positivo: "success",
    neutro: "neutral",
    negativo: "error",
  };

  return sentimentMap[sentiment] || "neutral";
}
