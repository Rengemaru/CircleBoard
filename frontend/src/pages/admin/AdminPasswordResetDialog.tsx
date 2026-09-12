import { useState } from "react";
import { ControlledFormDialog, FormControl, Input, Stack } from "smarthr-ui";
import { CopyButton } from "../../components/CopyButton";
import { ErrorNote } from "../../components/ui/ErrorNote";
import { Note } from "../../components/ui/Note";
import type { AdminUserRow } from "../../api/admin";

// パスワードの再発行(docs/spec-admin-operations.md §3.1)。
//
// **現在のパスワードは求めない。** 忘れた人が対象なので、本人も知らない。
// メール送信を作らない方針(CLAUDE.md §10)なので、リセットリンクは送れない。
// 設定した値は口頭かDMで本人に伝える（アカウント発行の初期パスワードと同じ運用）。
export function AdminPasswordResetDialog({
  user,
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  user: AdminUserRow;
  busy: boolean;
  error: unknown;
  onCancel: () => void;
  onSubmit: (password: string) => void;
}) {
  const [password, setPassword] = useState("");

  return (
    <ControlledFormDialog
      isOpen
      heading={`${user.name} のパスワードを再発行`}
      size="S"
      actionButton={{ text: "再発行する", theme: "primary", disabled: busy }}
      closeButton={{ text: "キャンセル", disabled: busy }}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(password);
      }}
      onClickClose={onCancel}
      onPressEscape={onCancel}
      responseStatus={busy ? { status: "processing" } : undefined}
    >
      <Stack gap={1}>
        {error !== null && <ErrorNote error={error} fallback="再発行に失敗しました" />}

        <FormControl
          label="新しいパスワード"
          exampleMessage="8文字以上"
          helpMessage="管理者が決めて、本人に直接伝えます"
        >
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            width="100%"
          />
        </FormControl>

        {/* 手で書き写すと打ち間違える。そのまま DM に貼れる形でコピーする
            （アカウント発行画面と同じ） */}
        {password !== "" && <CopyButton text={handoverText(user.name, password)} label="コピー" />}

        {/* 押す前に知っておくべきことだけを書く。取り消せない操作ではないので
            ⚠️ は付けない(Issue #41) */}
        <Note tone="warning">
          この画面で決めた値をそのまま本人に伝えてください。メールは送られません。
          <br />
          <strong>いま {user.name} が開いている画面は、そのまま使える状態で残ります。</strong>
          締め出したいときは先に「停止」を押してください。
        </Note>
      </Stack>
    </ControlledFormDialog>
  );
}

// 本人に渡す文面。メール送信機能が無いので、口頭やDMで伝える運用
function handoverText(name: string, password: string): string {
  return [
    `${name} さんの CircleBoard のパスワードを再発行しました。`,
    `新しいパスワード: ${password}`,
    "ログイン後、マイページから自分で変更できます。",
  ].join("\n");
}
