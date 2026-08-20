import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Note } from "../../components/ui/Note";
import { Panel } from "../../components/ui/Panel";
import { fetchDashboard, type ActivityRow, type Dashboard } from "../../api/admin";
import { AdminLayout } from "./AdminLayout";

// 管理者トップ(wireframes/wireframe-admin-ver2.html ①)。
//
// ワイヤーフレームの4枚目「停止中アカウント」と「要確認」パネルは作っていない。
// users に suspended_at が無く、追加には spec-v2.2.md §2 の変更が要るため
// (docs/instructions.md T7-4)。数字の出ない空箱は置かない。
export function AdminDashboardPage() {
  return (
    <AdminLayout title="ダッシュボード" subtitle="サークル全体の状況を確認する">
      {() => <DashboardBody />}
    </AdminLayout>
  );
}

function DashboardBody() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard()
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "読み込みに失敗しました"),
      );
  }, []);

  if (error !== null) {
    return <Note tone="danger">{error}</Note>;
  }
  if (data === null) {
    return <p className="text-gray-500">読み込み中…</p>;
  }

  const { stats } = data;

  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
          sub={
            stats.next_event === null
              ? "開催予定なし"
              : `次回：${stats.next_event.title}（${formatDaysUntil(stats.next_event.days_until)}）`
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ActivityPanel rows={data.recent_activity} />
        <QuickActions />
      </div>
    </>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-5">
      <div className="mb-1 text-xs text-gray-500">{label}</div>
      <div className="mb-1 text-[28px] leading-none font-bold">{value}</div>
      <div className="text-[11px] text-gray-400">{sub}</div>
    </div>
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
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <Th>企画名</Th>
              <Th>種別</Th>
              <Th>状態</Th>
              <Th>投稿者</Th>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// イベントは recruiting / completed、プロジェクトは recruiting / in_progress /
// completed。文字列で受けて、知らない値はそのまま出す
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
        <Button variant="primary" className="text-left" onClick={() => navigate("/admin/users/new")}>
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

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="border-b border-gray-200 bg-gray-50 px-3 py-2.5 text-left text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
      {children}
    </th>
  );
}

function Td({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <td className={`border-b border-gray-100 px-3 py-3 align-middle text-[13px] ${className}`}>
      {children}
    </td>
  );
}

function formatDaysUntil(days: number): string {
  if (days > 0) return `残${days}日`;
  return "本日";
}
