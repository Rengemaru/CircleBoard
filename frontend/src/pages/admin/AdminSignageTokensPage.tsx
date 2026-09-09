import { useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import { CopyButton } from "../../components/CopyButton";
import { Field, INPUT_CLASS } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { ErrorNote } from "../../components/ui/ErrorNote";
import { Note } from "../../components/ui/Note";
import { Section } from "smarthr-ui";
import { Panel } from "../../components/ui/Panel";
import { SectionHeading } from "../../components/ui/SectionHeading";
import {
  createSignageToken,
  fetchSignageTokens,
  revokeSignageToken,
  type SignageTokenRow,
} from "../../api/admin";
import { AdminLayout } from "./AdminLayout";

// サイネージトークン管理(wireframes/wireframe-admin-ver2.html ⑤)。
// 端末ごとに発行し、漏れたらその端末の分だけ止められるようにする。
export function AdminSignageTokensPage() {
  const [issuing, setIssuing] = useState(false);

  return (
    <AdminLayout
      title="サイネージトークン管理"
      subtitle="部室ディスプレイ用のアクセストークンを発行・管理する"
      action={
        <Button variant="primary" size="sm" onClick={() => setIssuing(true)}>
          ＋ トークンを発行
        </Button>
      }
    >
      {() => <TokenList issuing={issuing} onCloseForm={() => setIssuing(false)} />}
    </AdminLayout>
  );
}

function TokenList({ issuing, onCloseForm }: { issuing: boolean; onCloseForm: () => void }) {
  const [tokens, setTokens] = useState<SignageTokenRow[] | null>(null);
  const [name, setName] = useState("");
  // エラーは文字列に潰さず、そのまま持つ。401 かどうかを
  // 表示側(ErrorNote)で判定するため(Issue #72)
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  // 無効化は取り消せないので、他の破壊的操作と同じく確認を挟む(Issue #39)
  const [revoking, setRevoking] = useState<SignageTokenRow | null>(null);
  // いま発行したトークン。この画面の目的は発行したURLを端末に設定することなので、
  // 同じ見た目のカードが1枚増えるだけでは、どれが新しいのか分からない(Issue #67)
  const [issued, setIssued] = useState<SignageTokenRow | null>(null);

  // 再読み込みに成功したらエラーを消す。消さないと、通信が直ったあとも
  // 赤い帯が残り続け、失敗したのか成功したのかが判別できない(Issue #44)
  function load() {
    fetchSignageTokens()
      .then((rows) => {
        setTokens(rows);
        setError(null);
      })
      .catch((e: unknown) => setError(e));
  }

  useEffect(() => {
    // 初回の読み込みだけ。以降は操作のたびに load() を呼ぶ
    load();
  }, []);

  async function issue(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const created = await createSignageToken(name);
      setIssued(created);
      setName("");
      onCloseForm();
      load();
    } catch (e: unknown) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: number, tokenName: string) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await revokeSignageToken(id);
      setSuccess(`${tokenName} のトークンを無効化しました`);
      setRevoking(null);
      load();
    } catch (e: unknown) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  if (error !== null && tokens === null) {
    return <ErrorNote error={error} fallback="操作に失敗しました" />;
  }
  if (tokens === null) {
    return <p className="text-gray-500">読み込み中…</p>;
  }

  const active = tokens.filter((t) => t.revoked_at === null);
  const revoked = tokens.filter((t) => t.revoked_at !== null);

  return (
    <>
      <Note>
        各ディスプレイに固有のトークン付きURLを設定します。漏洩時は該当トークンのみ無効化してください。
      </Note>

      {issued !== null && (
        <Panel
          title="トークンを発行しました"
          action={
            <Button variant="ghost" size="xs" onClick={() => setIssued(null)}>
              閉じる
            </Button>
          }
        >
          <dl className="mb-3 space-y-2 text-[13px]">
            <div className="flex gap-4">
              <dt className="w-24 shrink-0 text-gray-500">ディスプレイ名</dt>
              <dd className="font-semibold">{issued.name}</dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-24 shrink-0 text-gray-500">URL</dt>
              <dd className="min-w-0 break-all font-mono text-[11px]">{issued.url}</dd>
            </div>
          </dl>
          {/* 手で書き写すと打ち間違える。そのまま端末に貼れる形でコピーする
              (AdminUserCreatePage の IssuedNotice と同じ形) */}
          <CopyButton text={issued.url} label="URLをコピー" />
        </Panel>
      )}

      {issuing && (
        <Panel title="トークンを発行する">
          <form onSubmit={issue}>
            <Field label="ディスプレイ名（管理用）" required>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="例：部室メインディスプレイ"
                className={INPUT_CLASS}
              />
            </Field>
            <Note>
              発行するとランダムな32文字のトークンが生成されます。URLをディスプレイのブラウザに設定してください。
            </Note>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={onCloseForm}>
                キャンセル
              </Button>
              <Button type="submit" variant="primary" size="sm" busy={busy} busyLabel="発行中…">
                発行する
              </Button>
            </div>
          </form>
        </Panel>
      )}

      {error !== null && <ErrorNote error={error} fallback="操作に失敗しました" />}
      {success !== null && <Note tone="success">{success}</Note>}

      <Section className="block">
        <SectionHeading>有効なトークン</SectionHeading>
        {active.length === 0 ? (
          <p className="mb-5 text-[13px] text-gray-500">有効なトークンがありません。</p>
        ) : (
          active.map((token) => (
            <TokenCard
              key={token.id}
              token={token}
              busy={busy}
              onRevoke={() => setRevoking(token)}
            />
          ))
        )}
      </Section>

      {revoked.length > 0 && (
        <Section className="block">
          <SectionHeading>無効化済み</SectionHeading>
          {revoked.map((token) => (
            <TokenCard key={token.id} token={token} busy={busy} onRevoke={null} />
          ))}
          <p className="text-xs text-gray-500">
            無効にした端末も一覧に残ります。どの端末をいつ止めたかを追えるようにするためです。
          </p>
        </Section>
      )}

      {revoking !== null && (
        <Modal
          title="⚠️ このトークンを無効化しますか？"
          confirmLabel="無効化する"
          busy={busy}
          onCancel={() => setRevoking(null)}
          onConfirm={() => revoke(revoking.id, revoking.name)}
        >
          <p>
            <strong>{revoking.name}</strong> のトークンを無効化します。
            <br />
            このURLを設定した端末は、次の更新で表示できなくなります。
            <br />
            <strong>元に戻せません。</strong>同じ端末で使うには、新しいトークンを発行して
            URLを設定し直してください。
          </p>
        </Modal>
      )}
    </>
  );
}

// wireframe-admin-ver2.html の .token-card。
// 状態を示す丸 → 端末名 → トークン付きURL → 発行日 → 操作、の順
function TokenCard({
  token,
  busy,
  onRevoke,
}: {
  token: SignageTokenRow;
  busy: boolean;
  onRevoke: (() => void) | null;
}) {
  const revoked = token.revoked_at !== null;

  return (
    // 不透明度を下げると、区別は付くが文字が読めなくなる。無効化済みの行は
    // 「どの端末をいつ止めたか」を追うために残しているので、読めないと意味がない。
    // 背景と枠線で区別し、テキストのコントラストは保つ(Issue #68)
    <div
      className={`mb-2.5 flex flex-wrap items-center gap-3 rounded border px-4 py-3.5 ${
        revoked ? "border-gray-300 bg-gray-100" : "border-gray-200 bg-white"
      }`}
    >
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${revoked ? "bg-gray-300" : "bg-green-600"}`}
      />
      <span className="flex-1 text-[13px] font-semibold">{token.name}</span>

      {/* 端末に貼り付けるURL。ここだけはトークンの実値を見せる。
          admin 以外はこのAPIに到達できない(docs/api-spec.md §6) */}
      <code className="min-w-0 flex-[2] truncate rounded bg-gray-100 px-2 py-0.5 font-mono text-[11px] text-gray-500">
        {token.url}
      </code>

      {/* ワイヤーフレーム⑤は「最終アクセス」を出しているが、
          signage_tokens.last_accessed_at は意図的に作っていない(docs/er.md)。
          代わりに発行日を出す。同じ端末名で作り直したとき、どちらが新しいかを
          名前だけでは判断できないため */}
      <span className="flex-1 text-right text-[11px] text-gray-600">
        {revoked
          ? `無効化：${formatDate(token.revoked_at as string)}`
          : `発行：${formatDate(token.created_at)}`}
      </span>

      <span className="flex items-center gap-1.5">
        <CopyButton text={token.url} label="URLをコピー" />
        {onRevoke !== null && (
          <Button variant="danger" size="xs" onClick={onRevoke} disabled={busy}>
            無効化
          </Button>
        )}
      </span>
    </div>
  );
}

// 同じ端末名で作り直したとき、日付だけだとどちらが新しいか分からない。
// 分まで出す(Issue #67)
function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
