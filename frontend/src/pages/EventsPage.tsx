import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import { fetchEvents } from "../api/events";
import { fetchTags } from "../api/tags";
import { useCurrentUser } from "../hooks/useCurrentUser";
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
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl p-6">
        <div className="mb-4 flex items-baseline justify-between">
          <h1 className="text-2xl font-bold">イベント</h1>
          {/* 作成ボタンは未ログインでも表示してよい。押下時は /login へ。
              ボタンを隠すと、外部から見たときにサークルの活動量が伝わらない
              （画面②の注記）。API側は必ず401を返す */}
          <Link to="/create" className="text-sm underline">
            ＋ イベントを作成
          </Link>
        </div>

        {tags.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
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
          <p className="rounded border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>
        ) : events === null ? (
          <p className="text-gray-500">読み込み中…</p>
        ) : events.length === 0 ? (
          <p className="text-gray-500">
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
      </main>
    </>
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

function EventCard({ event }: { event: EventSummary }) {
  const startsAt = new Date(event.starts_at);

  return (
    <li className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-baseline gap-3 text-sm text-gray-500">
        <span className="font-medium text-gray-900">{formatDate(startsAt)}</span>
        <span>{event.location}</span>
        {event.pinned && <span className="text-gray-900">📌 ピン留め</span>}
      </div>

      <h2 className="mt-1 text-lg font-bold">
        <Link to={`/events/${event.id}`} className="hover:underline">
          {event.title}
        </Link>
      </h2>

      {event.tags.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {event.tags.map((tag) => (
            <li key={tag.id} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
              {tag.name}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 line-clamp-2 text-sm text-gray-700">{event.description}</p>

      <div className="mt-3 flex items-center gap-3 text-sm text-gray-600">
        <span>{formatParticipants(event)}</span>
        <span>{event.status === "recruiting" ? "募集中" : "終了"}</span>
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
