import { useEffect, useState } from "react";
import { fetchCurrentUser, type CurrentUser } from "../api/session";

// ログイン状態を取る。複数の画面で同じことをするのでここにまとめる。
//
// 未ログインでも 401 ではなく 200 + null が返る仕様なので(docs/api-spec.md §1)、
// 「まだ確かめていない」と「未ログインだと確かめた」を loading で区別する。
// これを混ぜると、読み込み中に一瞬「ログインしてください」が出る。
export function useCurrentUser(): {
  user: CurrentUser | null;
  loading: boolean;
  failed: boolean;
} {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  // 未ログインは 200 + null で返ってくるので、例外が飛んだということは
  // 「未ログインだと分かった」ではなく「確かめられなかった」。
  // ここを null に倒すと、通信が切れただけでログイン中の人に
  // 「ログインすると閲覧できます」が出る(Issue #72)
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchCurrentUser()
      .then(setUser)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  return { user, loading, failed };
}
