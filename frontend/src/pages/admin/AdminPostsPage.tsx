import { useEffect, useState } from "react";
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
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { ErrorNote } from "../../components/ui/ErrorNote";
import { Chip } from "../../components/ui/Chip";
import { Note } from "../../components/ui/Note";
import { PostLink } from "../../components/PostLink";
import {
  fetchAdminPosts,
  restorePost,
  trashPost,
  type AdminPostRow,
  type PostKind,
} from "../../api/admin";
import { AdminOnly } from "./AdminOnly";

// 企画一覧・全件管理(wireframes/wireframe-admin-ver2.html ④)。
//
// ワイヤーフレームにある「編集」ボタンは作っていない。企画を編集する画面は
// メンバー側にもまだ無く(作成フォームだけがある)、この画面のためだけに
// 管理者用の編集フォームを新設すると、あとで作るメンバー用の編集画面と二重になる。
export function AdminPostsPage() {
  return (
    <AdminOnly
      title="企画一覧（全件）"
      subtitle="全メンバーの投稿を管理・削除・復旧できる"
      // 7列の表。DEFAULT だと横スクロールが常態化する
      size="WIDE"
    >
      {() => <PostList />}
    </AdminOnly>
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

// 状態の色。文言は STATUS_LABEL と共有し、色だけをここで持つ
const STATUS_TONE: Record<AdminPostRow["status"], "recruiting" | "inprogress" | "completed"> = {
  recruiting: "recruiting",
  in_progress: "inprogress",
  completed: "completed",
};

// Select は options を配列で受け取る。ラベルの定義は表の中でも使うので
// Record のまま持ち、ここで並びに直す
const KIND_OPTIONS = (Object.keys(KIND_LABEL) as KindFilter[]).map((key) => ({
  label: KIND_LABEL[key],
  value: key,
}));

const STATUS_OPTIONS = (Object.keys(STATUS_LABEL) as StatusFilter[]).map((key) => ({
  label: STATUS_LABEL[key],
  value: key,
}));

function PostList() {
  // 表と縦積みの切り替え。境界は smarthr-ui の SCREEN_SMALL(width <= 751px)
  const { mobile } = useEnvironment();
  const [posts, setPosts] = useState<AdminPostRow[] | null>(null);
  const [keyword, setKeyword] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [trashing, setTrashing] = useState<AdminPostRow | null>(null);
  // エラーは文字列に潰さず、そのまま持つ。401 かどうかを
  // 表示側(ErrorNote)で判定するため(Issue #72)
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  function load() {
    fetchAdminPosts()
      .then((rows) => {
        setPosts(rows);
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
      setTrashing(null);
      load();
    } catch (e: unknown) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  if (error !== null && posts === null) {
    return <ErrorNote error={error} fallback="読み込みに失敗しました" />;
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
      {/* 絞り込みは名前を持たせる。select は名前が無いと
          「コンボボックス」としか読み上げられない(Issue #58)。
          SearchInput と Select は aria-label をそのまま受け取る */}
      <Cluster gap="XS" className="mb-4">
        {/* SearchInput の className は中の input には届くが、外側の幅は
            決まらない。伸ばす役目は包む div に持たせる */}
        <div className="min-w-[200px] flex-1">
          <SearchInput
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            aria-label="企画名・投稿者で検索"
            tooltipMessage="企画名・投稿者で検索"
            width="100%"
          />
        </div>
        <Select
          value={kind}
          options={KIND_OPTIONS}
          onChangeValue={setKind}
          aria-label="種別で絞り込む"
          width="140px"
        />
        <Select
          value={status}
          options={STATUS_OPTIONS}
          onChangeValue={setStatus}
          aria-label="状態で絞り込む"
          width="140px"
        />
      </Cluster>

      {error !== null && <ErrorNote error={error} fallback="読み込みに失敗しました" />}
      {success !== null && <Note tone="success">{success}</Note>}

      <div className="mb-5 rounded border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3.5">
          <h2 className="text-sm font-bold">
            企画一覧
            {/* 絞り込み後の件数だけだと、全体が何件なのか分からず、
                何を隠しているのかが把握できない(Issue #63) */}
            <span className="ml-2 text-xs font-normal text-gray-500">
              {formatCount(visible.length, posts.length)}
            </span>
          </h2>
          {/* 投稿日の新しい順(api/admin/posts_controller.rb:24) */}
          <span className="text-xs text-gray-500">投稿日が新しい順</span>
        </div>

        {/* モバイルでは表をやめて縦に積む。SmartHR の Table は
            「モバイルでは、画面幅を越えたテーブルは2次元スクロールを招くため、
            垂直方向に積みあげることを推奨します」としている。
            実際 375px では、7列が潰れて「機械学/習輪読/会」「プロ/ジェク/ト」の
            ように文字単位で折り返していた。
            境界は smarthr-ui の SCREEN_SMALL(width <= 751px)に合わせる */}
        {mobile ? (
          <ul className="divide-y divide-gray-200">
            {visible.map((post) => (
              <PostCard
                key={`${post.kind}-${post.id}`}
                post={post}
                onTrash={() => setTrashing(post)}
                onRestore={() =>
                  run(() => restorePost(post.kind, post.id), `${post.title} を復旧しました`)
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
                    onRestore={() =>
                      run(() => restorePost(post.kind, post.id), `${post.title} を復旧しました`)
                    }
                    busy={busy}
                  />
                ))}
              </tbody>
            </Table>
          </div>
        )}

        {visible.length === 0 && (
          <p className="px-4 py-6 text-[13px] text-gray-500">該当する企画がありません。</p>
        )}
      </div>

      {/* 破壊的操作の意味は確認モーダルに書く。押す直前に必ず目に入る場所でないと
          読まれない(SmartHR feedback.mdx「直前に操作した要素の近く」)。
          ここに残すのは、操作の前提として知っておく話だけ(Issue #61) */}
      <Note tone="warning">
        企画の内容そのものは、この画面からは編集できません。文面を直したいときは owner
        本人に依頼するか、
        <code className="mx-1 rounded bg-gray-100 px-1">rails console</code>
        で対応します。
      </Note>

      {trashing !== null && (
        <Modal
          title="この企画を削除しますか？"
          confirmLabel="削除する"
          busy={busy}
          onCancel={() => setTrashing(null)}
          onConfirm={() =>
            run(() => trashPost(trashing.kind, trashing.id), `${trashing.title} を削除しました`)
          }
        >
          <p>
            {/* 折り返すと JSX が改行を空白にしてしまうので、文はつなげて書く */}
            <strong>{trashing.title}</strong>（{KIND_LABEL[trashing.kind]}
            ）を一覧とサイネージから消します。
            <br />
            <strong>あとからこの画面の「復旧」で元に戻せます。</strong>
            参加者{trashing.participants_count}名の記録も残り、参加者への通知は行いません。
          </p>
        </Modal>
      )}
    </>
  );
}

// モバイル1件分。SmartHR の「よくあるリスト」の並びに合わせる。
// 識別子(企画名)→ 属性(状態・種別・投稿者・参加人数・投稿日)→ 操作 の順。
//
// 操作を文言のままのボタンにしているのは、削除と復旧を取り違えると
// 参加者の見え方が変わるため。アイコンだけでは何が起きるか読めない
function PostCard({
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
    // 削除済みは背景で示す。バッジと打ち消し線でも分かるので色だけに頼らない
    <li className={`py-3 ${post.trashed ? "bg-gray-100" : ""}`}>
      <Stack gap={0.5}>
        <Cluster align="center" gap={0.5}>
          {post.trashed ? (
            <s>{post.title}</s>
          ) : (
            <strong>
              <PostLink kind={post.kind} id={post.id}>
                {post.title}
              </PostLink>
            </strong>
          )}
          {post.trashed ? (
            <>
              <Badge tone="trashed">削除済み</Badge>
              <Chip>{STATUS_LABEL[post.status]}</Chip>
            </>
          ) : (
            <Badge tone={STATUS_TONE[post.status]}>{STATUS_LABEL[post.status]}</Badge>
          )}
        </Cluster>

        <Text size="S" color="TEXT_GREY" leading="TIGHT" as="p">
          {KIND_LABEL[post.kind]} ・ {post.owner_name ?? "（退会済み）"} ・ 参加人数{" "}
          {post.participants_count} / {post.capacity ?? "制限なし"}
        </Text>
        <Text size="S" color="TEXT_GREY" leading="TIGHT" as="p">
          投稿日 {formatDate(post.created_at)}
        </Text>

        <Cluster gap={0.5}>
          {post.trashed ? (
            <Button variant="success" size="xs" onClick={onRestore} disabled={busy}>
              復旧
            </Button>
          ) : (
            <Button variant="danger" size="xs" onClick={onTrash} disabled={busy}>
              削除
            </Button>
          )}
        </Cluster>
      </Stack>
    </li>
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
    // 削除済みは背景で示す。opacity を下げると文字が読めなくなる(Issue #68)。
    // 削除済みバッジと打ち消し線でも分かるので、色だけに頼っていない
    <tr className={post.trashed ? "bg-gray-100" : ""}>
      {/* 削除済みはリンクにしない。公開APIが必ず404を返すので開けない。
          復旧すれば開けるようになる(Issue #188) */}
      <Td>
        {post.trashed ? (
          <s>{post.title}</s>
        ) : (
          <strong>
            <PostLink kind={post.kind} id={post.id}>
              {post.title}
            </PostLink>
          </strong>
        )}
      </Td>
      <Td className="text-gray-500">{KIND_LABEL[post.kind]}</Td>
      <Td>
        {/* 削除済みでも元のステータスを併記する。出さないと「復旧」を押したとき
            募集中に戻るのか終了に戻るのかが押す前に分からない(Issue #65)。
            削除は状態を書き換えないので、trashed と status は別の軸。

            ただし StatusLabel は1オブジェクトに1つまで(components/ui/Badge.tsx)。
            削除済みのときは「削除済み」だけを状態として出し、元の状態は
            属性として Chip で添える(Issue #191) */}
        <span className="flex flex-wrap items-center gap-1">
          {post.trashed ? (
            <>
              <Badge tone="trashed">削除済み</Badge>
              <Chip>{STATUS_LABEL[post.status]}</Chip>
            </>
          ) : (
            <Badge tone={STATUS_TONE[post.status]}>{STATUS_LABEL[post.status]}</Badge>
          )}
        </span>
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

// 絞り込んでいるときだけ「N件 / 全M件」にする
function formatCount(visible: number, total: number): string {
  return visible === total ? `${total}件` : `${visible}件 / 全${total}件`;
}
