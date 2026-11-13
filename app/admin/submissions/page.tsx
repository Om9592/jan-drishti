import { getStore } from "@/lib/store";
import { TriageActions } from "@/components/admin/TriageActions";
import { formatDateTime } from "@/lib/utils";

export default async function AdminSubmissionsPage() {
  const store = getStore();
  const submissions = await store.listSubmissions("all");

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-serif text-[1.3rem] font-semibold text-navy">Submission queue</h2>
        <p className="font-sans text-[0.65rem] uppercase tracking-[0.1em] text-ink-muted">
          {submissions.length} total
        </p>
      </div>
      <p className="mt-1 max-w-2xl font-sans text-[0.78rem] leading-relaxed text-ink-muted">
        Submissions are leads, not evidence. Triage notes are internal. Running research creates a reviewable file —
        it never publishes a verdict.
      </p>

      {submissions.length === 0 ? (
        <p className="mt-6 border border-dashed border-rule-strong bg-paper-warm/40 px-4 py-8 text-center font-sans text-[0.85rem] text-ink-muted">
          The queue is empty.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {submissions.map((submission) => (
            <li key={submission.id} className="border border-rule bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="border border-rule px-1.5 py-0.5 font-sans text-[0.56rem] uppercase tracking-[0.1em] text-ink-muted">
                    {submission.type.replace(/_/g, " ")}
                  </span>
                  <span className="font-sans text-[0.6rem] uppercase tracking-[0.1em] text-gold-dark">
                    {submission.status}
                  </span>
                  <span className="font-sans text-[0.62rem] text-ink-muted">
                    {formatDateTime(submission.createdAt)}
                  </span>
                  {submission.isSample && (
                    <span className="font-sans text-[0.56rem] uppercase tracking-[0.1em] text-ink-muted">
                      sample data
                    </span>
                  )}
                </div>
                <span className="font-sans text-[0.58rem] text-ink-muted">#{submission.id.slice(-8)}</span>
              </div>

              <p className="mt-2 whitespace-pre-wrap font-sans text-[0.85rem] leading-relaxed text-ink-soft">
                {submission.content}
              </p>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-sans text-[0.68rem] text-ink-muted">
                {submission.url && (
                  <a href={submission.url} target="_blank" rel="noopener noreferrer nofollow" className="text-navy underline decoration-gold underline-offset-2">
                    Submitted link
                  </a>
                )}
                {submission.claimedSource && <span>Seen on: {submission.claimedSource}</span>}
                {submission.contactEmail && <span>Contact: {submission.contactEmail}</span>}
                {submission.language && <span>Language: {submission.language}</span>}
                {submission.factCheckId && (
                  <a href={`/admin/fact-checks/${submission.factCheckId}`} className="text-navy underline decoration-gold underline-offset-2">
                    Linked review file
                  </a>
                )}
              </div>

              <TriageActions submission={submission} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
