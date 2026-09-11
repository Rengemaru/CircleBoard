import { useEffect, useState } from "react";
import { Cluster, FormControl, Input, StatusLabel, Text } from "smarthr-ui";
import { Button } from "../../components/ui/Button";
import { ErrorNote } from "../../components/ui/ErrorNote";
import { Modal } from "../../components/ui/Modal";
import { Note } from "../../components/ui/Note";
import { Panel } from "../../components/ui/Panel";
import { deleteAdminTag, fetchAdminTags, renameAdminTag, type AdminTagRow } from "../../api/admin";
import { AdminOnly } from "./AdminOnly";

// タグ管理(docs/spec-tags.md §3.8)。
//
// **作る場所ではなく「直す場所」。** タグは自由記述なので、Rails と rails、
// 誤字、使われなくなったものが溜まる。作成機能は置かない。タグは企画か
// プロフィールに付ける過程で生まれる(§3.5)。ここから作れるようにすると、
// どこにも付いていないタグが生まれる。
export function AdminTagsPage() {
  return (
    <AdminOnly title="タグ管理" subtitle="表記ゆれの統合と、使われなくなったタグの整理">
      {() => <TagList />}
    </AdminOnly>
  );
}

const CATEGORY_LABEL: Record<AdminTagRow["category"], string> = {
  project_event: "企画",
  profile: "プロフィール",
};

function TagList() {
  const [tags, setTags] = useState<AdminTagRow[] | null>(null);
  // エラーは文字列に潰さず、そのまま持つ。401 かどうかを表示側で判定するため(Issue #72)
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<AdminTagRow | null>(null);
  const [newName, setNewName] = useState("");
  // 削除は取り消せないので、他の破壊的操作と同じく確認を挟む(Issue #39)
  const [deleting, setDeleting] = useState<AdminTagRow | null>(null);

  // 再読み込みに成功したらエラーを消す。消さないと、通信が直ったあとも
  // 赤い帯が残り続ける(Issue #44)
  function load() {
    fetchAdminTags()
      .then((rows) => {
        setTags(rows);
        setError(null);
      })
      .catch((e: unknown) => setError(e));
  }

  useEffect(load, []);

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setSuccess(message);
      load();
      setRenaming(null);
      setDeleting(null);
    } catch (e: unknown) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  if (error !== null && tags === null)
    return <ErrorNote error={error} fallback="操作に失敗しました" />;
  if (tags === null) return <Text size="S">読み込み中…</Text>;

  return (
    <>
      {error !== null && <ErrorNote error={error} fallback="操作に失敗しました" />}
      {success !== null && <Note tone="success">{success}</Note>}

      <Note>
        タグはこの画面からは作れません。企画やプロフィールに付けたときに作られます。
        ここでできるのは、表記ゆれの改名と、使われなくなったタグの削除です。
      </Note>

      <Panel title={`タグ ${tags.length}件`}>
        {tags.length === 0 ? (
          <Text size="S" color="TEXT_GREY">
            まだタグがありません。
          </Text>
        ) : (
          <ul>
            {tags.map((tag) => (
              <li key={tag.id} className="border-b border-gray-200 py-2 last:border-b-0">
                <Cluster align="center" justify="space-between" gap={0.5}>
                  <Cluster align="center" gap={0.5}>
                    <StatusLabel>{CATEGORY_LABEL[tag.category]}</StatusLabel>
                    {/* 一覧では切らない。直す画面で名前が読めないと直せない */}
                    <Text>{tag.name}</Text>
                    <Text size="S" color="TEXT_GREY">
                      {tag.usage_count}件で使用
                    </Text>
                  </Cluster>
                  <Cluster gap={0.25}>
                    <Button
                      size="xs"
                      onClick={() => {
                        setRenaming(tag);
                        setNewName(tag.name);
                      }}
                      disabled={busy}
                    >
                      改名
                    </Button>
                    {/* 使われているタグを消すと、企画から黙ってタグが外れる。
                        サーバーも422で止めるが、押せない方が理由が早く伝わる */}
                    <Button
                      size="xs"
                      variant="danger"
                      onClick={() => setDeleting(tag)}
                      disabled={busy || tag.usage_count > 0}
                    >
                      削除
                    </Button>
                  </Cluster>
                </Cluster>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {renaming !== null && (
        <Modal
          title="タグを改名しますか？"
          confirmLabel="改名する"
          busy={busy}
          onCancel={() => setRenaming(null)}
          onConfirm={() =>
            run(
              () => renameAdminTag(renaming.id, newName),
              `「${renaming.name}」を「${newName}」に改名しました`,
            )
          }
        >
          <Text size="S">
            <strong>{renaming.name}</strong>（{renaming.usage_count}件で使用）を改名します。
            付いている企画やプロフィールの表示もまとめて変わります。
          </Text>
          <FormControl label="新しい名前">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              width="100%"
              autoFocus
            />
          </FormControl>
        </Modal>
      )}

      {/* ⚠️ は取り消せない操作にだけ付ける(Issue #41) */}
      {deleting !== null && (
        <Modal
          title="⚠️ このタグを削除しますか？"
          confirmLabel="削除する"
          busy={busy}
          onCancel={() => setDeleting(null)}
          onConfirm={() =>
            run(() => deleteAdminTag(deleting.id), `「${deleting.name}」を削除しました`)
          }
        >
          <Text size="S">
            <strong>{deleting.name}</strong> を削除します。どこにも付いていないタグですが、
            この画面から戻すことはできません。
          </Text>
        </Modal>
      )}
    </>
  );
}
