import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MemberPage } from "../components/MemberPage";
import { Button } from "../components/ui/Button";
import { Field, INPUT_CLASS } from "../components/ui/Field";
import { Note } from "../components/ui/Note";
import { Panel } from "../components/ui/Panel";
import { login } from "../api/session";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { REDIRECT_PARAM, safeRedirectPath } from "../lib/redirectTo";

// ログイン(wireframes/wireframe-member.html ⑥)。
//
// 認証はサーバー側セッション + HttpOnly Cookie。トークンを localStorage に
// 保存しない(CLAUDE.md §4)。ここでは Cookie が付くのを待つだけで、
// フロントは資格情報を一切保持しない。
export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, failed } = useCurrentUser();
  // 戻り先は URL から来るので、外部サイトを指していないかをここで絞る
  const redirectTo = safeRedirectPath(searchParams.get(REDIRECT_PARAM));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 空欄のまま押されたときは required がブラウザ側で止める。
  // 送っても 401 が返るだけなので、往復する意味がない

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate(redirectTo);
    } catch (e: unknown) {
      // サーバーは「メールが存在しない」と「パスワードが違う」を区別しない。
      // 画面でも区別せず、サーバーが返した文言をそのまま出す
      setError(e instanceof Error ? e.message : "ログインできませんでした");
    } finally {
      setBusy(false);
    }
  }

  return (
    <MemberPage user={user} width="narrow" sessionFailed={failed}>
      <Panel title="ログイン">
        <form onSubmit={submit}>
          {error !== null && <Note tone="danger">{error}</Note>}

          <Field label="メールアドレス" required>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className={INPUT_CLASS}
            />
          </Field>

          <Field label="パスワード" required>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className={INPUT_CLASS}
            />
          </Field>

          <Button
            type="submit"
            variant="primary"
            busy={busy}
            busyLabel="ログイン中…"
            className="w-full"
          >
            ログイン
          </Button>
        </form>
      </Panel>

      {/* パスワード再発行UIは MVP 対象外。rails console で対応する(CLAUDE.md §10) */}
      <Note>アカウントは部長が発行します。パスワードを忘れた場合も部長に連絡してください。</Note>
    </MemberPage>
  );
}
