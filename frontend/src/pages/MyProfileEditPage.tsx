import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Cluster, FormControl, Input, Stack, StatusLabel, Text } from "smarthr-ui";
import { LoginRequired } from "../components/LoginRequired";
import { MemberPage } from "../components/MemberPage";
import { SessionUnavailable } from "../components/SessionUnavailable";
import { Button } from "../components/ui/Button";
import { ErrorNote } from "../components/ui/ErrorNote";
import { PageHeading } from "../components/ui/PageHeading";
import { Panel } from "../components/ui/Panel";
import { Note } from "../components/ui/Note";
import { fetchTags } from "../api/tags";
import { TagPicker } from "../components/TagPicker";
import { MarkdownField } from "../components/MarkdownField";
import { PasswordChangeDialog } from "../components/PasswordChangeDialog";
import { changeMyPassword } from "../api/users";
import { MAX_TAGS_PER_RESOURCE } from "../lib/tags";
import { fetchMyProfile, updateMyProfile } from "../api/users";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { flashState } from "../lib/flash";
import { MAX_LINKS, emptyRow, toPayload, validateLinks, type LinkRow } from "../lib/profileLinks";
import type { Tag } from "../types/event";
import type { Profile } from "../types/user";

// プロフィールの編集(docs/spec-my-page.md §4.2)。ログイン必須。
//
// 編集できるのはプロフィールだけ。名前・メールアドレス・年度・権限は
// マイページに出しているが、ここには置かない。サーバーも受け取らない
// (名前を変えられると他人になりすませる)。
const TITLE = "プロフィールを編集";

// 上限はサーバー側のモデルが正(docs/spec-my-page.md §6.1)。
// ここに書くのは「書きながら分かる」ためで、検証を肩代わりするものではない
const BIO_MAX = 1000;
const DEPARTMENT_MAX = 50;
const PRONOUNS_MAX = 20;
const LABEL_MAX = 20;
// サーバー側の検証と同じ値(backend の User::MAX_NAME_LENGTH)
const NAME_MAX = 50;
// サーバー側の検証と同じ値(backend の UserLink::MAX_URL_LENGTH)
const URL_MAX = 2000;
// サーバー側と同じ値を1か所から使う
const MAX_TAGS = MAX_TAGS_PER_RESOURCE;

// 必須と任意はステータスラベルで示す。ラベルの文字に「（任意）」と
// 混ぜると、書き方が2通りになる(/create と同じ)
const OPTIONAL = <StatusLabel type="grey">任意</StatusLabel>;
const REQUIRED = <StatusLabel type="red">必須</StatusLabel>;

export function MyProfileEditPage() {
  const navigate = useNavigate();
  const session = useCurrentUser();
  const { user, loading, failed } = session;
  // 読み込む前のフォームを触らせない。空欄が入った状態で保存されると、
  // 書いてあった内容が消える
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [bio, setBio] = useState("");
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagsError, setTagsError] = useState(false);
  // 選んだタグは名前で持つ。まだ存在しないタグはIDを持てないため(docs/spec-tags.md §3.7)
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([]);

  const [links, setLinks] = useState<LinkRow[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  // パスワードはプロフィールと別で保存する。要求するものも、間違えたときに
  // 返るものも違う。エラーもダイアログの中だけで完結させる
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<unknown>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);

  // 開くたびに前回の結果を消す。残すと、何も送っていないのに前のエラーが
  // 出ている状態でダイアログが開く
  function openPasswordDialog() {
    setPasswordError(null);
    setPasswordChanged(false);
    setChangingPassword(true);
  }

  async function submitPassword(currentPassword: string, password: string) {
    setPasswordBusy(true);
    setPasswordError(null);
    try {
      await changeMyPassword(currentPassword, password);
      setChangingPassword(false);
      setPasswordChanged(true);
    } catch (e: unknown) {
      setPasswordError(e);
    } finally {
      setPasswordBusy(false);
    }
  }

  useEffect(() => {
    if (loading || user === null) return;

    fetchMyProfile()
      .then((loaded) => {
        setProfile(loaded);
        // API は未入力を null で返す。textarea の value に null は入れられない
        setName(loaded.name);
        setDepartment(loaded.department ?? "");
        setPronouns(loaded.pronouns ?? "");
        setBio(loaded.bio ?? "");
        setSelectedTagNames(loaded.tags.map((tag) => tag.name));
        // 1行も無い人にも入力欄を1つ出す。「行を追加」を押さないと
        // 何も書けない画面にしない
        setLinks(
          loaded.links.length === 0
            ? [emptyRow()]
            : loaded.links.map(({ label, url }) => ({ label, url })),
        );
      })
      .catch(setError);
  }, [loading, user]);

  useEffect(() => {
    if (loading || user === null) return;

    // 失敗を空配列に倒すと「選べるタグがありません」と断定してしまう。
    // 実際は通信できていないだけかもしれない(Issue #52)
    fetchTags("profile")
      .then(setTags)
      .catch(() => setTagsError(true));
  }, [loading, user]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    // 送ってから断られるまで待たせない。ただしサーバー側の検証が正で、
    // ここを通ったから保存できるとは限らない(docs/spec-my-page.md §6.1)
    const invalid = validateLinks(links);
    if (invalid !== null) {
      setError(new Error(invalid));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await updateMyProfile({
        name,
        department,
        pronouns,
        bio,
        tag_names: selectedTagNames,
        links: toPayload(links),
      });
      // 保存した結果は /me で見せる。編集画面に留まると、
      // 反映されたのかどうかが分からない(Issue #43)
      navigate("/me", { state: flashState("プロフィールを保存しました。") });
    } catch (e: unknown) {
      setError(e);
      setBusy(false);
    }
  }

  function updateLink(index: number, patch: Partial<LinkRow>) {
    setLinks((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeLink(index: number) {
    // 最後の1行を消したら空の行に戻す。行が0になると、
    // 「行を追加」を押すまで何も書けない画面になる
    setLinks((current) => {
      const next = current.filter((_, i) => i !== index);
      return next.length === 0 ? [emptyRow()] : next;
    });
  }

  // どの分岐でも PageHeading を通す。通さないと document.title が
  // 書き換わらず、SPA では前の画面のタブ名が残る(PR #135)
  if (loading) {
    return (
      <MemberPage session={session} size="NARROW">
        <PageHeading title={TITLE} />
        <Text size="S" color="TEXT_GREY">
          読み込み中…
        </Text>
      </MemberPage>
    );
  }

  if (failed) {
    return (
      <MemberPage session={session} size="NARROW">
        <PageHeading title={TITLE} />
        <SessionUnavailable />
      </MemberPage>
    );
  }

  if (user === null) {
    return (
      <MemberPage session={session} size="NARROW">
        <PageHeading title={TITLE} />
        <LoginRequired>プロフィールの編集にはログインが必要です。</LoginRequired>
      </MemberPage>
    );
  }

  // フォーム1枚の画面なので NARROW(docs/spec-layout-unification.md §5)
  return (
    <MemberPage session={session} size="NARROW">
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
              {/* 参加者一覧にも主催欄にもこの名前が出る。変えると即座に効く
                (spec-v2.2.md §4.1)。改姓に本人が対応できないと、そのたびに
                管理者へ頼むことになる(オーナー決定 2026-09-12) */}
              <FormControl label="氏名" statusLabels={REQUIRED} exampleMessage="山田 一郎">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={NAME_MAX}
                  required
                  width="100%"
                />
              </FormControl>

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

              {/* 選択肢にしない。当てはまらない人が書けなくなるうえ、
                  選択肢そのものが「この中から選べ」という主張になる
                  (spec-v2.2.md §2.1)。代名詞に限らない書き方もできる。
                  名前の横に並ぶ欄なので maxLength で20字に止める */}
              <FormControl
                label="呼ばれ方"
                statusLabels={OPTIONAL}
                helpMessage="参加者や主催の一覧で、名前の横に出ます"
                exampleMessage="he/him / さん付けで / 呼び捨てOK"
              >
                <Input
                  value={pronouns}
                  onChange={(e) => setPronouns(e.target.value)}
                  maxLength={PRONOUNS_MAX}
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
                helpMessage="何を作っているか、何に興味があるかを書いておくと、企画に誘われやすくなります。Markdown で書けます"
              >
                <MarkdownField value={bio} onChange={setBio} rows={8} maxLetters={BIO_MAX} />
              </FormControl>
            </Stack>
          )}
        </Panel>

        {/* スキルの語彙は企画と分けている(docs/spec-tags.md §3.4)。
            候補も category=profile だけを取る。選び方は /create と揃える */}
        <Panel title="使える技術">
          <FormControl
            label="使える技術"
            helpMessage={`${MAX_TAGS}件まで。一覧に無いものは打って足せます。`}
          >
            <TagPicker
              candidates={tags}
              selected={selectedTagNames}
              onChange={setSelectedTagNames}
              max={MAX_TAGS}
              loadFailed={tagsError}
            />
          </FormControl>
        </Panel>

        <Panel title="リンク">
          <Stack gap={1}>
            {links.map((row, index) => (
              // key に index を使う。行そのものに id が無く、
              // ラベルは書き換わるので他に安定した値がない。
              //
              // 行を fieldset で囲み、視覚的に隠した legend で何行目かを伝える。
              // 3行あると「ラベル」「URL」「削除」が同じ名前で3回ずつ読み上げられ、
              // どの行のものか分からなかった(Issue #189)。
              // 見た目は変えず、支援技術に届く名前だけを足す
              <Cluster key={index} as="fieldset" align="flex-end" gap={0.5}>
                <legend className="sr-only">{index + 1}つ目のリンク</legend>
                <FormControl label="ラベル" statusLabels={OPTIONAL} className="grow">
                  <Input
                    value={row.label}
                    onChange={(e) => updateLink(index, { label: e.target.value })}
                    maxLength={LABEL_MAX}
                    width="100%"
                  />
                </FormControl>
                <FormControl label="URL" statusLabels={OPTIONAL} className="grow-[2]">
                  <Input
                    value={row.url}
                    onChange={(e) => updateLink(index, { url: e.target.value })}
                    maxLength={URL_MAX}
                    width="100%"
                  />
                </FormControl>
                {/* 押すと行が消える操作なので、名前だけは行を特定できる形にする。
                    legend の読み上げは支援技術によって差があり、「削除」が
                    3つ並ぶと取り返しの付かない操作を選び間違える */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeLink(index)}
                  aria-label={`${index + 1}つ目のリンクを削除`}
                >
                  削除
                </Button>
              </Cluster>
            ))}
            {/* 上限に達したら押せなくする。押しても断られるだけの
                ボタンを出さない(docs/spec-my-page.md §4.2) */}
            <div>
              <Button
                size="sm"
                onClick={() => setLinks((current) => [...current, emptyRow()])}
                disabled={links.length >= MAX_LINKS}
              >
                行を追加
              </Button>
              {links.length >= MAX_LINKS && (
                <Text size="S" color="TEXT_GREY" as="p" className="mt-1.5">
                  リンクは{MAX_LINKS}件までです。
                </Text>
              )}
            </div>
          </Stack>
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

      {/* form の外に置く。中に入れると form が入れ子になり、
          「パスワードを変更」がプロフィールの保存も走らせてしまう。
          mt-8 は「保存する」と離すため。詰めると保存がこのパネルの
          操作に見える */}
      <Panel title="パスワード" className="mt-8">
        {passwordChanged && (
          <Note tone="success">
            パスワードを変更しました。次のログインから新しいパスワードを使ってください。
          </Note>
        )}
        <Stack gap={0.75}>
          <Text size="S" color="TEXT_GREY" as="p">
            いまのパスワードを入れてから、新しいものに変えられます。
            忘れてしまったときは部長に再発行してもらってください。
          </Text>
          <div>
            <Button variant="default" onClick={openPasswordDialog}>
              パスワードを変更
            </Button>
          </div>
        </Stack>
      </Panel>

      {changingPassword && (
        <PasswordChangeDialog
          busy={passwordBusy}
          error={passwordError}
          onCancel={() => {
            setChangingPassword(false);
            setPasswordError(null);
          }}
          onSubmit={submitPassword}
        />
      )}
    </MemberPage>
  );
}
