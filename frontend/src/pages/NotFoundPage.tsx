import { Link } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import { useCurrentUser } from "../hooks/useCurrentUser";

// 定義していないURLを開いたとき。SPAなのでサーバーは200を返し、
// 何も出さないと真っ白な画面になる。行き先を示す
export function NotFoundPage() {
  const { user } = useCurrentUser();

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-bold">ページが見つかりません</h1>
        <p className="mt-2 text-gray-700">
          URLが変わったか、削除された可能性があります。
        </p>
        <Link to="/" className="mt-4 inline-block underline">
          トップへ戻る
        </Link>
      </main>
    </>
  );
}
