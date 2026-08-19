import { useEffect, useState } from "react";
import { fetchEvents } from "../api/events";
import type { EventSummary } from "../types/event";

export function EventsPage() {
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEvents()
      .then(setEvents)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "読み込みに失敗しました"));
  }, []);

  if (error !== null) {
    return <p className="p-8 text-red-700">{error}</p>;
  }
  if (events === null) {
    return <p className="p-8 text-gray-500">読み込み中…</p>;
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-2xl font-bold">イベント</h1>

      {events.length === 0 ? (
        <p className="text-gray-500">開催予定のイベントはありません。</p>
      ) : (
        <ul className="space-y-4">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </ul>
      )}
    </main>
  );
}

function EventCard({ event }: { event: EventSummary }) {
  const startsAt = new Date(event.starts_at);

  return (
    <li className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-baseline gap-3 text-sm text-gray-500">
        <span className="font-medium text-gray-900">{formatDate(startsAt)}</span>
        <span>{event.location}</span>
      </div>

      <h2 className="mt-1 text-lg font-bold">{event.title}</h2>

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

// capacity が null のときは無制限(仕様書 §2.2)。「8 / null名」と出さない
function formatParticipants(event: EventSummary): string {
  if (event.capacity === null) return `${event.participants_count}名`;
  return `${event.participants_count} / ${event.capacity}名`;
}
