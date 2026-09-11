import { useEffect, useMemo, useState } from "react";
import { TagChip } from "../components/TagChip";
import { Link, useSearchParams } from "react-router-dom";
import { AnchorButton, Base, Cluster, Stack, StatusLabel, Text, TextLink } from "smarthr-ui";
import { LoginRequired } from "../components/LoginRequired";
import { SessionUnavailable } from "../components/SessionUnavailable";
import { MemberPage } from "../components/MemberPage";
import { PageHeading } from "../components/ui/PageHeading";
import { FilterButton, FilterRow } from "../components/ui/FilterRow";
import { TagFilter } from "../components/TagFilter";
import { TitleSearch } from "../components/TitleSearch";
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
  const session = useCurrentUser();
  const { user, loading, failed } = session;

  // 絞り込みは ?status= と ?tag_ids= で行い、URLで共有できる状態にする
  // （画面④の注記）。画面の中に状態を持たず、URLを唯一の状態にしている
  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get("status");
  const status: StatusFilter =
    statusParam === "recruiting" || statusParam === "in_progress" ? statusParam : "all";
  // useMemo で参照を安定させる。毎レンダリングで新しい配列を作ると、
  // useEffect の依存として使えない
  const selectedTagIds = useMemo(() => parseTagIds(searchParams.get("tag_ids")), [searchParams]);
  // 企画名の部分一致。絞り込むのはサーバー(?q=)で、ここは語を持つだけ
  const query = searchParams.get("q") ?? "";

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
      tagIds: selectedTagIds,
      q: query,
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
  }, [loading, user, status, selectedTagIds, query]);

  // 絞り込みは片方を変えても、もう片方を保つ
  function updateParams(
    next: { status?: StatusFilter; tagIds?: number[]; q?: string },
    replace = false,
  ) {
    const params = new URLSearchParams(searchParams);
    const nextStatus = next.status ?? status;
    const nextTagIds = next.tagIds ?? selectedTagIds;
    const nextQuery = next.q ?? query;

    if (nextStatus === "all") params.delete("status");
    else params.set("status", nextStatus);

    // 選択が0件のときは絞り込まない（＝全件）。URLからもキーごと消す
    if (nextTagIds.length === 0) params.delete("tag_ids");
    else params.set("tag_ids", nextTagIds.join(","));

    if (nextQuery.trim() === "") params.delete("q");
    else params.set("q", nextQuery);

    setSearchParams(params, { replace });
  }

  function setTagIds(next: number[]) {
    updateParams({ tagIds: next });
  }

  // 検索語だけは履歴を積まない。1語打つたびに戻る先が増えると、
  // 戻るボタンで一覧の前に戻れなくなる
  function setQuery(next: string) {
    updateParams({ q: next }, true);
  }

  if (loading) {
    return (
      <MemberPage session={session}>
        <p className="text-[13px] text-gray-500">読み込み中…</p>
      </MemberPage>
    );
  }

  // ログイン状態を確かめられなかったときは、未ログインの案内を出さない(Issue #72)
  if (failed) {
    return (
      <MemberPage session={session}>
        <PageHeading title="プロジェクト" />
        <SessionUnavailable />
      </MemberPage>
    );
  }

  // 未ログインは API 自体が 401 を返す。画面側でも案内を出す
  if (user === null) {
    return (
      <MemberPage session={session}>
        <PageHeading title="プロジェクト" />
        <LoginRequired>プロジェクトの閲覧にはログインが必要です。</LoginRequired>
      </MemberPage>
    );
  }

  return (
    <MemberPage session={session}>
      <Stack gap="M">
        <Cluster align="center" justify="space-between">
          <Stack gap="XXS">
            <PageHeading title="プロジェクト" />
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
          {/* 検索は状態やタグより先に置く。どちらも決められた語からしか
              選べないので、名前を覚えている企画を探す入口はこちらになる */}
          <FilterRow label="企画名">
            <TitleSearch value={query} onChange={setQuery} label="企画名で検索" />
          </FilterRow>

          <FilterRow label="状態">
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

          {/* 候補が増えても破綻しないよう、並べずに検索させる。
              ここでは新しいタグを作らせない(docs/spec-tags.md §3.6) */}
          {tags.length > 0 && (
            <FilterRow label="タグ">
              <TagFilter candidates={tags} selectedIds={selectedTagIds} onChange={setTagIds} />
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
              {status === "all" && selectedTagIds.length === 0 && query === ""
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

// "1,3" を [1, 3] にする。数字でないものは捨てる。
// URLを手で書き換えられても壊れないようにする
function parseTagIds(raw: string | null): number[] {
  if (raw === null) return [];

  return raw
    .split(",")
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n > 0);
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

        {/* 一覧から詳細へ行く導線はこの企画名だけ。自前の Link に
            font-bold だけを当てていたときは、本文と同じ色で下線も無く、
            ホバーするまでリンクだと分からなかった(Issue #186)。
            TextLink にしてトップページと同じ見た目に揃える */}
        <Text size="M" leading="NORMAL">
          <TextLink elementAs={Link} to={`/projects/${project.id}`} className="font-bold">
            {project.title}
          </TextLink>
        </Text>

        {project.tags.length > 0 && (
          <ul className="flex flex-wrap gap-1">
            {project.tags.map((tag) => (
              <li key={tag.id}>
                <TagChip name={tag.name} />
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
