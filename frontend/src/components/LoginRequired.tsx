import { Link } from "react-router-dom";
import { Button } from "./ui/Button";

// ログインしないと使えない画面で出す案内。
//
// 「見えません」だけで終わらせず、次に何をすればよいかを置く。
// 3画面（プロジェクト一覧・プロジェクト詳細・企画作成）で同じものが要る。
//
// これは表示の話であって制限ではない。プロジェクトと企画作成のAPIは
// サーバー側で必ず 401 を返す(docs/api-spec.md §3)。
export function LoginRequired({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-5">
      <p className="text-[13px] text-gray-700">{children}</p>
      <Link to="/login" className="mt-3 inline-block">
        <Button variant="primary" size="sm">
          ログイン
        </Button>
      </Link>
    </div>
  );
}
