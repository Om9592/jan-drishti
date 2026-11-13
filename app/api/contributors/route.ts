import { handleRoute, jsonError, jsonOk } from "@/lib/api";
import { requireRole } from "@/lib/security/auth";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { getStore } from "@/lib/store";
import { contributorApplicationSchema, contributorDecisionSchema } from "@/lib/validation/schemas";
import { COLLECTIONS, adminAuth, adminDb } from "@/lib/firebase/admin";
import { config, isFirebaseAdminConfigured } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Freelance contributor programme.
 *
 * POST  — any reader may apply (rate limited, no account needed).
 * PATCH — admin only: approve (creates the account if needed, grants the
 *         contributor role, emails a password-set link) or reject.
 *
 * Contributors can draft and submit stories, but only an editor can publish:
 * /api/articles forces `status: "review"` for that role.
 */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const ip = clientIp(request);
    const limit = rateLimit(`contrib-apply:${ip}`, 3, 60 * 60 * 1000);
    if (!limit.allowed) return jsonError("Too many applications from this connection. Try again later.", 429);

    const parsed = contributorApplicationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return jsonError("Please check the highlighted fields.", 422, {
        fields: Object.fromEntries(
          parsed.error.issues.map((i) => [i.path.join(".") || "form", i.message]),
        ),
      });
    }

    const data = parsed.data;
    const store = getStore();
    const submission = await store.createSubmission({
      type: "contributor_application",
      content: [
        `Beats: ${data.beats}`,
        `Experience: ${data.experience}`,
        data.location ? `Location: ${data.location}` : "",
        `Pitch: ${data.pitch}`,
        data.clips ? `Clips: ${data.clips}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
      language: "en",
      contactEmail: data.email,
      submitterName: data.name,
    });

    return jsonOk({
      reference: submission.id.slice(-8).toUpperCase(),
      demo: store.backend !== "firestore",
      note: "Application received. An editor reads every pitch; you will hear back at the email you gave.",
    });
  });
}

export async function PATCH(request: Request) {
  return handleRoute(async () => {
    const viewer = await requireRole("admin");
    const parsed = contributorDecisionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError("Invalid decision payload.", 422);
    const { submissionId, decision, note } = parsed.data;

    const store = getStore();
    const submissions = await store.listSubmissions("all");
    const application = submissions.find((item) => item.id === submissionId);
    if (!application) return jsonError("Application not found.", 404);
    if (application.type !== "contributor_application") {
      return jsonError("That submission is not a contributor application.", 422);
    }

    const actor = { id: viewer.uid, email: viewer.email ?? undefined };

    if (decision === "reject") {
      await store.updateSubmission(submissionId, { status: "rejected", triageNote: note || "Not taken forward." }, actor);
      return jsonOk({ status: "rejected" });
    }

    const email = application.contactEmail?.trim().toLowerCase();
    if (!email) return jsonError("This application has no email address to create an account with.", 422);
    if (!isFirebaseAdminConfigured()) {
      return jsonError("Firebase Admin credentials are required to create contributor accounts.", 503);
    }
    const auth = adminAuth();
    if (!auth) return jsonError("Firebase Auth is unavailable.", 503);

    let uid: string;
    let created = false;
    try {
      const existing = await auth.getUserByEmail(email);
      uid = existing.uid;
    } catch {
      const user = await auth.createUser({
        email,
        displayName: application.submitterName ?? undefined,
        emailVerified: false,
      });
      uid = user.uid;
      created = true;
    }

    await auth.setCustomUserClaims(uid, { role: "contributor" });
    await store.setUserRole(uid, "contributor", actor);
    // Keep the profile fields the roster and the desk read from.
    const db = adminDb();
    if (db) {
      await db
        .collection(COLLECTIONS.users)
        .doc(uid)
        .set(
          {
            email: email,
            name: application.submitterName ?? "",
            status: "active",
          },
          { merge: true },
        );
    }
    await store.updateSubmission(
      submissionId,
      { status: "triaged", triageNote: note || "Approved as freelance contributor." },
      actor,
    );

    // Invite by email so the contributor sets their own password — no password
    // ever travels through the newsroom.
    let inviteSent = false;
    if (config.firebase.apiKey) {
      try {
        const res = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${config.firebase.apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requestType: "PASSWORD_RESET", email }),
          },
        );
        inviteSent = res.ok;
      } catch {
        inviteSent = false;
      }
    }

    return jsonOk({ status: "approved", uid, created, inviteSent, email });
  });
}
