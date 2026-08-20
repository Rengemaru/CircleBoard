import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { INPUT_CLASS } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    fetchAdminUsers()
      .then((rows) => {
        setUsers(rows);
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
      setDeleting(null);
      setSuspending(null);
      load();
    } catch (e: unknown) {
      setError(toMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (error !== null && users === null) {
    return <Note tone="danger">{error}</Note>;
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
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="名前・メールアドレスで検索"
          className={`${INPUT_CLASS} min-w-[200px] flex-1`}
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className={`${INPUT_CLASS} w-[160px] flex-none`}
        >
          {(Object.keys(FILTER_LABEL) as Filter[]).map((key) => (
            <option key={key} value={key}>
              {FILTER_LABEL[key]}
            </option>
          ))}
        </select>
      </div>

      {error !== null && <Note tone="danger">{error}</Note>}

      <div className="mb-5 rounded border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3.5">
          <h2 className="text-sm font-bold">
            メンバー一覧
            <span className="ml-2 text-xs font-normal text-gray-500">{visible.length}件</span>
          </h2>
        </div>

        {/* 列が多い表は横に溢れる。ページ全体を横スクロールさせない */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <Th>名前</Th>
                <Th>メールアドレス</Th>
                <Th>入学 / 卒業</Th>
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
                  onUnsuspend={() => run(() => unsuspendUser(user.id))}
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

      <Note>
        <strong>「停止」は表示上のラベルではありません。</strong>
        ログインできなくなるだけでなく、すでにログイン中の画面もその場で無効になります。
        企画と参加記録は残るので、あとから解除すれば元どおり使えます。
      </Note>

      <Note tone="warning">
        「削除」はメンバーの物理削除です。取り消せません。ただし、その人が作った企画と
        過去の参加記録は消えず、名前の部分が空欄になって残ります。
      </Note>

      <Note>
        パスワードの再発行と権限の変更は、この画面からはできません。
        <code className="mx-1 rounded-sm bg-gray-100 px-1">rails console</code>
        で対応します(CLAUDE.md §10)。
      </Note>

      {deleting !== null && (
        <Modal
          title="⚠️ メンバーを削除しますか？"
          confirmLabel="削除する"
          busy={busy}
          onCancel={() => setDeleting(null)}
          onConfirm={() => run(() => deleteUser(deleting.id))}
        >
          <p>
            <strong>{deleting.name}</strong>（{deleting.email}）を削除します。
            <br />
            この操作は取り消せません。過去の参加履歴は名前が空欄のまま残ります。
          </p>
        </Modal>
      )}

      {suspending !== null && (
        <Modal
          title="⚠️ アカウントを停止しますか？"
          confirmLabel="停止する"
          busy={busy}
          onCancel={() => setSuspending(null)}
          onConfirm={() => run(() => suspendUser(suspending.id))}
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
    <tr
      className={
        user.suspended ? "bg-red-50" : user.graduated ? "opacity-65" : ""
      }
    >
      <Td>
        <span className={isSelf ? "font-bold" : ""}>{user.name}</span>
        {isSelf && <span className="ml-2 text-[11px] text-gray-500">（自分）</span>}
      </Td>
      <Td className="text-xs text-gray-500">{user.email}</Td>
      <Td className="text-gray-500">
        {user.enrollment_year} / {user.graduation_year}
      </Td>
      <Td>
        {user.suspended ? (
          <Badge tone="suspended">停止中</Badge>
        ) : user.role === "admin" ? (
          <Badge tone="admin">管理者</Badge>
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
              削除
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

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "読み込みに失敗しました";
}
