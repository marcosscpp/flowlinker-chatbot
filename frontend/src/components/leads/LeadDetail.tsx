import { useParams, Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  RefreshCw,
  User,
  Bot,
  Calendar,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { useLead, useRegenerateSummary } from "../../hooks/useDashboard";
import { Card, CardHeader } from "../ui/Card";
import { Badge, getStatusVariant, getSentimentVariant } from "../ui/Badge";
import { Skeleton } from "../ui/Skeleton";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  REACTIVATING: "Reativando",
  CONVERTED: "Convertido",
  DISCARDED: "Descartado",
  SCHEDULED: "Agendada",
  COMPLETED: "Realizada",
  CANCELLED: "Cancelada",
  NO_SHOW: "No-show",
};

export function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useLead(id || "");
  const regenerateMutation = useRegenerateSummary();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Skeleton className="h-96" />
          </div>
          <div>
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <p className="text-red-500">Erro ao carregar lead</p>
      </Card>
    );
  }

  const { lead, summary } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/leads"
          className="p-2 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] hover:border-primary-500/50 transition-all duration-200"
        >
          <ArrowLeft className="w-4 h-4 text-[var(--text-secondary)]" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            {lead.phone}
          </h1>
          <p className="text-sm text-[var(--text-tertiary)]">
            Criado em{" "}
            {format(parseISO(lead.createdAt), "dd/MM/yyyy 'as' HH:mm", {
              locale: ptBR,
            })}
          </p>
        </div>
        <Badge
          variant={getStatusVariant(lead.conversationStatus)}
          className="ml-auto"
        >
          {STATUS_LABELS[lead.conversationStatus] || lead.conversationStatus}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversa */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="Historico da Conversa" />
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
              {lead.messages.length === 0 ? (
                <p className="text-[var(--text-tertiary)] text-center py-8">
                  Nenhuma mensagem registrada
                </p>
              ) : (
                lead.messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex gap-3 ${
                      msg.role === "user" ? "" : "flex-row-reverse"
                    }`}
                  >
                    <div
                      className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${
                        msg.role === "user"
                          ? "bg-primary-500/10"
                          : "bg-[var(--bg-tertiary)]"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <User className="w-4 h-4 text-primary-500" />
                      ) : (
                        <Bot className="w-4 h-4 text-[var(--text-secondary)]" />
                      )}
                    </div>
                    <div
                      className={`flex-1 p-4 rounded-2xl ${
                        msg.role === "user"
                          ? "bg-primary-500/10 text-[var(--text-primary)]"
                          : "bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Resumo IA */}
          <Card>
            <CardHeader
              title="Resumo com IA"
              action={
                <button
                  onClick={() => id && regenerateMutation.mutate(id)}
                  disabled={regenerateMutation.isPending}
                  className="p-2 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] hover:border-primary-500/50 disabled:opacity-50 transition-all duration-200"
                  title="Regenerar resumo"
                >
                  <RefreshCw
                    className={`w-4 h-4 text-[var(--text-secondary)] ${
                      regenerateMutation.isPending ? "animate-spin" : ""
                    }`}
                  />
                </button>
              }
            />
            {summary ? (
              <div className="space-y-4">
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {summary.text}
                </p>

                {summary.keyPoints.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-[var(--text-tertiary)] mb-2 uppercase tracking-wider">
                      Pontos-chave
                    </p>
                    <ul className="space-y-1.5">
                      {summary.keyPoints.map((point, i) => (
                        <li
                          key={i}
                          className="text-sm text-[var(--text-secondary)] flex items-start gap-2"
                        >
                          <span className="text-primary-500 mt-0.5">•</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-[var(--border-color)]">
                  <Badge variant={getSentimentVariant(summary.sentiment)}>
                    {summary.sentiment}
                  </Badge>
                  <button
                    onClick={() => id && regenerateMutation.mutate(id)}
                    disabled={regenerateMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-500 bg-primary-500/10 rounded-lg hover:bg-primary-500/20 disabled:opacity-50 transition-all duration-200"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${
                        regenerateMutation.isPending ? "animate-spin" : ""
                      }`}
                    />
                    Atualizar
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary-500/10 mx-auto mb-3">
                  <Sparkles className="w-6 h-6 text-primary-500" />
                </div>
                <p className="text-sm text-[var(--text-tertiary)]">
                  Clique em regenerar para gerar o resumo
                </p>
              </div>
            )}
          </Card>

          {/* Reunioes */}
          {lead.meetings.length > 0 && (
            <Card>
              <CardHeader title="Reunioes" />
              <div className="space-y-3">
                {lead.meetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="p-4 bg-[var(--bg-tertiary)] rounded-xl space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                        <Calendar className="w-4 h-4 text-primary-500" />
                        {format(
                          parseISO(meeting.startTime),
                          "dd/MM/yyyy 'as' HH:mm",
                          { locale: ptBR }
                        )}
                      </div>
                      <Badge variant={getStatusVariant(meeting.status)}>
                        {STATUS_LABELS[meeting.status] || meeting.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Vendedor: {meeting.sellerName}
                    </p>
                    {meeting.meetLink && (
                      <a
                        href={meeting.meetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-primary-500 hover:text-primary-600 transition-colors duration-200"
                      >
                        Link da reuniao
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Info adicional */}
          <Card>
            <CardHeader title="Informacoes" />
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--text-tertiary)]">Estagio</span>
                <span className="text-[var(--text-primary)]">
                  {lead.stage || "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-tertiary)]">
                  Tentativas de reativacao
                </span>
                <span className="text-[var(--text-primary)]">
                  {lead.reactivationAttempts}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-tertiary)]">
                  Ultimo contato
                </span>
                <span className="text-[var(--text-primary)]">
                  {format(parseISO(lead.lastContactAt), "dd/MM/yyyy HH:mm", {
                    locale: ptBR,
                  })}
                </span>
              </div>
              {lead.discardReason && (
                <div className="pt-3 border-t border-[var(--border-color)]">
                  <span className="text-[var(--text-tertiary)] block mb-1">
                    Motivo do descarte
                  </span>
                  <span className="text-red-500">{lead.discardReason}</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
