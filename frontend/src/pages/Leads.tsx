import { Users } from "lucide-react";
import { LeadsList } from "../components/leads/LeadsList";

export function Leads() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600">
          <Users className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Leads</h1>
          <p className="text-sm text-[var(--text-tertiary)]">
            Gerenciamento de leads e conversas do bot
          </p>
        </div>
      </div>

      <LeadsList />
    </div>
  );
}
