import { apiFetch } from "./client";
import type { ProjectSummary } from "../types/project";

// 絞り込みはクエリパラメータで行い、URLで共有できる状態にする
// (wireframes/wireframe-member.html 画面④)。
// 既定(引数なし)は「終了以外を 募集中 → 進行中 の順」でサーバーが返す
export async function fetchProjects(
  options: { status?: "recruiting" | "in_progress"; tagId?: number } = {},
): Promise<ProjectSummary[]> {
  const params = new URLSearchParams();
  if (options.status !== undefined) params.set("status", options.status);
  if (options.tagId !== undefined) params.set("tag_id", String(options.tagId));

  const query = params.toString();
  const data = await apiFetch<{ projects: ProjectSummary[] }>(
    query === "" ? "/api/projects" : `/api/projects?${query}`,
  );
  return data.projects;
}
