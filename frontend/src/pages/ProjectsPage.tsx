import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import { fetchProjects } from "../api/projects";
import { fetchTags } from "../api/tags";
import { useCurrentUser } from "../hooks/useCurrentUser";
import type { Tag } from "../types/event";
import type { ProjectSummary } from "../types/project";

// プロジェクト一覧(wireframes/wireframe-member.html ④)。要ログイン。
//
// 進行中も一覧に表示する。途中参加できる設計のため。
// 並び順は 募集中 → 進行中。終了は非表示（サーバー側で絞っている）。
type StatusFilter = "all" | "recruiting" | "in_progress";

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: "すべて",
  recruiting: "募集中",
  in_progress: "進行中",
};

export function ProjectsPage() {
  const { user, loading } = useCurrentUser();

  // 絞り込みは ?status= と ?tag_id= で行い、URLで共有できる状態にする
  // （画面④の注記）。画面の中に状態を持たず、URLを唯一の状態にしている
  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get("status");
  const status: StatusFilter =
    statusParam === "recruiting" || statusParam === "in_progress" ? statusParam : "all";
  const tagIdParam = searchParams.get("tag_id");
  const selectedTagId = tagIdParam === null ? null : Number(tagIdParam);

  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || user === null) return;

    fetchTags()
      .then(setTags)
      .catch(() => setTags([]));
  }, [loading, user]);

  useEffect(() => {
    if (loading || user === null) return;

    // 絞り込みを変えるたびに読み直す。前の結果を消してから読むのではなく、
    // 届いた結果で置き換える。切り替えのたびに一瞬空になるのを避ける
    let cancelled = false;

    fetchProjects({
      status: status === "all" ? undefined : status,
      tagId: selectedTagId ?? undefined,
    })
      .then((result) => {
        if (cancelled) return;
        setProjects(result);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "読み込みに失敗しました");
      });

    // 素早く切り替えたとき、古い応答が後から届いて上書きするのを防ぐ
    return () => {
      cancelled = true;
    };
  }, [loading, user, status, selectedTagId]);

  // 絞り込みは片方を変えても、もう片方を保つ
  function updateParams(next: { status?: StatusFilter; tagId?: number | null }) {
    const params = new URLSearchParams(searchParams);
    const nextStatus = next.status ?? status;
    const nextTagId = next.tagId === undefined ? selectedTagId : next.tagId;

    if (nextStatus === "all") params.delete("status");
    else params.set("status", nextStatus);

    if (nextTagId === null) params.delete("tag_id");
    else params.set("tag_id", String(nextTagId));

    setSearchParams(params);
  }

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
          ＋ プロジェクトを作成
        </Link>
      </div>

      <FilterRow label="STATUS">
        {(Object.keys(STATUS_LABEL) as StatusFilter[]).map((key) => (
          <FilterChip
            key={key}
            active={status === key}
            onClick={() => updateParams({ status: key })}
          >
            {STATUS_LABEL[key]}
          </FilterChip>
        ))}
      </FilterRow>

      {tags.length > 0 && (
        <FilterRow label="TAG">
          <FilterChip active={selectedTagId === null} onClick={() => updateParams({ tagId: null })}>
            すべて
          </FilterChip>
          {tags.map((tag) => (
            <FilterChip
              key={tag.id}
              active={selectedTagId === tag.id}
              onClick={() => updateParams({ tagId: tag.id })}
            >
              {tag.name}
            </FilterChip>
          ))}
        </FilterRow>
      )}

      {error !== null ? (
        <p className="rounded border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>
      ) : projects === null ? (
        <p className="text-gray-500">読み込み中…</p>
      ) : projects.length === 0 ? (
        <p className="text-gray-500">
          {status === "all" && selectedTagId === null
            ? "いま募集中のプロジェクトはありません。"
            : "この条件のプロジェクトはありません。"}
        </p>
      ) : (
        <ul className="space-y-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </ul>
      )}
    </Frame>
  );
}

function ProjectCard({ project }: { project: ProjectSummary }) {
  return (
    <li className="rounded-lg border border-gray-200 p-4">
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
  );
}

// 画面④は STATUS と TAG の2行に分かれている。ラベルを付けて、
// どちらの条件を触っているのかを取り違えないようにする
function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span className="w-14 shrink-0 font-mono text-xs text-gray-400">{label}</span>
      {children}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border px-3 py-1 text-sm ${
        active ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300"
      }`}
    >
      {children}
    </button>
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

function formatMembers(project: ProjectSummary): string {
  if (project.capacity === null) return `${project.participants_count}名`;
  return `${project.participants_count} / ${project.capacity}名`;
}
