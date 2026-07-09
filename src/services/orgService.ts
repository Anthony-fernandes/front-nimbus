import type { Department, Position } from "@/lib/types";

import {
  createResource,
  deleteResource,
  listResource,
  updateResource,
} from "./crud";

const DEPARTMENTS = "/departments";
const POSITIONS = "/positions";

export function listDepartments() {
  return listResource<Department>(DEPARTMENTS);
}

export function createDepartment(data: Partial<Department>) {
  return createResource<Department>(DEPARTMENTS, data);
}

export function updateDepartment(id: string, data: Partial<Department>) {
  return updateResource<Department>(DEPARTMENTS, id, data);
}

export function deleteDepartment(id: string) {
  return deleteResource(DEPARTMENTS, id);
}

export function listPositions() {
  return listResource<Position>(POSITIONS);
}

export function createPosition(data: Partial<Position>) {
  return createResource<Position>(POSITIONS, data);
}

export function updatePosition(id: string, data: Partial<Position>) {
  return updateResource<Position>(POSITIONS, id, data);
}

export function deletePosition(id: string) {
  return deleteResource(POSITIONS, id);
}
