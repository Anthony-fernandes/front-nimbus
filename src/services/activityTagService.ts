import type { Activity, ActivityTag } from "@/lib/types";

import {
  createResource,
  deleteResource,
  listResource,
  updateResource,
} from "./crud";

const ENDPOINT = "/activity-tags";

export type ActivityTagBadge = {
  id: string;
  name: string;
  color?: string;
  active: boolean;
  isLegacy?: boolean;
};

export type ActivityTagFormState = {
  tagIds: string[];
  legacyTagNames: string[];
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function dedupe(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function coerceUsageCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeActivityTag(tag: ActivityTag & Record<string, unknown>): ActivityTag {
  return {
    ...tag,
    description: typeof tag.description === "string" ? tag.description : "",
    active: tag.active !== false,
    createdAt:
      typeof tag.createdAt === "string"
        ? tag.createdAt
        : typeof tag.created_at === "string"
          ? tag.created_at
          : new Date().toISOString(),
    updatedAt:
      typeof tag.updatedAt === "string"
        ? tag.updatedAt
        : typeof tag.updated_at === "string"
          ? tag.updated_at
          : undefined,
    usage_count: coerceUsageCount(tag.usage_count),
  };
}

function buildTagPayload(payload: Partial<ActivityTag>) {
  return {
    name: payload.name?.trim() || "",
    color: payload.color || "",
    description: payload.description || "",
    active: payload.active ?? true,
  };
}

export async function listActivityTags() {
  const rows = await listResource<ActivityTag & Record<string, unknown>>(ENDPOINT);
  return rows
    .map((tag) => normalizeActivityTag(tag))
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

export async function saveActivityTag(
  payload: Partial<ActivityTag>,
  mode: "create" | "edit",
  tagId?: string,
) {
  const normalizedPayload = buildTagPayload(payload);
  const saved =
    mode === "edit" && tagId
      ? await updateResource<ActivityTag & Record<string, unknown>>(ENDPOINT, tagId, normalizedPayload)
      : await createResource<ActivityTag & Record<string, unknown>>(ENDPOINT, normalizedPayload);

  return normalizeActivityTag(saved);
}

export async function deleteActivityTag(tagId: string) {
  await deleteResource(ENDPOINT, tagId);
}

export function getActivityTagUsageCount(tag: Pick<ActivityTag, "usage_count"> | null | undefined) {
  return coerceUsageCount(tag?.usage_count);
}

export function getActivityTagFormState(
  activity: Pick<Activity, "tags"> | null | undefined,
  configuredTags: ActivityTag[] = [],
): ActivityTagFormState {
  const configuredByName = new Map(
    configuredTags.map((tag) => [normalizeText(tag.name), tag]),
  );
  const tagIds: string[] = [];
  const legacyTagNames: string[] = [];

  (activity?.tags || []).forEach((tagName) => {
    const matchedTag = configuredByName.get(normalizeText(tagName));

    if (matchedTag) {
      tagIds.push(matchedTag.id);
      return;
    }

    legacyTagNames.push(tagName);
  });

  return {
    tagIds: dedupe(tagIds),
    legacyTagNames: dedupe(legacyTagNames),
  };
}

export function resolveActivityTagNames(
  tagIds: string[],
  configuredTags: ActivityTag[],
  legacyTagNames: string[] = [],
) {
  const tagMap = new Map(configuredTags.map((tag) => [tag.id, tag.name]));
  return dedupe([
    ...tagIds.map((tagId) => tagMap.get(tagId) || "").filter(Boolean),
    ...legacyTagNames,
  ]);
}

export function resolveActivityTagBadges(
  activity: Pick<Activity, "tags"> | null | undefined,
  configuredTags: ActivityTag[] = [],
): ActivityTagBadge[] {
  const configuredByName = new Map(
    configuredTags.map((tag) => [normalizeText(tag.name), tag]),
  );
  const badges: ActivityTagBadge[] = [];

  (activity?.tags || []).forEach((tagName) => {
    const matchedTag = configuredByName.get(normalizeText(tagName));

    if (matchedTag) {
      badges.push({
        id: matchedTag.id,
        name: matchedTag.name,
        color: matchedTag.color,
        active: matchedTag.active,
      });
      return;
    }

    badges.push({
      id: `legacy:${normalizeText(tagName)}`,
      name: tagName,
      active: false,
      isLegacy: true,
    });
  });

  return badges;
}
