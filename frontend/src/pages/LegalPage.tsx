import { SiteHeader } from "../components/SiteHeader";
import { useCurrentUser } from "../hooks/useCurrentUser";

// よくある質問・利用規約(wireframes/wireframe-member.html ⑧)。ゲスト可。
//
// 静的ページとして実装する。DBもCMSも作らない。内容の更新はコード変更 +
// デプロイで行う。同意フローは作らない、表示のみ(CLAUDE.md §10)。
export function LegalPage() {
  const { user } = useCurrentUser();

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl space-y-8 p-6">
        <h1 className="text-2xl font-bold">よくある質問・利用規約</h1>

        <section className="space-y-4">
          <h2 className="text-lg font-bold">よくある質問</h2>
          <Faq q="アカウントはどうやって作りますか？">
            部長に連絡してください。管理者が発行します。このサイトに新規登録の
            機能はありません。
          </Faq>
          <Faq q="イベントは誰でも参加できますか？">
            閲覧は誰でもできます。参加表明にはログインが必要です。
          </Faq>
          <Faq q="プロジェクトが見えないのはなぜですか？">
            プロジェクトはログインした人だけが閲覧できます。継続的に活動する
            ものなので、外部に公開していません。
          </Faq>
          <Faq q="パスワードを忘れました。">
            部長に連絡してください。再発行はこのサイトからはできません。
          </Faq>
          <Faq q="参加をキャンセルできますか？">
            イベント詳細から「参加をキャンセル」を押してください。空いた枠は
            すぐに他の人が使えるようになります。
          </Faq>
          <Faq q="部室のディスプレイに出ている画面は何ですか？">
            サイネージ表示です。開催が近いイベントを自動で並べています。
            表示する端末は管理者が登録します。
          </Faq>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold">利用規約</h2>

          <Article title="このサイトについて">
            CircleBoard は情報系学生サークルの企画掲示板です。部室のディスプレイに
            表示するサイネージ機能を兼ねています。
          </Article>

          <Article title="公開される情報">
            イベントのタイトル・概要・開催日時・開催場所・タグは、ログインして
            いない人にも公開されます。企画者の氏名と参加者一覧は、ログインした
            人にだけ表示されます。プロジェクトはログインしないと閲覧できません。
          </Article>

          <Article title="アカウント">
            アカウントは部長が発行します。パスワードを忘れた場合も部長に連絡して
            ください。アカウントを他の人と共有しないでください。
          </Article>

          <Article title="投稿していただく内容について">
            サークルの活動に関係のない企画、他の人が不快に感じる内容は投稿しないで
            ください。管理者が確認のうえ非公開にすることがあります。
          </Article>

          <Article title="お問い合わせ">サークルの部長までご連絡ください。</Article>
        </section>
      </main>
    </>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-gray-200 p-4">
      <p className="font-bold">Q. {q}</p>
      <p className="mt-1 text-sm text-gray-700">A. {children}</p>
    </div>
  );
}

function Article({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <h3 className="font-bold">{title}</h3>
      <p className="text-sm text-gray-700">{children}</p>
    </div>
  );
}
