import { useLocation } from "react-router-dom";
import { LinkButton } from "./ui/LinkButton";
import { loginPathFrom } from "../lib/redirectTo";

// ログインしないと使えない画面で出す案内。
//
// 「見えません」だけで終わらせず、次に何をすればよいかを置く。
// 3画面（プロジェクト一覧・プロジェクト詳細・企画作成）で同じものが要る。
//
// これは表示の話であって制限ではない。プロジェクトと企画作成のAPIは
// サーバー側で必ず 401 を返す(docs/api-spec.md §3)。
export function LoginRequired({ children }: { children: React.ReactNode }) {
  // ログインしたらこの画面に戻す(Issue #37)
  const location = useLocation();

  return (
    <div className="rounded border border-gray-200 bg-white p-5">
      <p className="text-[13px] text-gray-700">{children}</p>
      <LinkButton
        to={loginPathFrom(location.pathname + location.search)}
        variant="primary"
        size="sm"
        className="mt-3"
      >
        ログイン
      </LinkButton>
    </div>
  );
}
