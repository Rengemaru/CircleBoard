import { apiFetch } from "./client";
import type { ProjectSummary } from "../types/project";

// 絞り込みはクエリパラメータで行い、URLで共有できる状態にする
// (wireframes/wireframe-member.html 画面④)。
// 既定(引数なし)は「終了以外を 募集中 → 進行中 の順」でサーバーが返す
// 脱退は申請制。抜けるのは owner が承認してから
// (docs/api-spec.md「プロジェクトの脱退」)
export async function requestWithdrawal(projectId: number): Promise<void> {
  await apiFetch<void>(`/api/projects/${projectId}/withdrawal`, { method: "POST" });
}

export async function cancelWithdrawalRequest(projectId: number): Promise<void> {
  await apiFetch<void>(`/api/projects/${projectId}/withdrawal`, { method: "DELETE" });
}

export async function approveWithdrawal(projectId: number, id: number): Promise<void> {
  await apiFetch<void>(`/api/projects/${projectId}/withdrawals/${id}`, { method: "PUT" });
}

export async function rejectWithdrawal(projectId: number, id: number): Promise<void> {
  await apiFetch<void>(`/api/projects/${projectId}/withdrawals/${id}`, { method: "DELETE" });
}

export async function fetchProjects(
  // tagIds の複数指定は OR。空配列は「絞り込まない」。
  // q は企画名の部分一致。空文字は「絞り込まない」
  options: { status?: "recruiting" | "in_progress"; tagIds?: number[]; q?: string } = {},
): Promise<ProjectSummary[]> {
  const params = new URLSearchParams();
  if (options.status !== undefined) params.set("status", options.status);
  if (options.tagIds !== undefined && options.tagIds.length > 0) {
    params.set("tag_ids", options.tagIds.join(","));
  }

  if (options.q !== undefined && options.q.trim() !== "") params.set("q", options.q.trim());

  const query = params.toString();
  const data = await apiFetch<{ projects: ProjectSummary[] }>(
    query === "" ? "/api/projects" : `/api/projects?${query}`,
  );
  return data.projects;
}
