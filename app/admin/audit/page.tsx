import { getStore } from "@/lib/store";
import { formatDateTime } from "@/lib/utils";

export default async function AdminAuditPage() {
  const store = getStore();
  const entries = await store.listAuditLogs(100);

  return (
    <div>
      <h2 className="font-serif text-[1.3rem] font-semibold text-navy">Audit log</h2>
      <p className="mt-1 max-w-2xl font-sans text-[0.78rem] leading-relaxed text-ink-muted">
        Every editorial action — creation, edit, publish, verdict approval, correction, role change — is recorded with
        the actor. The log is append-only in Firestore rules.
      </p>

      <div className="mt-5 overflow-x-auto border border-rule bg-white">
        <table className="w-full min-w-[46rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-rule bg-paper-warm">
              {["When", "Action", "Actor", "Target", "Summary"].map((heading) => (
                <th key={heading} className="px-3 py-2 font-sans text-[0.6rem] uppercase tracking-[0.1em] text-ink-muted">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b border-rule last:border-0">
                <td className="whitespace-nowrap px-3 py-2 font-sans text-[0.72rem] text-ink-muted">
                  {formatDateTime(entry.createdAt)}
                </td>
                <td className="px-3 py-2 font-mono text-[0.7rem] text-navy">{entry.action}</td>
                <td className="px-3 py-2 font-sans text-[0.72rem] text-ink-soft">
                  {entry.actorEmail ?? entry.actorId}
                </td>
                <td className="px-3 py-2 font-sans text-[0.7rem] text-ink-muted">
                  {entry.targetType}/{entry.targetId.slice(0, 12)}
                </td>
                <td className="px-3 py-2 font-sans text-[0.76rem] text-ink-soft">{entry.summary}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center font-sans text-[0.82rem] text-ink-muted">
                  No activity recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
