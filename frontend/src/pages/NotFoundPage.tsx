import { SiteHeader } from "../components/SiteHeader";
import { LinkButton } from "../components/ui/LinkButton";
import { PageHeading } from "../components/ui/PageHeading";
import { Panel } from "../components/ui/Panel";
import { useCurrentUser } from "../hooks/useCurrentUser";

// 定義していないURLを開いたとき。SPAなのでサーバーは200を返し、
// 何も出さないと真っ白な画面になる。行き先を示す
export function NotFoundPage() {
  const { user, failed } = useCurrentUser();

  return (
    <>
      <SiteHeader user={user} sessionFailed={failed} />
      <main className="mx-auto max-w-3xl px-6 py-6">
        {/* h1 を自前で書くと document.title が変わらず、SPA では
            前に開いていた画面のタブ名が残る */}
        <PageHeading title="ページが見つかりません" />
        <Panel>
          <p className="text-[13px] text-gray-700">URLが変わったか、削除された可能性があります。</p>
          <LinkButton to="/" size="sm" className="mt-4">
            トップへ戻る
          </LinkButton>
        </Panel>
      </main>
    </>
  );
}
