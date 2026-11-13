import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/api";
import { requireRole } from "@/lib/security/auth";
import { getStore } from "@/lib/store";
import { roleUpdateSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  return handleRoute(async () => {
    const viewer = await requireRole("admin");
    const parsed = roleUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Unknown role." }, { status: 422 });
    }
    const store = getStore();
    const user = await store.setUserRole(parsed.data.userId, parsed.data.role, {
      id: viewer.uid,
      email: viewer.email ?? undefined,
    });
    return { user };
  });
}
