import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FormControl, Input, Stack, StatusLabel, Text, Textarea } from "smarthr-ui";
import { LoginRequired } from "../components/LoginRequired";
import { MemberPage } from "../components/MemberPage";
import { SessionUnavailable } from "../components/SessionUnavailable";
import { Button } from "../components/ui/Button";
import { ErrorNote } from "../components/ui/ErrorNote";
import { PageHeading } from "../components/ui/PageHeading";
import { Panel } from "../components/ui/Panel";
import { fetchMyProfile, updateMyProfile } from "../api/users";
import { useCurrentUser } from "../hooks/useCurrentUser";
import type { Profile } from "../types/user";

// プロフィールの編集(docs/spec-my-page.md §4.2)。ログイン必須。
//
// 編集できるのはプロフィールだけ。名前・メールアドレス・年度・権限は
// マイページに出しているが、ここには置かない。サーバーも受け取らない
// (名前を変えられると他人になりすませる)。
const TITLE = "プロフィールを編集";

// 上限はサーバー側のモデルが正(docs/spec-my-page.md §6.1)。
// ここに書くのは「書きながら分かる」ためで、検証を肩代わりするものではない
const BIO_MAX = 500;
const DEPARTMENT_MAX = 50;

// 必須と任意はステータスラベルで示す。ラベルの文字に「（任意）」と
// 混ぜると、書き方が2通りになる(/create と同じ)
const OPTIONAL = <StatusLabel type="grey">任意</StatusLabel>;

export function MyProfileEditPage() {
  const navigate = useNavigate();
  const { user, loading, failed } = useCurrentUser();
  // 読み込む前のフォームを触らせない。空欄が入った状態で保存されると、
  // 書いてあった内容が消える
  const [profile, setProfile] = useState<Profile | null>(null);
  const [department, setDepartment] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || user === null) return;

    fetchMyProfile()
      .then((loaded) => {
        setProfile(loaded);
        // API は未入力を null で返す。textarea の value に null は入れられない
        setDepartment(loaded.department ?? "");
        setBio(loaded.bio ?? "");
      })
      .catch(setError);
  }, [loading, user]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await updateMyProfile({ department, bio });
      // 保存した結果は /me で見せる。編集画面に留まると、
      // 反映されたのかどうかが分からない(Issue #43)
      navigate("/me", { state: { saved: true } });
    } catch (e: unknown) {
      setError(e);
      setBusy(false);
    }
  }

  // どの分岐でも PageHeading を通す。通さないと document.title が
  // 書き換わらず、SPA では前の画面のタブ名が残る(PR #135)
  if (loading) {
    return (
      <MemberPage user={null} size="NARROW">
        <PageHeading title={TITLE} />
        <Text size="S" color="TEXT_GREY">
          読み込み中…
        </Text>
      </MemberPage>
    );
  }

  if (failed) {
    return (
      <MemberPage user={null} size="NARROW" sessionFailed>
        <PageHeading title={TITLE} />
        <SessionUnavailable />
      </MemberPage>
    );
  }

  if (user === null) {
    return (
      <MemberPage user={null} size="NARROW">
        <PageHeading title={TITLE} />
        <LoginRequired>プロフィールの編集にはログインが必要です。</LoginRequired>
      </MemberPage>
    );
  }

  // フォーム1枚の画面なので NARROW(docs/spec-layout-unification.md §5)
  return (
    <MemberPage user={user} size="NARROW">
      <PageHeading title={TITLE} subtitle="書いた内容は、ログインした部員だけが見られます" />

      {error !== null && <ErrorNote error={error} fallback="保存できませんでした" />}

      <form onSubmit={submit}>
        <Panel title="プロフィール">
          {profile === null ? (
            <Text size="S" color="TEXT_GREY">
              読み込み中…
            </Text>
          ) : (
            <Stack gap={1.25}>
              <FormControl
                label="学科"
                statusLabels={OPTIONAL}
                exampleMessage="情報工学科 / 経営学部 経営学科"
              >
                <Input
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  maxLength={DEPARTMENT_MAX}
                  width="100%"
                />
              </FormControl>

              {/* maxLetters は「あと何文字」を出すだけで入力は止めない。
                  送信して初めて長すぎたと分かるのは、書き終わったあとに
                  削れと言われるのと同じ(docs/spec-my-page.md §4.2)。
                  止めないのは、貼り付けた文章が黙って切られる方が困るため */}
              <FormControl
                label="自己紹介"
                statusLabels={OPTIONAL}
                helpMessage="何を作っているか、何に興味があるかを書いておくと、企画に誘われやすくなります"
              >
                <Textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={8}
                  maxLetters={BIO_MAX}
                  width="100%"
                />
              </FormControl>
            </Stack>
          )}
        </Panel>

        <div className="flex gap-2">
          {/* 読み込めていないうちは押せない。空欄で上書きされるのを防ぐ */}
          <Button
            type="submit"
            variant="primary"
            busy={busy}
            busyLabel="保存中…"
            disabled={profile === null}
          >
            保存する
          </Button>
          <Button variant="ghost" onClick={() => navigate("/me")}>
            キャンセル
          </Button>
        </div>
      </form>
    </MemberPage>
  );
}
