import { useLocation } from "react-router-dom";
import { LinkButton } from "./LinkButton";
import { Note } from "./Note";
import { ApiError } from "../../api/client";
import { loginPathFrom } from "../../lib/redirectTo";

// 管理画面のエラー表示。
//
// 401 だけは他のエラーと意味が違う。通信も入力も間違っていないので、
// 同じ赤い帯で「操作に失敗しました」と出すと、何を直せばよいのか
// 分からないまま同じ操作を繰り返すことになる(Issue #72)。
//
// 401 の判定をここ1箇所に置いているのは、管理画面の6ページが
// それぞれ同じ分岐を書くと、どれか1つを直し忘れても誰も気づかないため。
export function ErrorNote({ error, fallback }: { error: unknown; fallback: string }) {
  if (error instanceof ApiError && error.status === 401) {
    return <SessionExpired />;
  }

  return <Note tone="danger">{error instanceof Error ? error.message : fallback}</Note>;
}

function SessionExpired() {
  // ログインし直したら、いま開いていた管理画面に戻す(Issue #37)
  const location = useLocation();

  return (
    <Note tone="danger">
      ログインの有効期限が切れました。この操作は実行されていません。
      <LinkButton
        to={loginPathFrom(location.pathname + location.search)}
        variant="primary"
        size="sm"
        className="ml-3"
      >
        ログイン
      </LinkButton>
    </Note>
  );
}
