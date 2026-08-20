import { useEffect, useState } from "react";
import { fetchAdminEvents, pinEvent, unpinEvent, type AdminEventRow } from "../../api/admin";
import { AdminLayout } from "./AdminLayout";

// ピン留め設定(wireframes/wireframe-admin.html A2)。
//
// ピン留めは全体で常に1件のみ。DBの部分ユニークインデックスで保証している。
// 残りの枠は spotlight_score 降順で自動選出される。
// この「1枠だけ手動」という制約が、特定メンバーによる注目枠の占有を
// 構造的に防ぐ設計。
export function AdminPinsPage() {
  return <AdminLayout title="注目イベントのピン留め">{() => <PinPicker />}</AdminLayout>;
}

function PinPicker() {
  const [events, setEvents] = useState<AdminEventRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // 誤操作でサイネージの表示が変わるため、確認を1枚挟む(ワイヤーフレーム A2)。
  // window.confirm を使わないのは、画面内で文脈を見せたまま確認したいため
  const [confirming, setConfirming] = useState<AdminEventRow | null>(null);

  function load() {
    fetchAdminEvents()
      .then(setEvents)
      .catch((e: unknown) => setError(toMessage(e)));
  }

  useEffect(() => {
    // 初回の読み込みだけ。以降は操作のたびに load() を呼ぶ
    load();
  }, []);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      load();
    } catch (e: unknown) {
      setError(toMessage(e));
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  }

  if (error !== null && events === null) {
    return <p className="text-red-700">{error}</p>;
  }
  if (events === null) {
    return <p className="text-gray-500">読み込み中…</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        ピン留めしたイベントはサイネージの先頭に固定されます。
        <strong>全体で1件だけ</strong>で、別のイベントを選ぶと現在のピンは自動で外れます。
        残りの枠は注目スコアの高い順に自動で選ばれます。
      </p>

      {error !== null && <p className="text-red-700">{error}</p>}

      {events.length === 0 ? (
        <p className="text-gray-500">開催前のイベントがありません。</p>
      ) : (
        <ul className="space-y-3">
          {events.map((event) => (
            <li
              key={event.id}
              className={`rounded border p-4 ${
                event.pinned ? "border-gray-900 bg-gray-50" : "border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  {event.pinned && (
                    <span className="text-sm font-bold text-gray-900">📌 ピン留め中</span>
                  )}
                  <div className="truncate font-bold">{event.title}</div>
                  <div className="mt-1 text-sm text-gray-500">
                    {formatDate(event.starts_at)} ・ {event.location} ・ 参加{" "}
                    {event.participants_count}名 ・ score {event.spotlight_score}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    event.pinned ? run(() => unpinEvent(event.id)) : setConfirming(event)
                  }
                  disabled={busy}
                  className="shrink-0 rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-40"
                >
                  {event.pinned ? "ピン留めを解除" : "ここにピン留め"}
                </button>
              </div>

              {confirming?.id === event.id && (
                <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm">
                  <p>
                    サイネージの表示が変わります。現在のピンは自動で外れます。よろしいですか？
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => run(() => pinEvent(event.id))}
                      disabled={busy}
                      className="rounded bg-gray-900 px-3 py-1 text-white disabled:opacity-40"
                    >
                      ピン留めする
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      className="rounded border border-gray-300 px-3 py-1"
                    >
                      やめる
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-gray-500">
        注目スコアはこの画面にだけ表示しています。数値が見えると、順位を上げるための操作を誘発するためです。
      </p>
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "操作に失敗しました";
}
