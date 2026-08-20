import { useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import { CopyButton } from "../../components/CopyButton";
import { Field, INPUT_CLASS } from "../../components/ui/Field";
import { Note } from "../../components/ui/Note";
import { Panel } from "../../components/ui/Panel";
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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    fetchSignageTokens()
      .then(setTokens)
      .catch((e: unknown) => setError(toMessage(e)));
  }

  useEffect(() => {
    // 初回の読み込みだけ。以降は操作のたびに load() を呼ぶ
    load();
  }, []);

  async function issue(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createSignageToken(name);
      setName("");
      onCloseForm();
      load();
    } catch (e: unknown) {
      setError(toMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: number) {
    setBusy(true);
    setError(null);
    try {
      await revokeSignageToken(id);
      load();
    } catch (e: unknown) {
      setError(toMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (error !== null && tokens === null) {
    return <Note tone="danger">{error}</Note>;
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
              <Button type="submit" variant="primary" size="sm" disabled={busy}>
                発行する
              </Button>
            </div>
          </form>
        </Panel>
      )}

      {error !== null && <Note tone="danger">{error}</Note>}

      <SectionHeading>有効なトークン</SectionHeading>
      {active.length === 0 ? (
        <p className="mb-5 text-[13px] text-gray-500">有効なトークンがありません。</p>
      ) : (
        active.map((token) => (
          <TokenCard key={token.id} token={token} busy={busy} onRevoke={() => revoke(token.id)} />
        ))
      )}

      {revoked.length > 0 && (
        <>
          <SectionHeading>無効化済み</SectionHeading>
          {revoked.map((token) => (
            <TokenCard key={token.id} token={token} busy={busy} onRevoke={null} />
          ))}
          <p className="text-xs text-gray-500">
            無効にした端末も一覧に残ります。どの端末をいつ止めたかを追えるようにするためです。
          </p>
        </>
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
    <div
      className={`mb-2.5 flex flex-wrap items-center gap-3 rounded border border-gray-200 bg-white px-4 py-3.5 ${
        revoked ? "opacity-50" : ""
      }`}
    >
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${revoked ? "bg-gray-300" : "bg-green-600"}`}
      />
      <span className="flex-1 text-[13px] font-semibold">{token.name}</span>

      {/* 端末に貼り付けるURL。ここだけはトークンの実値を見せる。
          admin 以外はこのAPIに到達できない(docs/api-spec.md §6) */}
      <code className="min-w-0 flex-[2] truncate rounded-sm bg-gray-100 px-2 py-0.5 font-mono text-[11px] text-gray-500">
        {token.url}
      </code>

      {/* ワイヤーフレーム⑤は「最終アクセス」を出しているが、
          signage_tokens.last_accessed_at は意図的に作っていない(docs/er.md)。
          代わりに発行日を出す。同じ端末名で作り直したとき、どちらが新しいかを
          名前だけでは判断できないため */}
      <span className="flex-1 text-right text-[11px] text-gray-400">
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

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 border-b-2 border-gray-200 pb-1.5 text-[13px] font-bold text-gray-700">
      {children}
    </h2>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "操作に失敗しました";
}
