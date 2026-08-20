import { apiFetch } from "./client";
import type { ProjectSummary } from "../types/project";

export async function fetchProjects(): Promise<ProjectSummary[]> {
  const data = await apiFetch<{ projects: ProjectSummary[] }>("/api/projects");
  return data.projects;
}
