import { Base, Heading, Section, Stack, Text } from "smarthr-ui";
import { MemberPage } from "../components/MemberPage";
import { PageHeading } from "../components/ui/PageHeading";
import { Panel } from "../components/ui/Panel";
import { SectionHeading } from "../components/ui/SectionHeading";
import { useCurrentUser } from "../hooks/useCurrentUser";

// よくある質問・利用規約(wireframes/wireframe-member.html ⑧)。ゲスト可。
//
// 静的ページとして実装する。DBもCMSも作らない。内容の更新はコード変更 +
// デプロイで行う。同意フローは作らない、表示のみ(CLAUDE.md §10)。
export function LegalPage() {
  const { user, failed } = useCurrentUser();

  return (
    <MemberPage user={user} sessionFailed={failed}>
      <PageHeading title="よくある質問・利用規約" />

      {/* セクション間は 32px に揃える(Panel と同じ基準) */}
      <Section className="mb-8">
        <SectionHeading>よくある質問</SectionHeading>
        <Stack gap="XS">
          <Faq q="アカウントはどうやって作りますか？">
            {"部長に連絡してください。管理者が発行します。このサイトに新規登録の機能はありません。"}
          </Faq>
          <Faq q="イベントは誰でも参加できますか？">
            閲覧は誰でもできます。参加表明にはログインが必要です。
          </Faq>
          <Faq q="プロジェクトが見えないのはなぜですか？">
            {
              "プロジェクトはログインした人だけが閲覧できます。継続的に活動するものなので、外部に公開していません。"
            }
          </Faq>
          <Faq q="パスワードを忘れました。">
            部長に連絡してください。再発行はこのサイトからはできません。
          </Faq>
          <Faq q="参加をキャンセルできますか？">
            {
              "イベント詳細から「参加をキャンセル」を押してください。空いた枠はすぐに他の人が使えるようになります。"
            }
          </Faq>
          <Faq q="部室のディスプレイに出ている画面は何ですか？">
            {
              "サイネージ表示です。開催が近いイベントを自動で並べています。表示する端末は管理者が登録します。"
            }
          </Faq>
        </Stack>
      </Section>

      <Section>
        <SectionHeading>利用規約</SectionHeading>
        <Panel>
          <Stack gap="S">
            <Article title="このサイトについて">
              {
                "CircleBoard は情報系学生サークルの企画掲示板です。部室のディスプレイに表示するサイネージ機能を兼ねています。"
              }
            </Article>

            <Article title="公開される情報">
              {
                "イベントのタイトル・概要・開催日時・開催場所・タグは、ログインしていない人にも公開されます。企画者の氏名と参加者一覧は、ログインした人にだけ表示されます。プロジェクトはログインしないと閲覧できません。"
              }
            </Article>

            <Article title="アカウント">
              {
                "アカウントは部長が発行します。パスワードを忘れた場合も部長に連絡してください。アカウントを他の人と共有しないでください。"
              }
            </Article>

            <Article title="投稿していただく内容について">
              {
                "サークルの活動に関係のない企画、他の人が不快に感じる内容は投稿しないでください。管理者が確認のうえ非公開にすることがあります。"
              }
            </Article>

            <Article title="お問い合わせ">サークルの部長までご連絡ください。</Article>
          </Stack>
        </Panel>
      </Section>
    </MemberPage>
  );
}

// 本文は文字列リテラルで渡している。JSX のテキストは改行が半角スペースに
// 変わるため、日本語だと語の途中に空白が入る（「新規登録の 機能」）
// 質問1つ = 1セクション。Section で囲むと Heading のレベルが
// 入れ子の深さから決まる(「よくある質問」の下なので h3 になる)。
// 見出しにするのは、スクリーンリーダーで質問間を飛べるようにするため(Issue #58)
function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <Section>
      <Base padding={1}>
        <Stack gap="XXS">
          <Heading type="subBlockTitle">Q. {q}</Heading>
          <Text size="S" color="TEXT_GREY">
            A. {children}
          </Text>
        </Stack>
      </Base>
    </Section>
  );
}

// こちらは Section で囲まない。囲む Panel が既に Section 1つ分に
// なっているので、さらに囲むと見出しが h4 まで下がる（実際に下がった）。
// 「よくある質問」側の Faq と同じ h3 に揃える
function Article({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Stack gap="XXS">
      <Heading type="subBlockTitle">{title}</Heading>
      <Text size="S" color="TEXT_GREY" leading="RELAXED">
        {children}
      </Text>
    </Stack>
  );
}
