import { getStore } from "@/lib/store";
import { getViewer } from "@/lib/security/auth";
import { RoleSelect } from "@/components/admin/RoleSelect";
import { formatDate } from "@/lib/utils";

export default async function AdminUsersPage() {
  const store = getStore();
  const [users, viewer] = await Promise.all([store.listUsers(), getViewer()]);

  return (
    <div>
      <h2 className="font-serif text-[1.3rem] font-semibold text-navy">Users and roles</h2>
      <p className="mt-1 max-w-2xl font-sans text-[0.78rem] leading-relaxed text-ink-muted">
        Roles are enforced server-side on every request. Grant <strong>editor</strong> only to people authorised to
        publish verdicts in their own name.
      </p>

      <div className="mt-5 overflow-x-auto border border-rule bg-white">
        <table className="w-full min-w-[42rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-rule bg-paper-warm">
              {["Name", "Email", "Role", "Status", "Created", "Last seen"].map((heading) => (
                <th key={heading} className="px-3 py-2 font-sans text-[0.6rem] uppercase tracking-[0.1em] text-ink-muted">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-rule last:border-0">
                <td className="px-3 py-2.5 font-sans text-[0.82rem] text-ink">{user.name || "—"}</td>
                <td className="px-3 py-2.5 font-sans text-[0.78rem] text-ink-soft">{user.email}</td>
                <td className="px-3 py-2.5">
                  <RoleSelect user={user} disabled={!viewer || viewer.role !== "admin"} />
                </td>
                <td className="px-3 py-2.5 font-sans text-[0.72rem] uppercase tracking-[0.08em] text-ink-muted">
                  {user.status}
                </td>
                <td className="px-3 py-2.5 font-sans text-[0.72rem] text-ink-muted">
                  {formatDate(user.createdAt)}
                </td>
                <td className="px-3 py-2.5 font-sans text-[0.72rem] text-ink-muted">
                  {user.lastSeenAt ? formatDate(user.lastSeenAt) : "—"}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center font-sans text-[0.82rem] text-ink-muted">
                  No users yet. Accounts appear here after their first sign-in.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(!viewer || viewer.role !== "admin") && (
        <p className="mt-3 font-sans text-[0.72rem] text-ink-muted">
          Role changes require the admin role.
        </p>
      )}
    </div>
  );
}
