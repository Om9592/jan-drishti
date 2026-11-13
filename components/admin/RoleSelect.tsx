"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EditorialUser, Role } from "@/lib/types";

export function RoleSelect({ user, disabled }: { user: EditorialUser; disabled?: boolean }) {
  const router = useRouter();
  const [role, setRole] = useState<Role>(user.role);
  const [status, setStatus] = useState<string | null>(null);

  async function change(next: Role) {
    setRole(next);
    setStatus("saving");
    try {
      const res = await fetch("/api/users/role", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, role: next }),
      });
      if (!res.ok) {
        setStatus("failed");
        setRole(user.role);
        return;
      }
      setStatus("saved");
      router.refresh();
    } catch {
      setStatus("failed");
      setRole(user.role);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={role}
        onChange={(e) => change(e.target.value as Role)}
        disabled={disabled}
        aria-label={`Role for ${user.email}`}
        className="border border-rule bg-white px-2 py-1 font-sans text-[0.72rem] text-ink-soft"
      >
        <option value="user">user</option>
        <option value="researcher">researcher</option>
        <option value="editor">editor</option>
        <option value="admin">admin</option>
      </select>
      {status === "saved" && <span className="font-sans text-[0.6rem] text-verdict-true">saved</span>}
      {status === "failed" && <span className="font-sans text-[0.6rem] text-verdict-false">failed</span>}
    </div>
  );
}
