import { useEffect, useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { INPUT_CLASS } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { Note } from "../../components/ui/Note";
import {
  fetchAdminPosts,
  restorePost,
  trashPost,
  type AdminPostRow,
  type PostKind,
} from "../../api/admin";
import { AdminLayout } from "./AdminLayout";

// 企画一覧・全件管理(wireframes/wireframe-admin-ver2.html ④)。
//
// ワイヤーフレームにある「編集」ボタンは作っていない。企画を編集する画面は
// メンバー側にもまだ無く(作成フォームだけがある)、この画面のためだけに
// 管理者用の編集フォームを新設すると、あとで作るメンバー用の編集画面と二重になる。
export function AdminPostsPage() {
  return (
    <AdminLayout title="企画一覧（全件）" subtitle="全メンバーの投稿を管理・削除・復旧できる">
      {() => <PostList />}
    </AdminLayout>
  );
}

type KindFilter = "all" | PostKind;
type StatusFilter = "all" | "recruiting" | "in_progress" | "completed" | "trashed";

const KIND_LABEL: Record<KindFilter, string> = {
  all: "全種別",
  event: "イベント",
  project: "プロジェクト",
};

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: "全ステータス",
  recruiting: "募集中",
  in_progress: "進行中",
  completed: "終了",
  trashed: "削除済み",
};

function PostList() {
  const [posts, setPosts] = useState<AdminPostRow[] | null>(null);
  const [keyword, setKeyword] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [trashing, setTrashing] = useState<AdminPostRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    fetchAdminPosts()
      .then((rows) => {
        setPosts(rows);
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
      setTrashing(null);
      load();
    } catch (e: unknown) {
      setError(toMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (error !== null && posts === null) {
    return <Note tone="danger">{error}</Note>;
  }
  if (posts === null) {
    return <p className="text-gray-500">読み込み中…</p>;
  }

  // 絞り込みはサーバーに投げず画面側で行う。部内の企画は多くても数十件で、
  // 1文字打つたびに往復させる意味がない(api/admin.ts の fetchAdminPosts 参照)。
  // メンバー側の一覧が ?status= を使うのは、URLで共有できることが要件だったため
  const visible = posts.filter(
    (post) =>
      matchesKeyword(post, keyword) && matchesKind(post, kind) && matchesStatus(post, status),
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="企画名・投稿者で検索"
          className={`${INPUT_CLASS} min-w-[200px] flex-1`}
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as KindFilter)}
          className={`${INPUT_CLASS} w-[140px] flex-none`}
        >
          {(Object.keys(KIND_LABEL) as KindFilter[]).map((key) => (
            <option key={key} value={key}>
              {KIND_LABEL[key]}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className={`${INPUT_CLASS} w-[140px] flex-none`}
        >
          {(Object.keys(STATUS_LABEL) as StatusFilter[]).map((key) => (
            <option key={key} value={key}>
              {STATUS_LABEL[key]}
            </option>
          ))}
        </select>
      </div>

      {error !== null && <Note tone="danger">{error}</Note>}

      <div className="mb-5 rounded border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3.5">
          <h2 className="text-sm font-bold">
            企画一覧
            <span className="ml-2 text-xs font-normal text-gray-500">{visible.length}件</span>
          </h2>
        </div>

        {/* 列が多い表は横に溢れる。ページ全体を横スクロールさせない */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <Th>企画名</Th>
                <Th>種別</Th>
                <Th>状態</Th>
                <Th>投稿者</Th>
                <Th>参加人数</Th>
                <Th>投稿日</Th>
                <Th>操作</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((post) => (
                <PostRow
                  // イベントとプロジェクトでIDが重複するので、種別と組にする
                  key={`${post.kind}-${post.id}`}
                  post={post}
                  onTrash={() => setTrashing(post)}
                  onRestore={() => run(() => restorePost(post.kind, post.id))}
                  busy={busy}
                />
              ))}
            </tbody>
          </table>
        </div>

        {visible.length === 0 && (
          <p className="px-4 py-6 text-[13px] text-gray-500">該当する企画がありません。</p>
        )}
      </div>

      <Note>
        <strong>「削除」は論理削除です。</strong>
        一覧・サイネージから消えますが、レコードは残ります。この画面の「復旧」で元に戻せます。
        参加者への通知は行いません。
      </Note>

      <Note tone="warning">
        企画の内容そのものは、この画面からは編集できません。文面を直したいときは owner
        本人に依頼するか、
        <code className="mx-1 rounded bg-gray-100 px-1">rails console</code>
        で対応します。
      </Note>

      {trashing !== null && (
        <Modal
          title="⚠️ 企画を削除しますか？"
          confirmLabel="削除する"
          busy={busy}
          onCancel={() => setTrashing(null)}
          onConfirm={() => run(() => trashPost(trashing.kind, trashing.id))}
        >
          <p>
            <strong>{trashing.title}</strong>（{KIND_LABEL[trashing.kind]}）を削除します。
            <br />
            参加者{trashing.participants_count}名の記録は残り、この画面から復旧できます。
          </p>
        </Modal>
      )}
    </>
  );
}

function PostRow({
  post,
  onTrash,
  onRestore,
  busy,
}: {
  post: AdminPostRow;
  onTrash: () => void;
  onRestore: () => void;
  busy: boolean;
}) {
  return (
    <tr className={post.trashed ? "bg-gray-50 opacity-65" : ""}>
      <Td>{post.trashed ? <s>{post.title}</s> : <strong>{post.title}</strong>}</Td>
      <Td className="text-gray-500">{KIND_LABEL[post.kind]}</Td>
      <Td>
        {post.trashed ? (
          <Badge tone="trashed">削除済み</Badge>
        ) : post.status === "recruiting" ? (
          <Badge tone="recruiting">募集中</Badge>
        ) : post.status === "in_progress" ? (
          <Badge tone="inprogress">進行中</Badge>
        ) : (
          <Badge tone="completed">終了</Badge>
        )}
      </Td>
      {/* 退会したメンバーの企画は owner が null で残る(ON DELETE SET NULL) */}
      <Td className="text-gray-500">{post.owner_name ?? "（退会済み）"}</Td>
      <Td className="text-gray-500">
        {post.participants_count} / {post.capacity ?? "制限なし"}
      </Td>
      <Td className="text-xs text-gray-500">{formatDate(post.created_at)}</Td>
      <Td>
        {post.trashed ? (
          <Button variant="success" size="xs" onClick={onRestore} disabled={busy}>
            復旧
          </Button>
        ) : (
          <Button variant="danger" size="xs" onClick={onTrash} disabled={busy}>
            削除
          </Button>
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

function matchesKeyword(post: AdminPostRow, keyword: string): boolean {
  const q = keyword.trim().toLowerCase();
  if (q === "") return true;

  return post.title.toLowerCase().includes(q) || (post.owner_name ?? "").toLowerCase().includes(q);
}

function matchesKind(post: AdminPostRow, kind: KindFilter): boolean {
  return kind === "all" || post.kind === kind;
}

// 削除済みは status と別の列だが、画面上は1つの選択肢として並べる(画面④)。
// 「削除済み」以外を選んだときは削除済みを外す。消したものが「募集中」の
// 絞り込みに混ざると、生きている企画と見分けが付かない
function matchesStatus(post: AdminPostRow, status: StatusFilter): boolean {
  if (status === "all") return true;
  if (status === "trashed") return post.trashed;

  return !post.trashed && post.status === status;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "読み込みに失敗しました";
}
