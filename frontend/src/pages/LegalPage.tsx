import { SiteHeader } from "../components/SiteHeader";
import { useCurrentUser } from "../hooks/useCurrentUser";

// 利用規約(wireframes/wireframe-member.html ⑧)。ゲスト可。
// 同意フローは作らない。静的ページの表示のみ(CLAUDE.md §10)。
export function LegalPage() {
  const { user } = useCurrentUser();

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl space-y-6 p-6">
        <h1 className="text-2xl font-bold">利用規約</h1>

        <section className="space-y-2 text-sm">
          <h2 className="font-bold">このサイトについて</h2>
          <p>
            CircleBoard は情報系学生サークルの企画掲示板です。部室のディスプレイに
            表示するサイネージ機能を兼ねています。
          </p>
        </section>

        <section className="space-y-2 text-sm">
          <h2 className="font-bold">公開される情報</h2>
          <p>
            イベントのタイトル・概要・開催日時・開催場所・タグは、ログインしていない
            人にも公開されます。企画者の氏名と参加者一覧は、ログインした人にだけ
            表示されます。プロジェクトはログインしないと閲覧できません。
          </p>
        </section>

        <section className="space-y-2 text-sm">
          <h2 className="font-bold">アカウント</h2>
          <p>
            アカウントは部長が発行します。パスワードを忘れた場合も部長に連絡して
            ください。
          </p>
        </section>

        <section className="space-y-2 text-sm">
          <h2 className="font-bold">お問い合わせ</h2>
          <p>サークルの部長までご連絡ください。</p>
        </section>
      </main>
    </>
  );
}
