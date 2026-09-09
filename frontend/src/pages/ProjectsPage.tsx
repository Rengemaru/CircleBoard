import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AnchorButton,
  Base,
  Chip,
  Cluster,
  PageHeading,
  Stack,
  StatusLabel,
  Text,
} from "smarthr-ui";
import { LoginRequired } from "../components/LoginRequired";
import { MemberPage } from "../components/MemberPage";
import { FilterButton, FilterRow } from "../components/ui/FilterRow";
import { Note } from "../components/ui/Note";
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
  const [tagsError, setTagsError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || user === null) return;

    // 失敗を空配列に倒すと、通信できなかったのかタグが0件なのかを
    // 見分けられない。再試行の手がかりも消える(Issue #52)
    fetchTags()
      .then(setTags)
      .catch(() => setTagsError(true));
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
    return (
      <MemberPage user={null}>
        <p className="text-[13px] text-gray-500">読み込み中…</p>
      </MemberPage>
    );
  }

  // 未ログインは API 自体が 401 を返す。画面側でも案内を出す
  if (user === null) {
    return (
      <MemberPage user={null}>
        <PageHeading pageTitleSuffix="CircleBoard">プロジェクト</PageHeading>
        <LoginRequired>プロジェクトの閲覧にはログインが必要です。</LoginRequired>
      </MemberPage>
    );
  }

  return (
    <MemberPage user={user}>
      <Stack gap="M">
        <Cluster align="center" justify="space-between">
          <Stack gap="XXS">
            {/* PageHeading は autoPageTitle が既定 true で、suffix が
                'SmartHR（スマートHR）' 固定になっている。必ず差し替える */}
            <PageHeading pageTitleSuffix="CircleBoard">プロジェクト</PageHeading>
            <Text size="S" color="TEXT_GREY" leading="TIGHT">
              継続的に成果物を作る企画です。途中からでも参加できます
            </Text>
          </Stack>
          <AnchorButton elementAs={Link} to="/create?kind=project" variant="primary">
            プロジェクトを作成
          </AnchorButton>
        </Cluster>

        {/* リスト操作エリア（作成）は Base の外、一時操作エリア（絞り込み）は
            Base の中の上部。「よくあるリスト」パターン(smarthr-list.mdx) */}
        <Base overflow="hidden">
          <FilterRow label="STATUS">
            {(Object.keys(STATUS_LABEL) as StatusFilter[]).map((key) => (
              <FilterButton
                key={key}
                active={status === key}
                onClick={() => updateParams({ status: key })}
              >
                {STATUS_LABEL[key]}
              </FilterButton>
            ))}
          </FilterRow>

          {tagsError && (
            <div className="border-b border-gray-200 p-3">
              <Text size="S" color="TEXT_GREY">
                タグを読み込めませんでした。ページを再読み込みしてください。
              </Text>
            </div>
          )}

          {tags.length > 0 && (
            <FilterRow label="TAG">
              <FilterButton
                active={selectedTagId === null}
                onClick={() => updateParams({ tagId: null })}
              >
                すべて
              </FilterButton>
              {tags.map((tag) => (
                <FilterButton
                  key={tag.id}
                  active={selectedTagId === tag.id}
                  onClick={() => updateParams({ tagId: tag.id })}
                >
                  {tag.name}
                </FilterButton>
              ))}
            </FilterRow>
          )}

          {error !== null ? (
            <div className="p-4">
              <Note tone="danger">{error}</Note>
            </div>
          ) : projects === null ? (
            <EmptyRow>読み込み中…</EmptyRow>
          ) : projects.length === 0 ? (
            <EmptyRow>
              {/* 一覧は募集中と進行中の両方を出す。「募集中はありません」だと、
                  進行中があるのに隠れていると誤読される(Issue #53) */}
              {status === "all" && selectedTagId === null
                ? "参加できるプロジェクトはありません。"
                : "条件に合うプロジェクトはありません。条件を変えて試してください。"}
            </EmptyRow>
          ) : (
            <ul className="divide-y divide-gray-200">
              {projects.map((project) => (
                <ProjectRow key={project.id} project={project} />
              ))}
            </ul>
          )}
        </Base>
      </Stack>
    </MemberPage>
  );
}

function EmptyRow({ children }: { children: string }) {
  return (
    <div className="p-6">
      <Text size="S" color="TEXT_GREY">
        {children}
      </Text>
    </div>
  );
}

function ProjectRow({ project }: { project: ProjectSummary }) {
  return (
    <li className="p-4">
      <Stack gap="XXS">
        <Cluster align="center" gap="XS">
          {/* オブジェクトのライフサイクル上の状態は1つだけ StatusLabel にする */}
          <StatusLabel type={project.status === "recruiting" ? "blue" : "green"}>
            {project.status === "recruiting" ? "募集中" : "進行中"}
          </StatusLabel>
          <Text size="S" color="TEXT_GREY" leading="TIGHT">
            {project.meeting_schedule ?? project.activity_schedule ?? "日程未定"} ・{" "}
            {formatMembers(project)}
          </Text>
        </Cluster>

        <Text size="M" leading="NORMAL">
          <Link to={`/projects/${project.id}`} className="font-bold hover:underline">
            {project.title}
          </Link>
        </Text>

        {project.tags.length > 0 && (
          <ul className="flex flex-wrap gap-1">
            {project.tags.map((tag) => (
              <li key={tag.id}>
                <Chip size="S">{tag.name}</Chip>
              </li>
            ))}
          </ul>
        )}

        <Text size="S" color="TEXT_GREY" leading="TIGHT" maxLines={2}>
          {project.description}
        </Text>
      </Stack>
    </li>
  );
}

function formatMembers(project: ProjectSummary): string {
  if (project.capacity === null) return `${project.participants_count}名`;
  return `${project.participants_count} / ${project.capacity}名`;
}
