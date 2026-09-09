import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { INPUT_CLASS } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { ErrorNote } from "../../components/ui/ErrorNote";
import { Note } from "../../components/ui/Note";
import {
  deleteUser,
  fetchAdminUsers,
  suspendUser,
  unsuspendUser,
  type AdminUserRow,
} from "../../api/admin";
import { AdminLayout } from "./AdminLayout";

// ユーザー管理(wireframes/wireframe-admin-ver2.html ②)。
//
// ワイヤーフレームにある「学科」列は作っていない。users に department が無く、
// 追加には spec-v2.2.md §2 の変更が要る。
export function AdminUsersPage() {
  const navigate = useNavigate();

  return (
    <AdminLayout
      title="ユーザー管理"
      subtitle="アカウントの発行・停止・削除を行う"
      action={
        <Button variant="primary" size="sm" onClick={() => navigate("/admin/users/new")}>
          ＋ アカウントを発行
        </Button>
      }
    >
      {(currentUser) => <UserList currentUserId={currentUser.id} />}
    </AdminLayout>
  );
}

type Filter = "all" | "active" | "grad" | "suspended" | "admin";

const FILTER_LABEL: Record<Filter, string> = {
  all: "全て",
  active: "現役メンバー",
  grad: "卒業生",
  suspended: "停止中",
  admin: "管理者",
};

function UserList({ currentUserId }: { currentUserId: number }) {
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [keyword, setKeyword] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [deleting, setDeleting] = useState<AdminUserRow | null>(null);
  // 停止も相手のセッションを即座に切るので、削除と同じく確認を挟む
  const [suspending, setSuspending] = useState<AdminUserRow | null>(null);
  // エラーは文字列に潰さず、そのまま持つ。401 かどうかを
  // 表示側(ErrorNote)で判定するため(Issue #72)
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  function load() {
    fetchAdminUsers()
      .then((rows) => {
        setUsers(rows);
        setError(null);
      })
      .catch((e: unknown) => setError(e));
  }

  useEffect(() => {
    // 初回の読み込みだけ。以降は操作のたびに load() を呼ぶ
    load();
  }, []);

  // 成功しても load() するだけだと、表の下の方を操作したときに
  // 押せたのか無視されたのかが分からず二度押しを誘発する。
  // 何が起きたかを message で受け取って出す(Issue #43)
  async function run(action: () => Promise<void>, message: string) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await action();
      setSuccess(message);
      setDeleting(null);
      setSuspending(null);
      load();
    } catch (e: unknown) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  if (error !== null && users === null) {
    return <ErrorNote error={error} fallback="読み込みに失敗しました" />;
  }
  if (users === null) {
    return <p className="text-gray-500">読み込み中…</p>;
  }

  // 絞り込みはサーバーに投げず画面側で行う。部員は多くても数十人で、
  // 1文字打つたびに往復させる意味がない(api/admin.ts の fetchAdminUsers 参照)
  const visible = users.filter(
    (user) => matchesKeyword(user, keyword) && matchesFilter(user, filter),
  );

  return (
    <>
      {/* placeholder は入力を始めると消えるので、その欄が何なのかの手がかりが
          無くなる。select には名前が一切無く「コンボボックス」としか
          読み上げられなかった(Issue #58) */}
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          aria-label="名前・メールアドレスで検索"
          placeholder="名前・メールアドレスで検索"
          className={`${INPUT_CLASS} min-w-[200px] flex-1`}
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          aria-label="状態で絞り込む"
          className={`${INPUT_CLASS} w-[160px] flex-none`}
        >
          {(Object.keys(FILTER_LABEL) as Filter[]).map((key) => (
            <option key={key} value={key}>
              {FILTER_LABEL[key]}
            </option>
          ))}
        </select>
      </div>

      {error !== null && <ErrorNote error={error} fallback="読み込みに失敗しました" />}
      {success !== null && <Note tone="success">{success}</Note>}

      <div className="mb-5 rounded border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3.5">
          <h2 className="text-sm font-bold">
            メンバー一覧
            {/* 絞り込み後の件数だけだと、全体が何件なのか分からず、
                何を隠しているのかが把握できない(Issue #63) */}
            <span className="ml-2 text-xs font-normal text-gray-500">
              {formatCount(visible.length, users.length)}
            </span>
          </h2>
          {/* 卒業年度の新しい順(api/admin/users_controller.rb:20)。
              書かないと、五十音順でない一覧が「順不同」に見える */}
          <span className="text-xs text-gray-500">卒業年度が新しい順</span>
        </div>

        {/* 列が多い表は横に溢れる。ページ全体を横スクロールさせない */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <Th>名前</Th>
                <Th>メールアドレス</Th>
                <Th>入学 / 卒業</Th>
                {/* 権限と状態は別の軸。1列にまとめて排他で出すと、
                    停止中の管理者から「管理者」が消える(Issue #64) */}
                <Th>権限</Th>
                <Th>状態</Th>
                <Th>操作</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  isSelf={user.id === currentUserId}
                  onDelete={() => setDeleting(user)}
                  onSuspend={() => setSuspending(user)}
                  onUnsuspend={() =>
                    run(() => unsuspendUser(user.id), `${user.name} の停止を解除しました`)
                  }
                  busy={busy}
                />
              ))}
            </tbody>
          </table>
        </div>

        {visible.length === 0 && (
          <p className="px-4 py-6 text-[13px] text-gray-500">該当するメンバーがいません。</p>
        )}
      </div>

      {/* 破壊的操作の意味は確認モーダルに書く。押す直前に必ず目に入る場所でないと
          読まれない(SmartHR feedback.mdx「直前に操作した要素の近く」)。
          ここに残すのは、操作の前提として知っておく話だけ(Issue #61) */}
      <Note>
        パスワードの再発行と権限の変更は、この画面からはできません。
        <code className="mx-1 rounded bg-gray-100 px-1">rails console</code>
        で対応します(CLAUDE.md §10)。
      </Note>

      {/* ⚠️ は取り消せない操作にだけ付ける。停止や企画の削除は元に戻せるので付けない。
          可逆・不可逆の両方に付けると、記号として何も伝えなくなる(Issue #41) */}
      {deleting !== null && (
        <Modal
          title="⚠️ このアカウントを完全に削除しますか？"
          confirmLabel="完全に削除する"
          busy={busy}
          onCancel={() => setDeleting(null)}
          onConfirm={() =>
            run(() => deleteUser(deleting.id), `${deleting.name} のアカウントを削除しました`)
          }
        >
          <p>
            <strong>{deleting.name}</strong>（{deleting.email}）のアカウントを削除します。
            <br />
            <strong>取り消せません。</strong>
            企画一覧の「削除」とは違い、この画面から戻すことはできません。
            <br />
            過去の参加履歴は名前が空欄のまま残ります。
          </p>
        </Modal>
      )}

      {suspending !== null && (
        <Modal
          title="アカウントを停止しますか？"
          confirmLabel="停止する"
          busy={busy}
          onCancel={() => setSuspending(null)}
          onConfirm={() =>
            run(() => suspendUser(suspending.id), `${suspending.name} を停止しました`)
          }
        >
          <p>
            <strong>{suspending.name}</strong>（{suspending.email}）を停止します。
            <br />
            ログインできなくなり、<strong>いま開いている画面もその場で無効になります。</strong>
            企画と参加記録は消えません。あとから解除できます。
          </p>
        </Modal>
      )}
    </>
  );
}

function UserRow({
  user,
  isSelf,
  onDelete,
  onSuspend,
  onUnsuspend,
  busy,
}: {
  user: AdminUserRow;
  isSelf: boolean;
  onDelete: () => void;
  onSuspend: () => void;
  onUnsuspend: () => void;
  busy: boolean;
}) {
  return (
    // 卒業生は背景で示す。opacity を下げると文字が読めなくなる(Issue #68)。
    // 状態列のバッジでも分かるので、色だけに頼っていない
    <tr className={user.suspended ? "bg-red-50" : user.graduated ? "bg-gray-100" : ""}>
      <Td>
        <span className={isSelf ? "font-bold" : ""}>{user.name}</span>
        {isSelf && <span className="ml-2 text-[11px] text-gray-500">（自分）</span>}
      </Td>
      <Td className="text-xs text-gray-500">{user.email}</Td>
      <Td className="text-gray-500">
        {user.enrollment_year} / {user.graduation_year}
      </Td>
      <Td>
        {/* 権限。停止中でも卒業生でも、その人が管理者であることは変わらない */}
        {user.role === "admin" ? (
          <Badge tone="admin">管理者</Badge>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </Td>
      <Td>
        {/* 状態。停止は解除できるので卒業より前に見せる */}
        {user.suspended ? (
          <Badge tone="suspended">停止中</Badge>
        ) : user.graduated ? (
          <Badge tone="grad">卒業生</Badge>
        ) : (
          <Badge tone="active">現役</Badge>
        )}
      </Td>
      <Td>
        {/* 自分自身は停止も削除もできない。APIも 422 で拒否する。
            自分を停止すると、その場でセッションが切れて解除もできなくなる */}
        {isSelf ? (
          <span className="text-gray-400">—</span>
        ) : (
          <span className="flex gap-1.5">
            {user.suspended ? (
              <Button variant="success" size="xs" onClick={onUnsuspend} disabled={busy}>
                停止解除
              </Button>
            ) : (
              <Button variant="danger" size="xs" onClick={onSuspend} disabled={busy}>
                停止
              </Button>
            )}
            <Button variant="danger" size="xs" onClick={onDelete} disabled={busy}>
              完全に削除
            </Button>
          </span>
        )}
      </Td>
    </tr>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="border-b border-gray-200 bg-gray-50 px-4 py-2.5 text-left text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
      {children}
    </th>
  );
}

function Td({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <td className={`border-b border-gray-100 px-4 py-3 align-middle text-[13px] ${className}`}>
      {children}
    </td>
  );
}

function matchesKeyword(user: AdminUserRow, keyword: string): boolean {
  const q = keyword.trim().toLowerCase();
  if (q === "") return true;

  return user.name.toLowerCase().includes(q) || user.email.toLowerCase().includes(q);
}

function matchesFilter(user: AdminUserRow, filter: Filter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "admin":
      return user.role === "admin";
    case "grad":
      return user.graduated;
    case "suspended":
      return user.suspended;
    case "active":
      return !user.graduated && !user.suspended;
  }
}

// 絞り込んでいるときだけ「N件 / 全M件」にする。
// 絞り込んでいないのに「4件 / 全4件」と出すのは冗長
function formatCount(visible: number, total: number): string {
  return visible === total ? `${total}件` : `${visible}件 / 全${total}件`;
}
