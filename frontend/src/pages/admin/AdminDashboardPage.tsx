import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Table, Td, Th } from "smarthr-ui";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ErrorNote } from "../../components/ui/ErrorNote";
import { Panel } from "../../components/ui/Panel";
import { fetchDashboard, type ActivityRow, type Dashboard } from "../../api/admin";
import { formatCountdownDays } from "../../lib/countdown";
import { AdminOnly } from "./AdminOnly";

// 管理者トップ(wireframes/wireframe-admin-ver2.html ①)。
//
// 「要確認」パネルは、停止中アカウントがあるときだけ出す。
// 常に「特になし」と書いてある枠は、見る習慣がつかないぶん有害。
export function AdminDashboardPage() {
  return (
    <AdminOnly title="ダッシュボード" subtitle="サークル全体の状況を確認する">
      {() => <DashboardBody />}
    </AdminOnly>
  );
}

function DashboardBody() {
  const [data, setData] = useState<Dashboard | null>(null);
  // エラーは文字列に潰さず、そのまま持つ。401 かどうかを
  // 表示側(ErrorNote)で判定するため(Issue #72)
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    fetchDashboard()
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((e: unknown) => setError(e));
  }, []);

  if (error !== null) {
    return <ErrorNote error={error} fallback="読み込みに失敗しました" />;
  }
  if (data === null) {
    return <p className="text-gray-500">読み込み中…</p>;
  }

  const { stats } = data;

  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="メンバー数"
          value={stats.member_count}
          sub={`うち卒業生 ${stats.graduate_count}名`}
        />
        <StatCard
          label="進行中プロジェクト"
          value={stats.active_project_count}
          sub={`募集中 ${stats.recruiting_project_count}件 含む`}
        />
        <StatCard
          label="今月のイベント"
          value={stats.events_this_month_count}
          // 日数の書式は countdown.ts に集約する。ここで自前に書くと
          // 他の画面と言い回しが割れる
          sub={
            stats.next_event === null
              ? "開催予定なし"
              : `次回：${stats.next_event.title}（${formatCountdownDays(stats.next_event.days_until)}）`
          }
        />
        <StatCard
          label="停止中アカウント"
          value={stats.suspended_count}
          sub={stats.suspended_count === 0 ? "なし" : "要確認"}
          alert={stats.suspended_count > 0}
        />
      </div>

      {/* 2列を等分にすると、左の表が 455px まで狭まって
          「Webアプリ開発 / チーム」のように列が折り返す。
          読むのは表の方なので 2:1 にする */}
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <ActivityPanel rows={data.recent_activity} />
        <div className="min-w-0">
          <QuickActions />
          {stats.suspended_count > 0 && <NeedsAttention count={stats.suspended_count} />}
        </div>
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  sub,
  alert = false,
}: {
  label: string;
  value: number;
  sub: string;
  // 0件のときまで赤くしない。常に赤い数字は見なくなる
  alert?: boolean;
}) {
  return (
    <div className="rounded border border-gray-200 bg-white p-5">
      <div className="mb-1 text-xs text-gray-500">{label}</div>
      <div className={`mb-1 text-[28px] leading-none font-bold ${alert ? "text-red-600" : ""}`}>
        {value}
      </div>
      <div className="text-[11px] text-gray-400">{sub}</div>
    </div>
  );
}

function NeedsAttention({ count }: { count: number }) {
  const navigate = useNavigate();

  return (
    <Panel title="要確認">
      <div className="flex items-center gap-2 text-[13px] text-gray-700">
        <span className="font-bold text-red-600">●</span>
        停止中アカウントあり（{count}件）
        <button
          type="button"
          onClick={() => navigate("/admin/users")}
          className="ml-auto text-xs text-gray-500 underline"
        >
          確認 →
        </button>
      </div>
    </Panel>
  );
}

function ActivityPanel({ rows }: { rows: ActivityRow[] }) {
  if (rows.length === 0) {
    return (
      <Panel title="最近の企画アクティビティ">
        <p className="text-[13px] text-gray-500">まだ企画がありません。</p>
      </Panel>
    );
  }

  return (
    <Panel title="最近の企画アクティビティ" className="min-w-0">
      {/* Table は既定で reel が有効で、溢れるときだけ表自身が横スクロールする */}
      <div>
        <Table>
          <thead>
            <tr>
              <Th>企画名</Th>
              <Th>種別</Th>
              <Th>状態</Th>
              <Th>投稿者</Th>
              {/* 「最近」が今日なのか半年前なのかが分からないと、
                  たまにしか開かない管理者には動きの有無を判断できない(Issue #71) */}
              <Th>投稿日</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.kind}-${row.id}`}>
                <Td className="font-medium">{row.title}</Td>
                <Td className="text-gray-500">
                  {row.kind === "event" ? "イベント" : "プロジェクト"}
                </Td>
                <Td>
                  <StatusBadge status={row.status} />
                </Td>
                {/* 投稿者が退会していると null になる。空欄ではなく理由を書く */}
                <Td className="text-gray-500">{row.owner_name ?? "（退会済み）"}</Td>
                <Td className="text-xs text-gray-500">{formatPostedAt(row.created_at)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </Panel>
  );
}

// イベントは recruiting / completed、プロジェクトは recruiting / in_progress /
// completed。文字列で受けて、知らない値はそのまま出す
// 企画一覧(/admin/posts)と同じ書式にする。同じ情報が画面ごとに違う形で
// 出ると、見比べたときに別物に見える
function formatPostedAt(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "recruiting":
      return <Badge tone="recruiting">募集中</Badge>;
    case "in_progress":
      return <Badge tone="inprogress">進行中</Badge>;
    case "completed":
      return <Badge tone="completed">終了</Badge>;
    default:
      return <Badge tone="completed">{status}</Badge>;
  }
}

// ワイヤーフレーム①のクイックアクション。
// FAQ・利用規約の編集(⑦)はまだ作っていないので出さない
function QuickActions() {
  const navigate = useNavigate();

  return (
    <Panel title="クイックアクション">
      <div className="flex flex-col gap-2">
        <Button
          variant="primary"
          className="text-left"
          onClick={() => navigate("/admin/users/new")}
        >
          👤 アカウントを発行する
        </Button>
        <Button className="text-left" onClick={() => navigate("/admin/pin")}>
          📌 ピン留めイベントを変更
        </Button>
        <Button className="text-left" onClick={() => navigate("/admin/signage")}>
          🖥 サイネージトークンを発行
        </Button>
      </div>
    </Panel>
  );
}
