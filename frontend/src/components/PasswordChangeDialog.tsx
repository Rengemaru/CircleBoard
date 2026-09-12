import { useState } from "react";
import { ControlledFormDialog, FormControl, Input, Stack } from "smarthr-ui";
import { ErrorNote } from "./ui/ErrorNote";
import { Note } from "./ui/Note";

// 本人によるパスワードの変更(docs/spec-admin-operations.md §3.1)。
//
// **現在のパスワードを必ず入れてもらう。** ログイン中であることは「本人である」
// ことの証明にならない。これが無いと、席を外した隙に画面を触られただけで
// 乗っ取りが固定化する。サーバー側でも同じ検証をしている。
//
// プロフィール編集の中ではなくダイアログにしているのは、あの画面全体が1つの
// form で、中にもう1つ form を入れられないため。
export function PasswordChangeDialog({
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  error: unknown;
  onCancel: () => void;
  onSubmit: (currentPassword: string, password: string) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");

  return (
    <ControlledFormDialog
      isOpen
      heading="パスワードを変更"
      size="S"
      actionButton={{ text: "変更する", theme: "primary", disabled: busy }}
      closeButton={{ text: "キャンセル", disabled: busy }}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(currentPassword, password);
      }}
      onClickClose={onCancel}
      onPressEscape={onCancel}
      responseStatus={busy ? { status: "processing" } : undefined}
    >
      <Stack gap={1}>
        {error !== null && <ErrorNote error={error} fallback="変更に失敗しました" />}

        <FormControl label="いまのパスワード">
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

        <Note>
          変更しても、<strong>他の端末で開いたままの画面はそのまま使えます。</strong>
          心当たりがあるときは部長に連絡してください。
        </Note>
      </Stack>
    </ControlledFormDialog>
  );
}
