import { apiFetch } from "./client";
import type { ProjectSummary } from "../types/project";

// 絞り込みはクエリパラメータで行い、URLで共有できる状態にする
// (wireframes/wireframe-member.html 画面④)。
// 既定(引数なし)は「終了以外を 募集中 → 進行中 の順」でサーバーが返す
export async function fetchProjects(
  // tagIds の複数指定は OR。空配列は「絞り込まない」
  options: { status?: "recruiting" | "in_progress"; tagIds?: number[] } = {},
): Promise<ProjectSummary[]> {
  const params = new URLSearchParams();
  if (options.status !== undefined) params.set("status", options.status);
  if (options.tagIds !== undefined && options.tagIds.length > 0) {
    params.set("tag_ids", options.tagIds.join(","));
  }

  const query = params.toString();
  const data = await apiFetch<{ projects: ProjectSummary[] }>(
    query === "" ? "/api/projects" : `/api/projects?${query}`,
  );
  return data.projects;
}
