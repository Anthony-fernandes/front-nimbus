import type { PermissionBlock } from "@/lib/types";

import {
  createResource,
  deleteResource,
  getResource,
  listResource,
  updateResource,
} from "./crud";

const ENDPOINT = "/permission-blocks";

export function listPermissionBlocks(params?: Record<string, unknown>) {
  return listResource<PermissionBlock>(ENDPOINT, params);
}

export function getPermissionBlock(id: string) {
  return getResource<PermissionBlock>(ENDPOINT, id);
}

export function createPermissionBlock(payload: Partial<PermissionBlock>) {
  return createResource<PermissionBlock>(ENDPOINT, payload);
}

export function updatePermissionBlock(id: string, payload: Partial<PermissionBlock>) {
  return updateResource<PermissionBlock>(ENDPOINT, id, payload);
}

export function deletePermissionBlock(id: string) {
  return deleteResource(ENDPOINT, id);
}
