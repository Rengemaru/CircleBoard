import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import { apiFetch } from "../api/client";
import { useCurrentUser } from "../hooks/useCurrentUser";
import type { EventDetail } from "../types/event";

// イベント詳細(wireframes/wireframe-member.html ③)。ゲスト可だが表示内容が変わる。
//
// owner と participants は**サーバーがキーごと落とす**。CSSで隠すのは不可
// (CLAUDE.md §3-2)。ここでは「キーが無い＝見せてよい情報ではない」として扱う。
export function EventDetailPage() {
  const { id } = useParams();
  const { user } = useCurrentUser();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiFetch<EventDetail>(`/api/events/${id}`)
      .then(setEvent)
      .catch((e: unknown) => setError(toMessage(e)));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch<unknown>(`/api/events/${id}/participation`, { method: "POST" });
      load();
    } catch (e: unknown) {
      setError(toMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch<void>(`/api/events/${id}/participation`, { method: "DELETE" });
      load();
    } catch (e: unknown) {
      setError(toMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (error !== null && event === null) {
    return (
      <>
        <SiteHeader user={user} />
        <main className="mx-auto max-w-3xl p-6">
          <p className="text-red-700">{error}</p>
        </main>
      </>
    );
  }
  if (event === null) {
    return (
      <>
        <SiteHeader user={user} />
        <main className="mx-auto max-w-3xl p-6 text-gray-500">読み込み中…</main>
      </>
    );
  }

  const full = event.capacity !== null && event.participants_count >= event.capacity;

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl space-y-6 p-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-gray-100 px-2 py-0.5 text-sm">
              {event.status === "recruiting" ? "募集中" : "終了"}
            </span>
            {event.tags.map((tag) => (
              <span key={tag.id} className="rounded bg-gray-100 px-2 py-0.5 text-sm">
                {tag.name}
              </span>
            ))}
          </div>
          <h1 className="mt-2 text-2xl font-bold">{event.title}</h1>
          <p className="mt-1 text-gray-600">{formatCountdown(event.starts_at)}</p>
        </div>

        <dl className="space-y-2 text-sm">
          <Row label="開催日時" value={formatDateTime(event.starts_at)} />
          <Row label="開催場所" value={event.location} />
          {/* 残り枠(ワイヤーフレーム ③ のサイド)。定員なしのときに
              「残り null枠」と出さない */}
          <Row label="残り枠" value={formatRemaining(event)} />
        </dl>

        {/* 外部リンクは任意。connpass や申し込みフォームへ飛ばす。
            外部サイトなので新しいタブで開く */}
        {event.external_url !== null && event.external_url !== "" && (
          <p className="text-sm">
            <a
              href={event.external_url}
              target="_blank"
              rel="noreferrer noopener"
              className="underline"
            >
              関連リンクを開く ↗
            </a>
          </p>
        )}

        <section>
          <h2 className="mb-2 font-bold">概要</h2>
          <p className="whitespace-pre-wrap text-sm">{event.description}</p>
        </section>

        <section>
          <h2 className="mb-2 font-bold">
            参加者 {event.participants_count}
            {event.capacity !== null && ` / ${event.capacity}`}名
          </h2>
          {/* participants キーが無い＝未ログイン。サーバーが落としている */}
          {event.participants === undefined ? (
            <p className="rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
              参加者一覧はログインすると表示されます
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2 text-sm">
              {event.participants.map((p) => (
                <li key={p.id} className="rounded bg-gray-100 px-2 py-0.5">
                  {p.name}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* owner キーが無い＝未ログイン。実名がインターネットに公開されるのを避ける */}
        {event.owner !== undefined && event.owner !== null && (
          <section>
            <h2 className="mb-1 font-bold">主催</h2>
            <p className="text-sm">{event.owner.name}</p>
          </section>
        )}

        {error !== null && <p className="text-red-700">{error}</p>}

        <ParticipationButton
          loggedIn={user !== null}
          joined={event.current_user_joined === true}
          full={full}
          busy={busy}
          onJoin={join}
          onCancel={cancel}
        />
      </main>
    </>
  );
}

function ParticipationButton({
  loggedIn,
  joined,
  full,
  busy,
  onJoin,
  onCancel,
}: {
  loggedIn: boolean;
  joined: boolean;
  full: boolean;
  busy: boolean;
  onJoin: () => void;
  onCancel: () => void;
}) {
  // 未ログイン時のラベルは「ログインして参加」→ /login へ(ワイヤーフレーム ③)
  if (!loggedIn) {
    return (
      <Link to="/login" className="inline-block rounded bg-gray-900 px-4 py-2 text-white">
        ログインして参加
      </Link>
    );
  }

  if (joined) {
    return (
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="rounded border border-gray-300 px-4 py-2 disabled:opacity-40"
      >
        参加をキャンセル
      </button>
    );
  }

  // 満員時はボタンを消す。ただしAPI側でも必ず定員を検証し422を返す。
  // ボタンの非表示は表示の話であって制限ではない(ワイヤーフレーム ③)
  if (full) {
    return <p className="text-sm text-gray-600">満員です</p>;
  }

  return (
    <button
      type="button"
      onClick={onJoin}
      disabled={busy}
      className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-40"
    >
      参加する
    </button>
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

// 開催までの日数。時刻を無視して日付だけで引くのは、サーバー側の計算
// (spec-v2.2.md §3.4)と揃えるため
function formatCountdown(startsAt: string): string {
  const start = new Date(startsAt);
  const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((startDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (days > 0) return `あと${days}日`;
  if (days === 0) return "本日開催";
  return "開催済み";
}

// 定員が null のときは無制限(spec-v2.2.md §2.2)。
// 満員を超えて参加できることは無いが、キャンセル前提の数え方にしないため
// 負の数は 0 に丸める
function formatRemaining(event: EventDetail): string {
  if (event.capacity === null) return "制限なし";
  return `${Math.max(0, event.capacity - event.participants_count)}名`;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "読み込みに失敗しました";
}
