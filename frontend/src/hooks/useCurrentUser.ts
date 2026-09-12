import { useEffect, useState } from "react";
import { fetchCurrentUser, type CurrentUser } from "../api/session";

// ログイン状態を取る。複数の画面で同じことをするのでここにまとめる。
//
// 未ログインでも 401 ではなく 200 + null が返る仕様なので(docs/api-spec.md §1)、
// 「まだ確かめていない」と「未ログインだと確かめた」を loading で区別する。
// これを混ぜると、読み込み中に一瞬「ログインしてください」が出る。
// この3つは必ず一緒に持ち回る。1つでも欠けると
// 「まだ確かめていない」と「未ログインだと確かめた」が区別できなくなる
export type SessionState = {
  user: CurrentUser | null;
  loading: boolean;
  failed: boolean;
  // 初期パスワードのままか。true の間は他のAPIが全て403になる(Issue #288)
  passwordChangeRequired: boolean;
};

export function useCurrentUser(): SessionState {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  // 未ログインは 200 + null で返ってくるので、例外が飛んだということは
  // 「未ログインだと分かった」ではなく「確かめられなかった」。
  // ここを null に倒すと、通信が切れただけでログイン中の人に
  // 「ログインすると閲覧できます」が出る(Issue #72)
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchCurrentUser()
      .then((session) => {
        setUser(session.user);
        setPasswordChangeRequired(session.passwordChangeRequired);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  return { user, loading, failed, passwordChangeRequired };
}
