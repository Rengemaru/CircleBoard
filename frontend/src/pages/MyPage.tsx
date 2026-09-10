import { useEffect, useState } from "react";
import { DefinitionList, DefinitionListItem, Text } from "smarthr-ui";
import { LoginRequired } from "../components/LoginRequired";
import { MemberPage } from "../components/MemberPage";
import { SessionUnavailable } from "../components/SessionUnavailable";
import { ErrorNote } from "../components/ui/ErrorNote";
import { LinkButton } from "../components/ui/LinkButton";
import { Note } from "../components/ui/Note";
import { PageHeading } from "../components/ui/PageHeading";
import { Panel } from "../components/ui/Panel";
import { MyPostList } from "../components/MyPostList";
import { ProfileBody } from "../components/ProfileBody";
import { Chip } from "../components/ui/Chip";
import { fetchEvents } from "../api/events";
import { fetchProjects } from "../api/projects";
import { fetchMyProfile } from "../api/users";
import { useFlash } from "../lib/flash";
import { useCurrentUser } from "../hooks/useCurrentUser";
import type { CurrentUser } from "../api/session";
import type { EventSummary } from "../types/event";
import type { ProjectSummary } from "../types/project";
import type { Profile } from "../types/user";

// マイページ(docs/spec-my-page.md §4.1)。ログイン必須。
//
// 「アカウント」と「プロフィール」を分けているのは、変えられる人が違うため。
// 名前・メールアドレス・年度・権限は管理者の担当で、本人は変えられない
// (名前を変えられると他人になりすませる)。同じ面に並べると、
// なぜ一部だけ編集できないのかが分からない。
const TITLE = "マイページ";

// 権限は「状態」ではなく「属性」なので Chip で出す（Badge の使い分けはそちら参照）
const ROLE_LABEL: Record<CurrentUser["role"], string> = {
  admin: "管理者",
  member: "メンバー",
  demo: "デモ",
};

export function MyPage() {
  const session = useCurrentUser();
  const { user, loading, failed } = session;
  // 編集画面から戻ってきたときだけ「保存しました」を出す(lib/flash.ts)
  const flash = useFlash();
  const [profile, setProfile] = useState<Profile | null>(null);
  // 自分が owner の企画と、参加中の企画。一覧APIを1回ずつ引いて振り分ける。
  // 専用のエンドポイントは無い(docs/api-spec.md §2/§3)。
  //
  // 初期値を空配列にしない。読み込み中に「企画はありません」と
  // 断定してしまう。null は「まだ読んでいない」
  const [posts, setPosts] = useState<MyPosts | null>(null);
  const [postsError, setPostsError] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (loading || user === null) return;

    fetchMyProfile().then(setProfile).catch(setError);
  }, [loading, user]);

  useEffect(() => {
    if (loading || user === null) return;

    // 失敗を空配列に倒すと、通信できなかったのか企画が0件なのかを
    // 見分けられない。再試行の手がかりも消える(Issue #52)
    Promise.all([fetchEvents(), fetchProjects()])
      .then(([events, projects]) => setPosts(splitPosts(events, projects, user.id)))
      .catch(() => setPostsError(true));
  }, [loading, user]);

  // どの分岐でも PageHeading を通す。通さないと document.title が
  // 書き換わらず、SPA では前の画面のタブ名が残る(PR #135)
  if (loading) {
    return (
      <MemberPage session={session}>
        <PageHeading title={TITLE} />
        <Text size="S" color="TEXT_GREY">
          読み込み中…
        </Text>
      </MemberPage>
    );
  }

  // 「未ログイン」と「確かめられなかった」を分ける(Issue #72)
  if (failed) {
    return (
      <MemberPage session={session}>
        <PageHeading title={TITLE} />
        <SessionUnavailable />
      </MemberPage>
    );
  }

  if (user === null) {
    return (
      <MemberPage session={session}>
        <PageHeading title={TITLE} />
        <LoginRequired>マイページを見るにはログインが必要です。</LoginRequired>
      </MemberPage>
    );
  }

  return (
    <MemberPage session={session}>
      <PageHeading title={TITLE} subtitle="自分のアカウントとプロフィールを確認します" />

      {flash !== null && <Note tone="success">{flash}</Note>}
      {error !== null && <ErrorNote error={error} fallback="プロフィールを読み込めませんでした" />}

      <Panel title="アカウント">
        <DefinitionList>
          <DefinitionListItem term="名前" maxColumns={2}>
            {user.name}
          </DefinitionListItem>
          <DefinitionListItem term="メールアドレス" maxColumns={2}>
            {profile?.email ?? "—"}
          </DefinitionListItem>
          {/* 学年を主にし、年度はその下に添える。学年は他の画面でも出るので
              こちらを先に置き、年度は登録内容の確認として残す。
              学年の算出はサーバー側(backend の User#grade) */}
          <DefinitionListItem term="学年" maxColumns={2}>
            {profile === null ? (
              "—"
            ) : (
              <>
                {profile.grade ?? (profile.graduated ? "卒業生" : "—")}
                <span className="ml-2 text-xs text-gray-500">
                  {profile.enrollment_year}年入学 / {profile.graduation_year}年卒業
                </span>
              </>
            )}
          </DefinitionListItem>
          <DefinitionListItem term="権限" maxColumns={2}>
            <Chip>{ROLE_LABEL[user.role]}</Chip>
          </DefinitionListItem>
        </DefinitionList>
        {/* 「編集できません」だけだと、変えたい人がどこへ行けばよいか分からない */}
        <Text size="S" color="TEXT_GREY" as="p" className="mt-4">
          この欄は自分では変更できません。変更が必要なときは部長に依頼してください。
        </Text>
      </Panel>

      <Panel
        title="プロフィール"
        action={
          <LinkButton to="/me/edit" size="sm">
            編集する
          </LinkButton>
        }
      >
        {profile === null ? (
          <Text size="S" color="TEXT_GREY">
            読み込み中…
          </Text>
        ) : (
          <ProfileBody
            profile={profile}
            emptyMessage="まだ何も書かれていません。学科や使える技術を書いておくと、企画に誘われやすくなります。"
          />
        )}
      </Panel>

      <Panel title="自分の企画">
        <PostsSection
          error={postsError}
          group={posts?.mine ?? null}
          empty="いま募集中の企画はありません。"
        />
      </Panel>

      <Panel title="参加中の企画">
        <PostsSection
          error={postsError}
          group={posts?.joined ?? null}
          empty="いま参加中の企画はありません。"
        />
      </Panel>
    </MemberPage>
  );
}

type PostGroup = {
  events: EventSummary[];
  projects: ProjectSummary[];
};

type MyPosts = {
  mine: PostGroup;
  joined: PostGroup;
};

// 一覧APIの結果を「自分の企画」と「参加中の企画」に振り分ける。
//
// 自分が owner のものは参加中に入れない。owner は自動で参加者になる
// わけではないが、自分の企画に参加表明することはできる。両方に出すと
// 同じ企画が1画面に2回並ぶ。
//
// current_user_joined は未ログインではキーごと存在しないが、この画面は
// ログイン必須なので必ず入っている(docs/api-spec.md §2/§3)
function splitPosts(events: EventSummary[], projects: ProjectSummary[], userId: number): MyPosts {
  const ownsEvent = (event: EventSummary) => event.owner?.id === userId;
  const ownsProject = (project: ProjectSummary) => project.owner?.id === userId;

  return {
    mine: {
      events: events.filter(ownsEvent),
      projects: projects.filter(ownsProject),
    },
    joined: {
      events: events.filter((event) => event.current_user_joined === true && !ownsEvent(event)),
      projects: projects.filter(
        (project) => project.current_user_joined === true && !ownsProject(project),
      ),
    },
  };
}

// 読み込み中・失敗・0件・一覧の4つの状態を1箇所で出し分ける。
// 「自分の企画」と「参加中の企画」で同じ分岐を2回書くと、片方だけ
// 直し忘れる
function PostsSection({
  error,
  group,
  empty,
}: {
  error: boolean;
  group: PostGroup | null;
  empty: string;
}) {
  if (error) {
    return (
      <Text size="S" color="TEXT_GREY">
        企画を読み込めませんでした。ページを再読み込みしてください。
      </Text>
    );
  }

  if (group === null) {
    return (
      <Text size="S" color="TEXT_GREY">
        読み込み中…
      </Text>
    );
  }

  return <MyPostList events={group.events} projects={group.projects} emptyMessage={empty} />;
}
