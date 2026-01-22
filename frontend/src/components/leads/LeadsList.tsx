import { useState } from "react";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Calendar,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import { useLeads } from "../../hooks/useDashboard";
import { Card } from "../ui/Card";
import { Badge, getStatusVariant } from "../ui/Badge";
import { SkeletonTable } from "../ui/Skeleton";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  REACTIVATING: "Reativando",
  CONVERTED: "Convertido",
  DISCARDED: "Descartado",
};

const STAGE_LABELS: Record<string, string> = {
  greeting: "Saudacao",
  city_collected: "Cidade",
  segment_collected: "Segmento",
  day_selected: "Dia",
  meeting_scheduled: "Agendado",
  meeting_cancelled: "Cancelado",
  objection: "Objecao",
  transferred: "Transferido",
  unresponsive: "Sem resposta",
  unknown: "Desconhecido",
};

export function LeadsList() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string | undefined>();
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useLeads(page, 20, status, search);

  if (isLoading) {
    return <SkeletonTable />;
  }

  if (error) {
    return (
      <Card>
        <p className="text-red-500">Erro ao carregar leads</p>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <Card>
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
          <input
            type="text"
            placeholder="Buscar por telefone..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
          />
        </div>
        <select
          value={status || ""}
          onChange={(e) => {
            setStatus(e.target.value || undefined);
            setPage(1);
          }}
          className="px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-sm text-[var(--text-tertiary)] border-b border-[var(--border-color)]">
              <th className="pb-3 font-medium">Telefone</th>
              <th className="pb-3 font-medium">Status</th>
              <th className="pb-3 font-medium">Estagio</th>
              <th className="pb-3 font-medium">Ultimo Contato</th>
              <th className="pb-3 font-medium">Info</th>
              <th className="pb-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {data.data.map((lead) => (
              <tr
                key={lead.id}
                className="border-b border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] transition-colors duration-200"
              >
                <td className="py-4">
                  <span className="font-medium text-[var(--text-primary)]">
                    {lead.phone}
                  </span>
                </td>
                <td className="py-4">
                  <Badge variant={getStatusVariant(lead.conversationStatus)}>
                    {STATUS_LABELS[lead.conversationStatus] ||
                      lead.conversationStatus}
                  </Badge>
                </td>
                <td className="py-4">
                  {lead.stage && (
                    <span className="text-sm text-[var(--text-secondary)]">
                      {STAGE_LABELS[lead.stage] || lead.stage}
                    </span>
                  )}
                </td>
                <td className="py-4 text-sm text-[var(--text-tertiary)]">
                  {format(parseISO(lead.lastContactAt), "dd/MM/yyyy HH:mm", {
                    locale: ptBR,
                  })}
                </td>
                <td className="py-4">
                  <div className="flex items-center gap-2">
                    {lead.hasMeeting && (
                      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-green-500/10">
                        <Calendar
                          className="w-4 h-4 text-green-500"
                        />
                      </div>
                    )}
                    {lead.hasSummary && (
                      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary-500/10">
                        <MessageSquare
                          className="w-4 h-4 text-primary-500"
                        />
                      </div>
                    )}
                  </div>
                </td>
                <td className="py-4">
                  <Link
                    to={`/leads/${lead.id}`}
                    className="flex items-center gap-1 text-sm text-primary-500 hover:text-primary-600 font-medium transition-colors duration-200"
                  >
                    Ver detalhes
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginacao */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--border-color)]">
        <p className="text-sm text-[var(--text-tertiary)]">
          Mostrando {(page - 1) * 20 + 1} -{" "}
          {Math.min(page * 20, data.pagination.total)} de{" "}
          {data.pagination.total} leads
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] disabled:opacity-50 disabled:cursor-not-allowed hover:border-primary-500/50 transition-all duration-200"
          >
            <ChevronLeft className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>
          <span className="text-sm text-[var(--text-secondary)] px-2">
            Pagina {page} de {data.pagination.totalPages}
          </span>
          <button
            onClick={() =>
              setPage((p) => Math.min(data.pagination.totalPages, p + 1))
            }
            disabled={page === data.pagination.totalPages}
            className="p-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] disabled:opacity-50 disabled:cursor-not-allowed hover:border-primary-500/50 transition-all duration-200"
          >
            <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>
        </div>
      </div>
    </Card>
  );
}
