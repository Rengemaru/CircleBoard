import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FormControl, Input, Stack } from "smarthr-ui";
import { MemberPage } from "../components/MemberPage";
import { Button } from "../components/ui/Button";
import { ErrorNote } from "../components/ui/ErrorNote";
import { Note } from "../components/ui/Note";
import { PageHeading } from "../components/ui/PageHeading";
import { Panel } from "../components/ui/Panel";
import { changeMyPassword } from "../api/users";
import { useCurrentUser } from "../hooks/useCurrentUser";

// 初期パスワードのままの人に、自分のパスワードを設定してもらう画面(Issue #288)。
//
// **ナビゲーションを出さない。** この状態では他のAPIが全て403なので、
// メニューを出すと押した先が全部エラーになる。出口は「変更する」だけにする。
//
// マイページのダイアログ(PasswordChangeDialog)と作りを分けている。あちらは
// 「変えたければ変えられる」入口で、閉じられることが正しい。こちらは
// 閉じる先が無い。同じ部品にすると、キャンセルの有無を props で分けることになり、
// どちらの画面の話をしているのか読めなくなる。
export function PasswordChangePage() {
  const navigate = useNavigate();
  const session = useCurrentUser();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await changeMyPassword(currentPassword, password);
      // 変更が通れば 403 は解ける。トップから普段どおり使い始められる。
      // replace にしているのは、戻るボタンでこの画面に戻ってこないようにするため
      navigate("/", { replace: true });
    } catch (e: unknown) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <MemberPage session={session} size="NARROW" hideNav>
      <div className="mx-auto max-w-md">
        <PageHeading title="パスワードを変更してください" />
        <Panel>
          <Stack gap={1}>
            <Note tone="warning">
              いまのパスワードは<strong>部長が発行したもの</strong>です。
              同じものが他の部員にも配られている可能性があるので、
              自分だけが知っているものに変えてから使ってください。
            </Note>

            <form onSubmit={submit}>
              {error !== null && <ErrorNote error={error} fallback="変更に失敗しました" />}

              <Stack gap={1.25} className="mb-4">
                <FormControl label="いまのパスワード" exampleMessage="部長から伝えられたもの">
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    width="100%"
                  />
                </FormControl>

                <FormControl label="新しいパスワード" exampleMessage="8文字以上">
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    width="100%"
                  />
                </FormControl>
              </Stack>

              <Button
                type="submit"
                variant="primary"
                busy={busy}
                busyLabel="変更中…"
                className="w-full"
              >
                変更して始める
              </Button>
            </form>
          </Stack>
        </Panel>
      </div>
    </MemberPage>
  );
}
