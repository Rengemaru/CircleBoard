import { useEffect, useState } from "react";
import { fetchCurrentUser, type CurrentUser } from "../api/session";

// ログイン状態を取る。複数の画面で同じことをするのでここにまとめる。
//
// 未ログインでも 401 ではなく 200 + null が返る仕様なので(docs/api-spec.md §1)、
// 「まだ確かめていない」と「未ログインだと確かめた」を loading で区別する。
// これを混ぜると、読み込み中に一瞬「ログインしてください」が出る。
export function useCurrentUser(): { user: CurrentUser | null; loading: boolean } {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  return { user, loading };
}
