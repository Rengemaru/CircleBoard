import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AnchorButton,
  Base,
  Button,
  Chip,
  Cluster,
  PageHeading,
  Stack,
  StatusLabel,
  Text,
} from "smarthr-ui";
import { MemberPage } from "../components/MemberPage";
import { Note } from "../components/ui/Note";
import { fetchEvents } from "../api/events";
import { fetchTags } from "../api/tags";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { formatCountdown } from "../lib/countdown";
import type { EventSummary, Tag } from "../types/event";

// イベント一覧(wireframes/wireframe-member.html 画面②)。ゲスト可。
//
// 既定は募集中のみ・開催日の近い順。終了イベントは表示しない
// （「過去の企画」セクションは MVP 対象外。CLAUDE.md §10）。
//
// 画面の構成は smarthr-ui の「よくあるリスト」パターンに合わせている
// (docs/instructions.md Phase 8):
//   - リスト操作エリア（作成ボタン）は Base の外・見出しの右
//   - 一時操作エリア（タグの絞り込み）は Base の中の上部
//   - オブジェクト名は Text size="M"、付随情報は size="S" color="TEXT_GREY"
export function EventsPage() {
  const { user } = useCurrentUser();
  // 絞り込みは ?tag_id= で行い、URLで共有できる状態にする（画面②の注記）。
  // 画面の中に状態を持たず、URLを唯一の状態にしている
  const [searchParams, setSearchParams] = useSearchParams();
  const tagIdParam = searchParams.get("tag_id");
  const selectedTagId = tagIdParam === null ? null : Number(tagIdParam);

  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagsError, setTagsError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 失敗を空配列に倒すと、通信できなかったのかタグが0件なのかを
    // 見分けられない。再試行の手がかりも消える(Issue #52)
    fetchTags()
      .then(setTags)
      .catch(() => setTagsError(true));
  }, []);

  useEffect(() => {
    // タグを切り替えるたびに読み直す。前の結果を消してから読むのではなく、
    // 届いた結果で置き換える。切り替えのたびに一瞬空になるのを避ける
    let cancelled = false;

    fetchEvents(selectedTagId === null ? {} : { tagId: selectedTagId })
      .then((result) => {
        if (cancelled) return;
        setEvents(result);
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
  }, [selectedTagId]);

  function selectTag(tagId: number | null) {
    setSearchParams(tagId === null ? {} : { tag_id: String(tagId) });
  }

  return (
    <MemberPage user={user}>
      <Stack gap="M">
        <Cluster align="center" justify="space-between">
          <Stack gap="XXS">
            {/* PageHeading は autoPageTitle が既定 true で、suffix が
                'SmartHR（スマートHR）' 固定になっている。そのままだと
                タブのタイトルに他社の社名が入るので、必ず差し替える */}
            <PageHeading pageTitleSuffix="CircleBoard">イベント</PageHeading>
            <Text size="S" color="TEXT_GREY" leading="TIGHT">
              単発の企画です。閲覧はログインなしでもできます
            </Text>
          </Stack>
          {/* 作成ボタンは未ログインでも表示してよい。押下時は /login へ。
              ボタンを隠すと、外部から見たときにサークルの活動量が伝わらない
              （画面②の注記）。API側は必ず401を返す */}
          <AnchorButton elementAs={Link} to="/create?kind=event" variant="primary">
            イベントを作成
          </AnchorButton>
        </Cluster>

        <Base overflow="hidden">
          {tagsError && (
            <div className="border-b border-gray-200 p-3">
              <Text size="S" color="TEXT_GREY">
                タグを読み込めませんでした。ページを再読み込みしてください。
              </Text>
            </div>
          )}

          {tags.length > 0 && (
            <Cluster gap="XS" className="border-b border-gray-200 p-3">
              <TagFilter active={selectedTagId === null} onClick={() => selectTag(null)}>
                すべて
              </TagFilter>
              {tags.map((tag) => (
                <TagFilter
                  key={tag.id}
                  active={selectedTagId === tag.id}
                  onClick={() => selectTag(tag.id)}
                >
                  {tag.name}
                </TagFilter>
              ))}
            </Cluster>
          )}

          {error !== null ? (
            <div className="p-4">
              <Note tone="danger">{error}</Note>
            </div>
          ) : events === null ? (
            <EmptyRow>読み込み中…</EmptyRow>
          ) : events.length === 0 ? (
            <EmptyRow>
              {/* 絞り込みの結果0件のときは、やり直せることを伝える(Issue #53) */}
              {selectedTagId === null
                ? "開催予定のイベントはありません。"
                : "このタグのイベントはありません。別のタグを試してください。"}
            </EmptyRow>
          ) : (
            <ul className="divide-y divide-gray-200">
              {events.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </ul>
          )}
        </Base>
      </Stack>
    </MemberPage>
  );
}

// 絞り込みは「リストのデータを変えない一時的な操作」なので一時操作エリアに置く。
// 選択中かどうかを variant の差で示す
function TagFilter({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <Button size="S" variant={active ? "primary" : "secondary"} onClick={onClick}>
      {children}
    </Button>
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

function EventRow({ event }: { event: EventSummary }) {
  return (
    <li className="p-4">
      <Stack gap="XXS">
        <Cluster align="center" gap="XS">
          {/* 開催の近さが一覧で一番効く情報なので先頭に置く(ワイヤーフレーム②)。
              日数はインスタンスごとに変わる値なので StatusLabel にはしない
              （StatusLabel ガイド「インスタンスごとに異なる値を埋め込まない」） */}
          <Text size="S" weight="bold" leading="TIGHT">
            {formatCountdown(event.starts_at)}
          </Text>
          <Text size="S" color="TEXT_GREY" leading="TIGHT">
            {formatDate(new Date(event.starts_at))} ・ {event.location}
          </Text>
          {event.pinned && <Chip size="S">📌 ピン留め</Chip>}
        </Cluster>

        <Text size="M" leading="NORMAL">
          <Link to={`/events/${event.id}`} className="font-bold hover:underline">
            {event.title}
          </Link>
        </Text>

        {event.tags.length > 0 && (
          <ul className="flex flex-wrap gap-1">
            {event.tags.map((tag) => (
              <li key={tag.id}>
                <Chip size="S">{tag.name}</Chip>
              </li>
            ))}
          </ul>
        )}

        <Text size="S" color="TEXT_GREY" leading="TIGHT" maxLines={2}>
          {event.description}
        </Text>

        <Cluster align="center" gap="XS">
          {/* オブジェクトのライフサイクル上の状態は1つだけ StatusLabel にする */}
          <StatusLabel type={event.status === "recruiting" ? "blue" : "grey"}>
            {event.status === "recruiting" ? "募集中" : "終了"}
          </StatusLabel>
          <Text size="S" color="TEXT_GREY" leading="TIGHT">
            {formatParticipants(event)}
          </Text>
        </Cluster>
      </Stack>
    </li>
  );
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// capacity が null のときは無制限(spec-v2.2.md §2.2)。「8 / null名」と出さない
function formatParticipants(event: EventSummary): string {
  if (event.capacity === null) return `${event.participants_count}名`;
  return `${event.participants_count} / ${event.capacity}名`;
}
