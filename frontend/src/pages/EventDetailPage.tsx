import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MemberPage } from "../components/MemberPage";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Chip } from "../components/ui/Chip";
import { Note } from "../components/ui/Note";
import { Panel } from "../components/ui/Panel";
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
      <MemberPage user={user}>
        <Note tone="danger">{error}</Note>
      </MemberPage>
    );
  }
  if (event === null) {
    return (
      <MemberPage user={user}>
        <p className="text-[13px] text-gray-500">読み込み中…</p>
      </MemberPage>
    );
  }

  const full = event.capacity !== null && event.participants_count >= event.capacity;

  return (
    <MemberPage user={user}>
      <Link to="/events" className="mb-3 inline-block text-xs text-gray-500 hover:text-gray-900">
        ← イベント一覧
      </Link>

      <Panel>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={event.status === "recruiting" ? "recruiting" : "completed"}>
            {event.status === "recruiting" ? "募集中" : "終了"}
          </Badge>
          {event.pinned && <Badge tone="pinned">📌 ピン留め</Badge>}
          {event.tags.map((tag) => (
            <Chip key={tag.id}>{tag.name}</Chip>
          ))}
        </div>

        <h1 className="mt-2.5 text-xl font-bold">{event.title}</h1>
        {/* 開催の近さがこの画面で一番効く情報なので、見出しの直下に大きく置く */}
        <p className="mt-1 text-lg font-bold text-gray-700">{formatCountdown(event.starts_at)}</p>

        <dl className="mt-4 space-y-2 border-t border-gray-200 pt-4 text-[13px]">
          <Row label="開催日時" value={formatDateTime(event.starts_at)} />
          <Row label="開催場所" value={event.location} />
          {/* 残り枠(ワイヤーフレーム ③ のサイド)。定員なしのときに
              「残り null枠」と出さない */}
          <Row label="残り枠" value={formatRemaining(event)} />
        </dl>

        {/* 外部リンクは任意。connpass や申し込みフォームへ飛ばす。
            外部サイトなので新しいタブで開く */}
        {event.external_url !== null && event.external_url !== "" && (
          <p className="mt-3 text-[13px]">
            <a
              href={event.external_url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-gray-700 underline hover:text-gray-900"
            >
              関連リンクを開く ↗
            </a>
          </p>
        )}
      </Panel>

      <Panel title="概要">
        <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{event.description}</p>
      </Panel>

      <Panel
        title={`参加者 ${event.participants_count}${
          event.capacity !== null ? ` / ${event.capacity}` : ""
        }名`}
      >
        {/* participants キーが無い＝未ログイン。サーバーが落としている */}
        {event.participants === undefined ? (
          <Note>参加者一覧はログインすると表示されます。</Note>
        ) : event.participants.length === 0 ? (
          <p className="text-[13px] text-gray-500">まだ参加者がいません。</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {event.participants.map((p) => (
              <li key={p.id}>
                <Chip>{p.name}</Chip>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* owner キーが無い＝未ログイン。実名がインターネットに公開されるのを避ける */}
      {event.owner !== undefined && event.owner !== null && (
        <Panel title="主催">
          <p className="text-[13px]">{event.owner.name}</p>
        </Panel>
      )}

      {error !== null && <Note tone="danger">{error}</Note>}

      <ParticipationButton
        loggedIn={user !== null}
        joined={event.current_user_joined === true}
        full={full}
        busy={busy}
        onJoin={join}
        onCancel={cancel}
      />
    </MemberPage>
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
      <Link to="/login">
        <Button variant="primary">ログインして参加</Button>
      </Link>
    );
  }

  if (joined) {
    return (
      <Button variant="ghost" onClick={onCancel} disabled={busy}>
        参加をキャンセル
      </Button>
    );
  }

  // 満員時はボタンを消す。ただしAPI側でも必ず定員を検証し422を返す。
  // ボタンの非表示は表示の話であって制限ではない(ワイヤーフレーム ③)
  if (full) {
    return <Note tone="warning">満員です。空きが出ると参加できるようになります。</Note>;
  }

  return (
    <Button variant="primary" onClick={onJoin} disabled={busy}>
      参加する
    </Button>
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
