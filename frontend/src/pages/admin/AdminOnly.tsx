import { useEffect, useState } from "react";
import type { ComponentProps } from "react";
import { Text } from "smarthr-ui";
import { LoginRequired } from "../../components/LoginRequired";
import { MemberPage } from "../../components/MemberPage";
import { SessionUnavailable } from "../../components/SessionUnavailable";
import { Note } from "../../components/ui/Note";
import { PageHeading } from "../../components/ui/PageHeading";
import { fetchCurrentUser, type CurrentUser } from "../../api/session";

type Props = {
  title: string;
  // 画面名の下に出す1行。この画面で何ができるかを書く
  subtitle: string;
  // 画面名の右端に置く主操作（例: 「＋ トークンを発行」）
  action?: React.ReactNode;
  // 列の多い表の画面は WIDE(docs/spec-layout-unification.md §5)
  size?: ComponentProps<typeof MemberPage>["size"];
  children: (user: CurrentUser) => React.ReactNode;
};

// 管理者だけが入れる画面。外枠は member 側と同じ MemberPage を使う。
//
// ここでの出し分けは「表示の話」であって制限ではない。
// API 側がすべてのエンドポイントで role: admin を検証している
// (docs/api-spec.md §6)ので、この画面を突破されても操作はできない。
export function AdminOnly({ title, subtitle, action, size, children }: Props) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [checked, setChecked] = useState(false);
  // /api/session は未ログインでも 200 + null を返す(docs/api-spec.md §1)ので、
  // 例外が飛んだときは「未ログイン」ではなく「確かめられなかった」。
  // ここを未ログイン扱いにすると、通信が切れただけでログインを促すことになる(Issue #72)
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchCurrentUser()
      .then(setUser)
      .catch(() => setFailed(true))
      .finally(() => setChecked(true));
  }, []);

  // どの分岐でも PageHeading を通す。通さないと document.title が
  // 書き換わらず、SPA では前に開いていた画面のタブ名が残る(PR #135)
  if (!checked) {
    return (
      <MemberPage user={null}>
        <PageHeading title={title} />
        <Text size="S" color="TEXT_GREY">
          読み込み中…
        </Text>
      </MemberPage>
    );
  }

  if (failed) {
    return (
      <MemberPage user={null} sessionFailed>
        <PageHeading title={title} />
        <SessionUnavailable />
      </MemberPage>
    );
  }

  if (user === null) {
    // 「見えません」で終わらせず、次に何をすればよいかを置く。
    // member 側と同じ部品を使う。シェルが1つになったので案内も1種類でよい(Issue #72)
    return (
      <MemberPage user={null}>
        <PageHeading title={title} />
        <LoginRequired>この画面を見るにはログインが必要です。</LoginRequired>
      </MemberPage>
    );
  }

  if (user.role !== "admin") {
    // ナビゲーションからは隠しているが、URLを直接開いた人には理由を出す。
    // 隠すだけだと「押せないのはなぜか」が分からない
    return (
      <MemberPage user={user}>
        <PageHeading title={title} />
        <Note tone="warning">管理者だけが使える画面です。</Note>
      </MemberPage>
    );
  }

  return (
    <MemberPage user={user} size={size}>
      <PageHeading title={title} subtitle={subtitle} action={action} />
      {children(user)}
    </MemberPage>
  );
}
