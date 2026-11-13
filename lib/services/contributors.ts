import "server-only";
import { getStore } from "@/lib/store";
import type { ContributorProfile, EditorialUser } from "@/lib/types";
import { slugify } from "@/lib/utils";

/**
 * Public contributor directory.
 *
 * A contributor only appears on the site once an editor has published at least
 * one of their stories — the roster is a record of published work, not a list of
 * people who have an account. Editors see everyone in /admin/contributors.
 */

const MAX_LATEST = 6;

function displaySlug(user: EditorialUser): string {
  if (user.slug) return user.slug;
  const base = slugify(user.name || user.email.split("@")[0] || "contributor") || "contributor";
  return `${base}-${user.id.slice(-4).toLowerCase()}`;
}

async function buildProfile(user: EditorialUser): Promise<ContributorProfile> {
  const store = getStore();
  const published = await store.listArticles({
    status: "published",
    authorId: user.id,
    limit: 24,
    sort: "latest",
  });
  return {
    id: user.id,
    slug: displaySlug(user),
    name: user.name || user.email,
    beats: user.beats ?? "",
    bio: user.bio ?? "",
    location: user.location ?? "",
    avatarUrl: user.avatarUrl ?? null,
    publishedCount: published.total || published.items.length,
    joinedAt: user.approvedAt ?? user.createdAt,
    latest: published.items.slice(0, MAX_LATEST),
  };
}

/** Everyone with a public profile, newest contributor first. */
export async function listContributorProfiles(options?: {
  includeWithoutPublished?: boolean;
}): Promise<ContributorProfile[]> {
  const store = getStore();
  const users = await store.listUsers();
  const contributors = users.filter((user) => user.role === "contributor" && user.status !== "suspended");
  const profiles = await Promise.all(contributors.map(buildProfile));
  const visible = options?.includeWithoutPublished
    ? profiles
    : profiles.filter((profile) => profile.publishedCount > 0);
  return visible.sort((a, b) => {
    if (b.publishedCount !== a.publishedCount) return b.publishedCount - a.publishedCount;
    return Date.parse(b.joinedAt ?? "0") - Date.parse(a.joinedAt ?? "0");
  });
}

export async function getContributorProfileBySlug(slug: string): Promise<ContributorProfile | null> {
  const store = getStore();
  const user = await store.getContributorBySlug(slug);
  if (!user) return null;
  const profile = await buildProfile(user);
  // A profile with nothing published is not public yet.
  return profile.publishedCount > 0 ? profile : null;
}

/** The profile slug for an author id, or null when the author is not a contributor. */
export async function contributorSlugFor(authorId: string): Promise<string | null> {
  const store = getStore();
  const users = await store.listUsers();
  const user = users.find((row) => row.id === authorId);
  if (!user || user.role !== "contributor") return null;
  return displaySlug(user);
}

export function contributorSlugForUser(user: EditorialUser): string {
  return displaySlug(user);
}
