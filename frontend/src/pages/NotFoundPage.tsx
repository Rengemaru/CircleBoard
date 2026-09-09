import { SiteHeader } from "../components/SiteHeader";
import { LinkButton } from "../components/ui/LinkButton";
import { Panel } from "../components/ui/Panel";
import { useCurrentUser } from "../hooks/useCurrentUser";

// 定義していないURLを開いたとき。SPAなのでサーバーは200を返し、
// 何も出さないと真っ白な画面になる。行き先を示す
export function NotFoundPage() {
  const { user } = useCurrentUser();

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl px-6 py-6">
        <Panel>
          <h1 className="text-base font-bold">ページが見つかりません</h1>
          <p className="mt-2 text-[13px] text-gray-700">
            URLが変わったか、削除された可能性があります。
          </p>
          <LinkButton to="/" size="sm" className="mt-4">
            トップへ戻る
          </LinkButton>
        </Panel>
      </main>
    </>
  );
}
