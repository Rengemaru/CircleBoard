import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Text } from "smarthr-ui";
import { LoginRequired } from "../components/LoginRequired";
import { MemberPage } from "../components/MemberPage";
import { MyPostList } from "../components/MyPostList";
import { ProfileBody } from "../components/ProfileBody";
import { SessionUnavailable } from "../components/SessionUnavailable";
import { ErrorNote } from "../components/ui/ErrorNote";
import { PageHeading } from "../components/ui/PageHeading";
import { Panel } from "../components/ui/Panel";
import { fetchEvents } from "../api/events";
import { fetchProjects } from "../api/projects";
import { fetchProfile } from "../api/users";
import { useCurrentUser } from "../hooks/useCurrentUser";
import type { EventSummary } from "../types/event";
import type { ProjectSummary } from "../types/project";
import type { Profile } from "../types/user";

// 他の人のプロフィール(docs/spec-my-page.md §4.3)。ログイン必須。
//
// 参加中の企画は出さない。自分の画面には出すのに他人の画面には出さない、
// という差を付けているのは、誰がどこに参加しているかを一覧できると、
// 部内であっても居心地の悪さが出るため。
//
// メールアドレスも権限も出さない。サーバーがキーごと落としている
// (ProfileSerializer)ので、ここで隠しているわけではない(CLAUDE.md §3-2)。
//
// key を付けて :id ごとに作り直す。付けないと、戻る・進むで別の人へ
// 移ったときに前の人のプロフィールが一瞬出る。読み込みのたびに
// 状態を手で消して回るより、作り直す方が消し忘れが起きない
export function UserProfilePage() {
  const { id } = useParams();

  return <Profile key={id} id={id} />;
}

function Profile({ id }: { id: string | undefined }) {
  const session = useCurrentUser();
  const { user, loading, failed } = session;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<{
    events: EventSummary[];
    projects: ProjectSummary[];
  } | null>(null);
  const [postsError, setPostsError] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // URL の :id は手で書き換えられる。数でなければ引かない
  const userId = Number(id);
  const validId = Number.isInteger(userId) && userId > 0;

  useEffect(() => {
    if (loading || user === null || !validId) return;

    fetchProfile(userId).then(setProfile).catch(setError);
  }, [loading, user, userId, validId]);

  useEffect(() => {
    if (loading || user === null || !validId) return;

    Promise.all([fetchEvents(), fetchProjects()])
      .then(([events, projects]) => {
        setPosts({
          events: events.filter((event) => event.owner?.id === userId),
          projects: projects.filter((project) => project.owner?.id === userId),
        });
      })
      .catch(() => setPostsError(true));
  }, [loading, user, userId, validId]);

  // 名前が分かるまではタブに「プロフィール」と出す。
  // 出さないと、前に開いていた画面のタブ名が残る(PR #135)
  const title = profile?.name ?? "プロフィール";

  if (loading) {
    return (
      <MemberPage session={session}>
        <PageHeading title={title} />
        <Text size="S" color="TEXT_GREY">
          読み込み中…
        </Text>
      </MemberPage>
    );
  }

  if (failed) {
    return (
      <MemberPage session={session}>
        <PageHeading title={title} />
        <SessionUnavailable />
      </MemberPage>
    );
  }

  if (user === null) {
    return (
      <MemberPage session={session}>
        <PageHeading title={title} />
        <LoginRequired>部員のプロフィールを見るにはログインが必要です。</LoginRequired>
      </MemberPage>
    );
  }

  return (
    <MemberPage session={session}>
      <PageHeading title={title} />

      {!validId ? (
        <ErrorNote error={null} fallback="ユーザーが見つかりません" />
      ) : error !== null ? (
        <ErrorNote error={error} fallback="プロフィールを読み込めませんでした" />
      ) : (
        <>
          <Panel title="プロフィール">
            {profile === null ? (
              <Text size="S" color="TEXT_GREY">
                読み込み中…
              </Text>
            ) : (
              <ProfileBody profile={profile} emptyMessage="まだ何も書かれていません。" />
            )}
          </Panel>

          <Panel title="この人の企画">
            {postsError ? (
              <Text size="S" color="TEXT_GREY">
                企画を読み込めませんでした。ページを再読み込みしてください。
              </Text>
            ) : posts === null ? (
              <Text size="S" color="TEXT_GREY">
                読み込み中…
              </Text>
            ) : (
              <MyPostList
                events={posts.events}
                projects={posts.projects}
                emptyMessage="いま募集中の企画はありません。"
              />
            )}
          </Panel>
        </>
      )}
    </MemberPage>
  );
}
