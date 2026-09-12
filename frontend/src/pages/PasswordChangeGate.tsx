import { Outlet, Navigate } from "react-router-dom";
import { useCurrentUser } from "../hooks/useCurrentUser";

// 初期パスワードのままの人を、変更画面へ送る(Issue #288)。
//
// **これは案内であって制限ではない。** 実際に止めているのはサーバー側で、
// この状態では変更とセッション以外のAPIが全て403になる(CLAUDE.md §3-2)。
// ここを外しても情報は漏れず、画面が403だらけになるだけ。
//
// 判定が終わるまでは何も出さない。先に子を描くと、403のエラーが一瞬見えてから
// 変更画面に飛ぶことになり、何が起きたのか分からない。
//
// 通信に失敗したときは通す。ここで止めると、サーバーが落ちているときに
// 全員が変更画面に閉じ込められ、しかも変更も通らない
export function PasswordChangeGate() {
  const { loading, failed, passwordChangeRequired } = useCurrentUser();

  if (loading) return null;
  if (!failed && passwordChangeRequired) return <Navigate to="/password-change" replace />;

  return <Outlet />;
}
