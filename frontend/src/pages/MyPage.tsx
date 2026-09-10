import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DefinitionList, DefinitionListItem, Cluster, Text, TextLink } from "smarthr-ui";
import { LoginRequired } from "../components/LoginRequired";
import { MemberPage } from "../components/MemberPage";
import { SessionUnavailable } from "../components/SessionUnavailable";
import { Chip } from "../components/ui/Chip";
import { ErrorNote } from "../components/ui/ErrorNote";
import { LinkButton } from "../components/ui/LinkButton";
import { Note } from "../components/ui/Note";
import { PageHeading } from "../components/ui/PageHeading";
import { Panel } from "../components/ui/Panel";
import { MyPostList } from "../components/MyPostList";
import { fetchEvents } from "../api/events";
import { fetchProjects } from "../api/projects";
import { fetchMyProfile } from "../api/users";
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
  const { user, loading, failed } = useCurrentUser();
  // 編集画面から戻ってきたときだけ「保存しました」を出す。
  // 保存したかどうかは遷移した側しか知らないので、遷移の state で受け取る。
  // クエリパラメータにすると、URLを共有したときにも出てしまう
  const location = useLocation();
  const navigate = useNavigate();
  const [saved] = useState(() => isSaved(location.state));
  const [profile, setProfile] = useState<Profile | null>(null);
  // 自分が owner の企画。一覧APIを引いて自分の分だけ残す。
  // 「自分の企画」専用のエンドポイントは無い(docs/api-spec.md §2/§3)。
  //
  // 初期値を空配列にしない。読み込み中に「企画はありません」と
  // 断定してしまう。null は「まだ読んでいない」
  const [myPosts, setMyPosts] = useState<{
    events: EventSummary[];
    projects: ProjectSummary[];
  } | null>(null);
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
      .then(([events, projects]) => {
        setMyPosts({
          events: events.filter((event) => event.owner?.id === user.id),
          projects: projects.filter((project) => project.owner?.id === user.id),
        });
      })
      .catch(() => setPostsError(true));
  }, [loading, user]);

  // 出したら履歴から消す。state は history.state に入るので、
  // そのままだと再読み込みのたびに「保存しました」が出続ける（実際に出た）。
  // 表示そのものは saved を useState で受け取った時点で確定しているので、
  // ここで state を落としても消えない
  useEffect(() => {
    if (!isSaved(location.state)) return;

    navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  // どの分岐でも PageHeading を通す。通さないと document.title が
  // 書き換わらず、SPA では前の画面のタブ名が残る(PR #135)
  if (loading) {
    return (
      <MemberPage user={null}>
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
      <MemberPage user={null} sessionFailed>
        <PageHeading title={TITLE} />
        <SessionUnavailable />
      </MemberPage>
    );
  }

  if (user === null) {
    return (
      <MemberPage user={null}>
        <PageHeading title={TITLE} />
        <LoginRequired>マイページを見るにはログインが必要です。</LoginRequired>
      </MemberPage>
    );
  }

  return (
    <MemberPage user={user}>
      <PageHeading title={TITLE} subtitle="自分のアカウントとプロフィールを確認します" />

      {saved && <Note tone="success">プロフィールを保存しました。</Note>}
      {error !== null && <ErrorNote error={error} fallback="プロフィールを読み込めませんでした" />}

      <Panel title="アカウント">
        <DefinitionList>
          <DefinitionListItem term="名前" maxColumns={2}>
            {user.name}
          </DefinitionListItem>
          <DefinitionListItem term="メールアドレス" maxColumns={2}>
            {profile?.email ?? "—"}
          </DefinitionListItem>
          <DefinitionListItem term="入学・卒業年度" maxColumns={2}>
            {profile === null
              ? "—"
              : `${profile.enrollment_year}年入学 / ${profile.graduation_year}年卒業`}
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
          <ProfileBody profile={profile} />
        )}
      </Panel>

      <Panel title="自分の企画">
        {postsError ? (
          <Text size="S" color="TEXT_GREY">
            企画を読み込めませんでした。ページを再読み込みしてください。
          </Text>
        ) : myPosts === null ? (
          <Text size="S" color="TEXT_GREY">
            読み込み中…
          </Text>
        ) : (
          <MyPostList events={myPosts.events} projects={myPosts.projects} />
        )}
      </Panel>
    </MemberPage>
  );
}

function ProfileBody({ profile }: { profile: Profile }) {
  // 空欄を4つ並べない。何も書いていない人には、書くと何が起きるかを出す
  // (Issue #53 と同じ考え方)
  if (isEmpty(profile)) {
    return (
      <Text size="S" color="TEXT_GREY">
        まだ何も書かれていません。学科や使える技術を書いておくと、企画に誘われやすくなります。
      </Text>
    );
  }

  return (
    <DefinitionList>
      <DefinitionListItem term="学科" maxColumns={1}>
        {profile.department ?? "—"}
      </DefinitionListItem>
      <DefinitionListItem term="自己紹介" maxColumns={1}>
        {/* 改行はそのまま出すが、HTML としては解釈しない(React が既定でエスケープする) */}
        <span className="whitespace-pre-wrap">{profile.bio ?? "—"}</span>
      </DefinitionListItem>
      <DefinitionListItem term="使える技術" maxColumns={1}>
        {profile.tags.length === 0 ? (
          "—"
        ) : (
          <Cluster gap={0.5}>
            {profile.tags.map((tag) => (
              <Chip key={tag.id}>{tag.name}</Chip>
            ))}
          </Cluster>
        )}
      </DefinitionListItem>
      <DefinitionListItem term="リンク" maxColumns={1}>
        {profile.links.length === 0 ? "—" : <ProfileLinks profile={profile} />}
      </DefinitionListItem>
    </DefinitionList>
  );
}

// リンクの並びは箇条書きなので ul/li で出す。
//
// inline-flex を当てているのは、Tailwind の preflight が svg を
// display: block にしているため。TextLink の「別タブで開く」アイコンが
// ブロックになり、そのままだとラベルの下に落ちてリンクが2行になる
// （実測 47x35px）。リンクを1つずつ確認したときに見つけた
function ProfileLinks({ profile }: { profile: Profile }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1">
      {profile.links.map((link) => (
        // 画面に出すのはラベル。URL をそのまま出さない(docs/spec-my-page.md §6.2)。
        // noopener が無いと、開いた先から元のタブを操作できる
        <li key={link.id}>
          <TextLink
            href={link.url}
            target="_blank"
            rel="noreferrer noopener"
            size="S"
            className="inline-flex items-center"
          >
            {link.label}
          </TextLink>
        </li>
      ))}
    </ul>
  );
}

// 4項目すべてが未入力かどうか。department と bio は API が null で返すが、
// 画面から空文字が入ることもあるので両方を空として扱う
function isEmpty(profile: Profile): boolean {
  return (
    (profile.department ?? "") === "" &&
    (profile.bio ?? "") === "" &&
    profile.tags.length === 0 &&
    profile.links.length === 0
  );
}

// react-router の state は any なので、そのまま .saved を読むと型が消える
// (CLAUDE.md §4「any 禁止。unknown + 絞り込み」)
function isSaved(state: unknown): boolean {
  return typeof state === "object" && state !== null && "saved" in state && state.saved === true;
}
