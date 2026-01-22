import { useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";

interface DateRange {
  startDate: string;
  endDate: string;
  label: string;
}

interface DateFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const presets: DateRange[] = [
  {
    label: "Hoje",
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  },
  {
    label: "Ultimos 7 dias",
    startDate: format(subDays(new Date(), 7), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  },
  {
    label: "Ultimos 30 dias",
    startDate: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  },
  {
    label: "Este mes",
    startDate: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    endDate: format(endOfMonth(new Date()), "yyyy-MM-dd"),
  },
  {
    label: "Mes passado",
    startDate: format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd"),
    endDate: format(endOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd"),
  },
  {
    label: "Todo o periodo",
    startDate: "",
    endDate: "",
  },
];

export function DateFilter({ value, onChange }: DateFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl text-sm font-medium text-[var(--text-primary)] hover:border-primary-500/50 transition-all duration-200"
      >
        <Calendar className="w-4 h-4 text-primary-500" />
        <span>{value.label}</span>
        <ChevronDown
          className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-56 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-xl z-20 overflow-hidden">
            <div className="p-2">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => {
                    onChange(preset);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm rounded-lg transition-all duration-200 ${
                    value.label === preset.label
                      ? "bg-primary-500/10 text-primary-500 font-medium"
                      : "text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom date range */}
            <div className="border-t border-[var(--border-color)] p-4 space-y-3">
              <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                Periodo personalizado
              </p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={value.startDate}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      startDate: e.target.value,
                      label: "Personalizado",
                    })
                  }
                  className="px-3 py-2 text-xs bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <input
                  type="date"
                  value={value.endDate}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      endDate: e.target.value,
                      label: "Personalizado",
                    })
                  }
                  className="px-3 py-2 text-xs bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Hook para usar o estado do filtro
export function useDateFilter() {
  const [dateRange, setDateRange] = useState<DateRange>({
    label: "Hoje",
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  });

  return { dateRange, setDateRange };
}
