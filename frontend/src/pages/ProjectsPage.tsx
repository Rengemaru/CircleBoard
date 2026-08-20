import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import { fetchProjects } from "../api/projects";
import { useCurrentUser } from "../hooks/useCurrentUser";
import type { ProjectSummary } from "../types/project";

// プロジェクト一覧(wireframes/wireframe-member.html ④)。要ログイン。
//
// 進行中も一覧に表示する。途中参加できる設計のため。
// 並び順は 募集中 → 進行中。終了は非表示（サーバー側で絞っている）。
export function ProjectsPage() {
  const { user, loading } = useCurrentUser();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || user === null) return;

    fetchProjects()
      .then(setProjects)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "読み込みに失敗しました"));
  }, [loading, user]);

  if (loading) {
    return <Frame user={null}>読み込み中…</Frame>;
  }

  // 未ログインは API 自体が 401 を返す。画面側でも案内を出す
  if (user === null) {
    return (
      <Frame user={null}>
        <p className="rounded border border-gray-200 bg-gray-50 p-4">
          プロジェクトの閲覧にはログインが必要です。
          <Link to="/login" className="ml-2 underline">
            ログイン
          </Link>
        </p>
      </Frame>
    );
  }

  return (
    <Frame user={user}>
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">プロジェクト</h1>
        <Link to="/create" className="text-sm underline">
          ＋ 企画を作成
        </Link>
      </div>

      {error !== null && <p className="text-red-700">{error}</p>}

      {projects === null ? (
        <p className="text-gray-500">読み込み中…</p>
      ) : projects.length === 0 ? (
        <p className="text-gray-500">いま募集中のプロジェクトはありません。</p>
      ) : (
        <ul className="space-y-4">
          {projects.map((project) => (
            <li key={project.id} className="rounded-lg border border-gray-200 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-gray-100 px-2 py-0.5 text-sm">
                  {project.status === "recruiting" ? "募集中" : "進行中"}
                </span>
                {project.tags.map((tag) => (
                  <span key={tag.id} className="rounded bg-gray-100 px-2 py-0.5 text-xs">
                    {tag.name}
                  </span>
                ))}
              </div>
              <h2 className="mt-2 text-lg font-bold">
                <Link to={`/projects/${project.id}`} className="hover:underline">
                  {project.title}
                </Link>
              </h2>
              <p className="mt-1 line-clamp-2 text-sm text-gray-700">{project.description}</p>
              <div className="mt-2 text-sm text-gray-500">
                {project.meeting_schedule ?? project.activity_schedule ?? "日程未定"} ・{" "}
                {formatMembers(project)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Frame>
  );
}

function Frame({ user, children }: { user: Parameters<typeof SiteHeader>[0]["user"]; children: React.ReactNode }) {
  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl p-6">{children}</main>
    </>
  );
}

function formatMembers(project: ProjectSummary): string {
  if (project.capacity === null) return `${project.participants_count}名`;
  return `${project.participants_count} / ${project.capacity}名`;
}
