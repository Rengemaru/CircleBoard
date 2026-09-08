import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MemberPage } from "../components/MemberPage";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Chip, FilterChip } from "../components/ui/Chip";
import { Note } from "../components/ui/Note";
import { PageHeading } from "../components/ui/PageHeading";
import { fetchEvents } from "../api/events";
import { fetchTags } from "../api/tags";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { formatCountdown } from "../lib/countdown";
import type { EventSummary, Tag } from "../types/event";

// イベント一覧(wireframes/wireframe-member.html 画面②)。ゲスト可。
//
// 既定は募集中のみ・開催日の近い順。終了イベントは表示しない
// （「過去の企画」セクションは MVP 対象外。CLAUDE.md §10）。
export function EventsPage() {
  const { user } = useCurrentUser();
  // 絞り込みは ?tag_id= で行い、URLで共有できる状態にする（画面②の注記）。
  // 画面の中に状態を持たず、URLを唯一の状態にしている
  const [searchParams, setSearchParams] = useSearchParams();
  const tagIdParam = searchParams.get("tag_id");
  const selectedTagId = tagIdParam === null ? null : Number(tagIdParam);

  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTags()
      .then(setTags)
      .catch(() => setTags([]));
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
      <PageHeading
        title="イベント"
        subtitle="単発の企画です。閲覧はログインなしでもできます"
        action={
          /* 作成ボタンは未ログインでも表示してよい。押下時は /login へ。
             ボタンを隠すと、外部から見たときにサークルの活動量が伝わらない
             （画面②の注記）。API側は必ず401を返す */
          <Link to="/create">
            <Button variant="primary" size="sm">
              ＋ イベントを作成
            </Button>
          </Link>
        }
      />

      {tags.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          <FilterChip active={selectedTagId === null} onClick={() => selectTag(null)}>
            すべて
          </FilterChip>
          {tags.map((tag) => (
            <FilterChip
              key={tag.id}
              active={selectedTagId === tag.id}
              onClick={() => selectTag(tag.id)}
            >
              {tag.name}
            </FilterChip>
          ))}
        </div>
      )}

      {error !== null ? (
        <Note tone="danger">{error}</Note>
      ) : events === null ? (
        <p className="text-[13px] text-gray-500">読み込み中…</p>
      ) : events.length === 0 ? (
        <p className="text-[13px] text-gray-500">
          {selectedTagId === null
            ? "開催予定のイベントはありません。"
            : "このタグのイベントはありません。"}
        </p>
      ) : (
        <ul className="space-y-4">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </ul>
      )}
    </MemberPage>
  );
}

function EventCard({ event }: { event: EventSummary }) {
  const startsAt = new Date(event.starts_at);

  return (
    <li className="rounded border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
        {/* 開催の近さが一覧で一番効く情報なので先頭に置く(ワイヤーフレーム②) */}
        <span className="text-sm font-bold text-gray-900">{formatCountdown(event.starts_at)}</span>
        <span>{formatDate(startsAt)}</span>
        <span>{event.location}</span>
        {event.pinned && <Badge tone="pinned">📌 ピン留め</Badge>}
      </div>

      <h2 className="mt-1.5 text-sm font-bold">
        <Link to={`/events/${event.id}`} className="hover:underline">
          {event.title}
        </Link>
      </h2>

      {event.tags.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {event.tags.map((tag) => (
            <li key={tag.id}>
              <Chip>{tag.name}</Chip>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2.5 line-clamp-2 text-[13px] text-gray-700">{event.description}</p>

      <div className="mt-3 flex items-center gap-2.5 text-xs text-gray-500">
        <Badge tone={event.status === "recruiting" ? "recruiting" : "completed"}>
          {event.status === "recruiting" ? "募集中" : "終了"}
        </Badge>
        <span>{formatParticipants(event)}</span>
      </div>
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
