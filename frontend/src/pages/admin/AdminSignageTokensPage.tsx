import { useEffect, useState } from "react";
import { CopyButton } from "../../components/CopyButton";
import {
  createSignageToken,
  fetchSignageTokens,
  revokeSignageToken,
  type SignageTokenRow,
} from "../../api/admin";
import { AdminLayout } from "./AdminLayout";

// サイネージトークンの管理(wireframes/wireframe-admin.html ③)。
// 端末ごとに発行し、漏れたらその端末の分だけ止められるようにする。
export function AdminSignageTokensPage() {
  return (
    <AdminLayout title="サイネージ端末">
      {() => <TokenList />}
    </AdminLayout>
  );
}

function TokenList() {
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
    return <p className="text-red-700">{error}</p>;
  }
  if (tokens === null) {
    return <p className="text-gray-500">読み込み中…</p>;
  }

  return (
    <div className="space-y-6">
      <form onSubmit={issue} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="端末名（例: 部室メインディスプレイ）"
          className="flex-1 rounded border border-gray-300 px-3 py-2"
        />
        <button
          type="submit"
          disabled={busy || name.trim() === ""}
          className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-40"
        >
          発行
        </button>
      </form>

      {error !== null && <p className="text-red-700">{error}</p>}

      <ul className="space-y-3">
        {tokens.map((token) => (
          <li key={token.id} className="rounded border border-gray-200 p-4">
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-bold">{token.name}</span>
              {token.revoked_at === null ? (
                <span className="text-sm text-green-700">有効</span>
              ) : (
                <span className="text-sm text-gray-500">
                  {formatDate(token.revoked_at)} に無効化
                </span>
              )}
            </div>

            {/* 発行日。同じ端末名で作り直したときに、どちらが新しいかを
                名前だけでは判断できない */}
            <div className="mt-1 text-sm text-gray-500">
              {formatDate(token.created_at)} 発行
            </div>

            {/* 端末に貼り付けるURL。ここだけはトークンの実値を見せる。
                admin 以外はこのAPIに到達できない(docs/api-spec.md §6) */}
            <p className="mt-2 break-all font-mono text-xs text-gray-600">{token.url}</p>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              {/* URLは手で打つには長い。端末のブラウザに貼れる形で渡す */}
              <CopyButton text={token.url} label="URLをコピー" />
              {token.revoked_at === null && (
                <button
                  type="button"
                  onClick={() => revoke(token.id)}
                  disabled={busy}
                  className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-40"
                >
                  無効にする
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <p className="text-sm text-gray-500">
        無効にした端末も一覧に残ります。どの端末をいつ止めたかを追えるようにするためです。
      </p>
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(new Date(value));
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "操作に失敗しました";
}
