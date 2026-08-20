import { useEffect, useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Note } from "../../components/ui/Note";
import { Panel } from "../../components/ui/Panel";
import { fetchAdminEvents, pinEvent, unpinEvent, type AdminEventRow } from "../../api/admin";
import { AdminLayout } from "./AdminLayout";

// 注目イベント ピン留め設定(wireframes/wireframe-admin-ver2.html ⑥)。
//
// ピン留めは全体で常に1件のみ。DBの部分ユニークインデックスで保証している。
// 残りの枠は spotlight_score 降順で自動選出される。
// この「1枠だけ手動」という制約が、特定メンバーによる注目枠の占有を
// 構造的に防ぐ設計。
export function AdminPinsPage() {
  return (
    <AdminLayout
      title="注目イベント ピン留め設定"
      subtitle="トップページの注目イベント枠のうち1枠を手動で固定する"
    >
      {() => <PinPicker />}
    </AdminLayout>
  );
}

function PinPicker() {
  const [events, setEvents] = useState<AdminEventRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // ラジオで選んでから「ピン留めを保存」で確定する(ワイヤーフレーム⑥)。
  // 押した瞬間にサイネージの表示が変わると、誤操作を取り消せない
  const [selectedId, setSelectedId] = useState<number | null>(null);

  function load() {
    fetchAdminEvents()
      .then((rows) => {
        setEvents(rows);
        setSelectedId(rows.find((e) => e.pinned)?.id ?? null);
        setError(null);
      })
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
    }
  }

  if (error !== null && events === null) {
    return <Note tone="danger">{error}</Note>;
  }
  if (events === null) {
    return <p className="text-gray-500">読み込み中…</p>;
  }

  const pinned = events.find((e) => e.pinned) ?? null;
  const changed = selectedId !== (pinned?.id ?? null);

  return (
    <>
      <Note>
        注目イベント4枠のうち3枠はスコアで自動選出されます。残り1枠を手動でピン留めできます。
        ピン留めしない場合は4枠すべて自動選出されます。
      </Note>

      {error !== null && <Note tone="danger">{error}</Note>}

      <Panel
        title="現在のピン留め"
        action={
          pinned !== null && (
            <Button
              variant="danger"
              size="xs"
              disabled={busy}
              onClick={() => run(() => unpinEvent(pinned.id))}
            >
              ピン留めを解除
            </Button>
          )
        }
      >
        {pinned === null ? (
          <p className="text-[13px] text-gray-500">
            ピン留めなし。注目枠は4枠すべてスコア順で自動選出されます。
          </p>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-[13px] font-semibold">
                {pinned.title}
                <Badge tone="pinned">📌 ピン留め中</Badge>
              </div>
              <div className="text-[11px] text-gray-500">
                開催：{formatDate(pinned.starts_at)} ・ 参加：{pinned.participants_count}名
              </div>
            </div>
          </div>
        )}
      </Panel>

      <Panel title="ピン留めするイベントを選ぶ">
        <Note>
          スコアが高い順に表示しています（スコア = 開催間近ボーナス × 15 + 直近3日の参加増加数 × 10）
        </Note>

        {events.length === 0 ? (
          <p className="text-[13px] text-gray-500">開催前のイベントがありません。</p>
        ) : (
          <>
            <div className="mb-4">
              {events.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  selected={selectedId === event.id}
                  onSelect={() => setSelectedId(event.id)}
                />
              ))}
            </div>

            {changed && (
              <Note tone="warning">
                サイネージとトップページの表示が変わります。現在のピンは自動で外れます。
              </Note>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                disabled={!changed || busy}
                onClick={() => setSelectedId(pinned?.id ?? null)}
              >
                キャンセル
              </Button>
              <Button
                variant="primary"
                disabled={!changed || busy || selectedId === null}
                onClick={() => selectedId !== null && run(() => pinEvent(selectedId))}
              >
                ピン留めを保存
              </Button>
            </div>
          </>
        )}
      </Panel>

      <p className="text-xs text-gray-500">
        注目スコアはこの画面にだけ表示しています。数値が見えると、順位を上げるための操作を誘発するためです。
      </p>
    </>
  );
}

function EventRow({
  event,
  selected,
  onSelect,
}: {
  event: AdminEventRow;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    // 行のどこを押しても選べる。16pxの丸だけが的だと押しにくい
    <label className="flex cursor-pointer items-center gap-3 border-b border-gray-100 py-2.5 last:border-b-0">
      <input
        type="radio"
        name="pinned-event"
        checked={selected}
        onChange={onSelect}
        className="h-4 w-4 shrink-0 accent-gray-900"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold">{event.title}</span>
        <span className="block text-[11px] text-gray-500">
          開催：{formatDate(event.starts_at)} ・ {event.location} ・ 参加{" "}
          {event.participants_count}名
        </span>
      </span>
      <span className="shrink-0 text-xs text-gray-500">
        スコア <strong className="text-gray-900">{event.spotlight_score}</strong>
      </span>
    </label>
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
