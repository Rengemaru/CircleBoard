import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import { login } from "../api/session";
import { useCurrentUser } from "../hooks/useCurrentUser";

// ログイン(wireframes/wireframe-member.html ⑥)。
//
// 認証はサーバー側セッション + HttpOnly Cookie。トークンを localStorage に
// 保存しない(CLAUDE.md §4)。ここでは Cookie が付くのを待つだけで、
// フロントは資格情報を一切保持しない。
export function LoginPage() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate("/");
    } catch (e: unknown) {
      // サーバーは「メールが存在しない」と「パスワードが違う」を区別しない。
      // 画面でも区別せず、サーバーが返した文言をそのまま出す
      setError(e instanceof Error ? e.message : "ログインできませんでした");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-sm p-6">
        <h1 className="mb-6 text-2xl font-bold">ログイン</h1>

        <form onSubmit={submit} className="space-y-4">
          {error !== null && (
            <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </p>
          )}

          <label className="block">
            <span className="mb-1 block text-sm text-gray-700">メールアドレス</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-gray-700">パスワード</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-40"
          >
            ログイン
          </button>
        </form>

        {/* パスワード再発行UIは MVP 対象外。rails console で対応する(CLAUDE.md §10) */}
        <p className="mt-6 text-sm text-gray-500">
          アカウントは部長が発行します。パスワードを忘れた場合も部長に連絡してください。
        </p>
      </main>
    </>
  );
}
