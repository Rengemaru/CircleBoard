import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Cluster,
  SearchInput,
  Select,
  Stack,
  Table,
  Td,
  Text,
  Th,
  useEnvironment,
} from "smarthr-ui";
import { Badge } from "../../components/ui/Badge";
import { Chip } from "../../components/ui/Chip";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { ErrorNote } from "../../components/ui/ErrorNote";
import { Note } from "../../components/ui/Note";
import { UserLink } from "../../components/UserLink";
import {
  deleteUser,
  fetchAdminUsers,
  suspendUser,
  unsuspendUser,
  updateUser,
  type AdminUserRow,
  type UpdateUserInput,
} from "../../api/admin";
import { AdminOnly } from "./AdminOnly";
import { AdminUserEditDialog } from "./AdminUserEditDialog";

// ユーザー管理(wireframes/wireframe-admin-ver2.html ②)。
//
// 学科の列はワイヤーフレーム ② のとおり出す。users.department は
// マイページ(M-2)で追加済み。
//
// **編集できるのは権限と学年だけ。** 学科と氏名は本人が /me/edit で書くもので、
// 管理者用にもう1本の編集経路を作る理由がない(docs/spec-admin-operations.md §3.3)。
export function AdminUsersPage() {
  const navigate = useNavigate();

  return (
    <AdminOnly
      title="ユーザー管理"
      subtitle="アカウントの発行・編集・停止・削除を行う"
      action={
        <Button variant="primary" size="sm" onClick={() => navigate("/admin/users/new")}>
          ＋ アカウントを発行
        </Button>
      }
      // 6列の表。DEFAULT だと横スクロールが常態化する
      size="WIDE"
    >
      {(currentUser) => <UserList currentUserId={currentUser.id} />}
    </AdminOnly>
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

// Select は options を配列で受け取る。ラベルの定義は他でも使うので
// Record のまま持ち、ここで並びに直す
const FILTER_OPTIONS = (Object.keys(FILTER_LABEL) as Filter[]).map((key) => ({
  label: FILTER_LABEL[key],
  value: key,
}));

function UserList({ currentUserId }: { currentUserId: number }) {
  // 表と縦積みの切り替え。境界は smarthr-ui の SCREEN_SMALL(width <= 751px)
  const { mobile } = useEnvironment();
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [keyword, setKeyword] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [deleting, setDeleting] = useState<AdminUserRow | null>(null);
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
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
      setEditing(null);
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
      {/* 絞り込みは名前を持たせる。select は名前が無いと
          「コンボボックス」としか読み上げられない(Issue #58) */}
      <Cluster gap="XS" className="mb-4">
        {/* SearchInput の className は中の input には届くが、外側の幅は
            決まらない。伸ばす役目は包む div に持たせる */}
        <div className="min-w-[200px] flex-1">
          <SearchInput
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            aria-label="名前・メールアドレスで検索"
            tooltipMessage="名前・メールアドレスで検索"
            width="100%"
          />
        </div>
        <Select
          value={filter}
          options={FILTER_OPTIONS}
          onChangeValue={setFilter}
          aria-label="状態で絞り込む"
          width="160px"
        />
      </Cluster>

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

        {/* モバイルでは表をやめて縦に積む。SmartHR の Table は
            「モバイルでは、画面幅を越えたテーブルは2次元スクロールを招くため、
            垂直方向に積みあげることを推奨します」としている。
            実際 375px では、7列が潰れて「山田/太郎」「（自/分）」のように
            文字単位で折り返していた。
            境界は smarthr-ui の SCREEN_SMALL(width <= 751px)に合わせる。
            CSS で2つ書くと DOM が二重になるので、描き分けは React で行う */}
        {mobile ? (
          <ul className="divide-y divide-gray-200">
            {visible.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                isSelf={user.id === currentUserId}
                onDelete={() => setDeleting(user)}
                onEdit={() => setEditing(user)}
                onSuspend={() => setSuspending(user)}
                onUnsuspend={() =>
                  run(() => unsuspendUser(user.id), `${user.name} の停止を解除しました`)
                }
                busy={busy}
              />
            ))}
          </ul>
        ) : (
          <div>
            <Table>
              <thead>
                <tr>
                  <Th>名前</Th>
                  <Th>メールアドレス</Th>
                  <Th>学科</Th>
                  <Th>学年</Th>
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
                    onEdit={() => setEditing(user)}
                    onSuspend={() => setSuspending(user)}
                    onUnsuspend={() =>
                      run(() => unsuspendUser(user.id), `${user.name} の停止を解除しました`)
                    }
                    busy={busy}
                  />
                ))}
              </tbody>
            </Table>
          </div>
        )}

        {visible.length === 0 && (
          <p className="px-4 py-6 text-[13px] text-gray-500">該当するメンバーがいません。</p>
        )}
      </div>

      {/* 破壊的操作の意味は確認モーダルに書く。押す直前に必ず目に入る場所でないと
          読まれない(SmartHR feedback.mdx「直前に操作した要素の近く」)。
          ここに残すのは、操作の前提として知っておく話だけ(Issue #61) */}
      <Note>
        パスワードの再発行は、この画面からはできません。
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

      {editing !== null && (
        <AdminUserEditDialog
          user={editing}
          isSelf={editing.id === currentUserId}
          busy={busy}
          error={error}
          onCancel={() => setEditing(null)}
          onSave={(input: UpdateUserInput) =>
            run(() => updateUser(editing.id, input), `${editing.name} を更新しました`)
          }
        />
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

// モバイル1件分。SmartHR の「よくあるリスト」の並びに合わせる。
// 識別子（名前）→ 属性（状態・権限・メール・年度）→ 操作 の順。
//
// 操作はアイコンボタン1つではなく、文言のままのボタンを2つ置く。
// リストの指針はアイコンボタン1つを勧めているが、停止と完全削除は
// 取り違えると取り返しが付かない。何が起きるかを文字で読めることを優先した。
function UserCard({
  user,
  isSelf,
  onDelete,
  onEdit,
  onSuspend,
  onUnsuspend,
  busy,
}: {
  user: AdminUserRow;
  isSelf: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onSuspend: () => void;
  onUnsuspend: () => void;
  busy: boolean;
}) {
  return (
    // 表の行と同じ背景で状態を示す。色だけに頼らずバッジも出す(Issue #68)
    <li className={`py-3 ${user.suspended ? "bg-red-50" : user.graduated ? "bg-gray-100" : ""}`}>
      <Stack gap={0.5}>
        <Cluster align="center" gap={0.5}>
          <span className={isSelf ? "font-bold" : ""}>
            <UserLink id={user.id} name={user.name} />
          </span>
          {isSelf && <span className="text-[11px] text-gray-500">（自分）</span>}
          {user.suspended ? (
            <Badge tone="suspended">停止中</Badge>
          ) : user.graduated ? (
            <Badge tone="grad">卒業生</Badge>
          ) : (
            <Badge tone="active">現役</Badge>
          )}
          {user.role === "admin" && <Chip>管理者</Chip>}
        </Cluster>

        <Text size="S" color="TEXT_GREY" leading="TIGHT" as="p">
          {user.email}
        </Text>
        <Text size="S" color="TEXT_GREY" leading="TIGHT" as="p">
          {user.department ?? "学科未入力"} ・ {user.grade ?? "学年なし"}
        </Text>

        <Cluster gap={0.5}>
          {/* 自分自身も編集できる。権限だけはサーバーが弾くので、
              ダイアログ側で選べないようにしてある */}
          <Button variant="default" size="xs" onClick={onEdit} disabled={busy}>
            編集
          </Button>
        </Cluster>

        {!isSelf && (
          <Cluster gap={0.5}>
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
          </Cluster>
        )}
      </Stack>
    </li>
  );
}

function UserRow({
  user,
  isSelf,
  onDelete,
  onEdit,
  onSuspend,
  onUnsuspend,
  busy,
}: {
  user: AdminUserRow;
  isSelf: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onSuspend: () => void;
  onUnsuspend: () => void;
  busy: boolean;
}) {
  return (
    // 卒業生は背景で示す。opacity を下げると文字が読めなくなる(Issue #68)。
    // 状態列のバッジでも分かるので、色だけに頼っていない
    <tr className={user.suspended ? "bg-red-50" : user.graduated ? "bg-gray-100" : ""}>
      <Td>
        {/* 名前からその人のプロフィールへ行けるようにする(Issue #188)。
            管理者がユーザーを一番見る画面なのに、M-7 で作った /users/:id へ
            行く導線がここに無かった */}
        <span className={isSelf ? "font-bold" : ""}>
          <UserLink id={user.id} name={user.name} />
        </span>
        {isSelf && <span className="ml-2 text-[11px] text-gray-500">（自分）</span>}
      </Td>
      <Td className="text-xs text-gray-500">{user.email}</Td>
      {/* 未入力を空欄にしない。値が無いのか列がずれているのか分からなくなる */}
      <Td className="text-gray-500">{user.department ?? "—"}</Td>
      {/* 学年(B3 / M1)を出す。年度そのものは、この画面から入力しなくなった
          時点で「逆算した値」になったので、見出しの主役から外した */}
      <Td
        className="text-gray-500"
        title={`${user.enrollment_year} 年入学 / ${user.graduation_year} 年卒業`}
      >
        {user.grade ?? "—"}
      </Td>
      <Td>
        {/* 権限。停止中でも卒業生でも、その人が管理者であることは変わらない */}
        {user.role === "admin" ? <Chip>管理者</Chip> : <span className="text-gray-400">—</span>}
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
        <span className="flex gap-1.5">
          {/* 自分自身も編集できる。権限だけはサーバーが弾くので、
              ダイアログ側で選べないようにしてある */}
          <Button variant="default" size="xs" onClick={onEdit} disabled={busy}>
            編集
          </Button>
          {!isSelf &&
            (user.suspended ? (
              <Button variant="success" size="xs" onClick={onUnsuspend} disabled={busy}>
                停止解除
              </Button>
            ) : (
              <Button variant="danger" size="xs" onClick={onSuspend} disabled={busy}>
                停止
              </Button>
            ))}
          {!isSelf && (
            <Button variant="danger" size="xs" onClick={onDelete} disabled={busy}>
              完全に削除
            </Button>
          )}
        </span>
      </Td>
    </tr>
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
