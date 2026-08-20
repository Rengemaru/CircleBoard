import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import { apiFetch } from "../api/client";
import { useCurrentUser } from "../hooks/useCurrentUser";
import type { ProjectSummary } from "../types/project";

// プロジェクト詳細(wireframes/wireframe-member.html ⑤)。要ログイン。
//
// 脱退APIは作らない(MVP対象外。rails console で対応。docs/api-spec.md §3)ので、
// 参加後に取り消すボタンも置かない。
export function ProjectDetailPage() {
  const { id } = useParams();
  const { user, loading } = useCurrentUser();
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiFetch<ProjectSummary>(`/api/projects/${id}`)
      .then(setProject)
      .catch((e: unknown) => setError(toMessage(e)));
  }, [id]);

  useEffect(() => {
    if (loading || user === null) return;
    load();
  }, [loading, user, load]);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch<unknown>(`/api/projects/${id}/participation`, { method: "POST" });
      load();
    } catch (e: unknown) {
      setError(toMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <Frame user={null}>読み込み中…</Frame>;
  }

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

  if (error !== null && project === null) {
    return <Frame user={user}><p className="text-red-700">{error}</p></Frame>;
  }
  if (project === null) {
    return <Frame user={user}>読み込み中…</Frame>;
  }

  const full = project.capacity !== null && project.participants_count >= project.capacity;

  return (
    <Frame user={user}>
      <div className="space-y-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-gray-100 px-2 py-0.5 text-sm">
              {project.status === "recruiting" ? "募集中" : "進行中"}
            </span>
            {project.tags.map((tag) => (
              <span key={tag.id} className="rounded bg-gray-100 px-2 py-0.5 text-sm">
                {tag.name}
              </span>
            ))}
          </div>
          <h1 className="mt-2 text-2xl font-bold">{project.title}</h1>
        </div>

        <dl className="space-y-2 text-sm">
          {project.activity_schedule !== null && (
            <Row label="活動日" value={project.activity_schedule} />
          )}
          {project.meeting_schedule !== null && (
            <Row label="MTG" value={project.meeting_schedule} />
          )}
        </dl>

        <section>
          <h2 className="mb-2 font-bold">概要</h2>
          <p className="whitespace-pre-wrap text-sm">{project.description}</p>
        </section>

        <section>
          <h2 className="mb-2 font-bold">
            メンバー {project.participants_count}
            {project.capacity !== null && ` / ${project.capacity}`}名
          </h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {(project.participants ?? []).map((p) => (
              <li key={p.id} className="rounded bg-gray-100 px-2 py-0.5">
                {p.name}
              </li>
            ))}
          </ul>
        </section>

        {project.owner !== undefined && project.owner !== null && (
          <section>
            <h2 className="mb-1 font-bold">主催</h2>
            <p className="text-sm">{project.owner.name}</p>
          </section>
        )}

        {error !== null && <p className="text-red-700">{error}</p>}

        {project.current_user_joined === true ? (
          <p className="text-sm text-gray-600">参加しています</p>
        ) : full ? (
          <p className="text-sm text-gray-600">定員に達しています</p>
        ) : (
          <button
            type="button"
            onClick={join}
            disabled={busy}
            className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-40"
          >
            参加を申請する
          </button>
        )}
      </div>
    </Frame>
  );
}

function Frame({
  user,
  children,
}: {
  user: Parameters<typeof SiteHeader>[0]["user"];
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl p-6">{children}</main>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <dt className="w-24 shrink-0 text-gray-500">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "読み込みに失敗しました";
}
