import { useState } from "react";
import { ControlledFormDialog, FormControl, Input, Select, Stack } from "smarthr-ui";
import { ErrorNote } from "../../components/ui/ErrorNote";
import { Note } from "../../components/ui/Note";
import { gradeLabel } from "../../lib/grade";
import type { AdminUserRow, UpdateUserInput } from "../../api/admin";

// ユーザーの編集(docs/spec-admin-operations.md §3.3)。
//
// 権限と学年だけを扱う。氏名・メール・学科はここでは変えられない。
// 学科は本人が /me/edit で書くもので、管理者用にもう1本の経路を作らない。
//
// 確認ダイアログ(components/ui/Modal)ではなくフォームダイアログを使う。
// あちらは確定ボタンが常に danger で、取り消せない操作の前に挟むためのもの。
// 保存は取り消せる操作なので、同じ見た目にしない。
const ROLE_OPTIONS: { label: string; value: "admin" | "member" }[] = [
  { label: "メンバー（通常）", value: "member" },
  { label: "管理者", value: "admin" },
];

export function AdminUserEditDialog({
  user,
  isSelf,
  busy,
  error,
  onCancel,
  onSave,
}: {
  user: AdminUserRow;
  isSelf: boolean;
  busy: boolean;
  error: unknown;
  onCancel: () => void;
  onSave: (input: UpdateUserInput) => void;
}) {
  // demo は選択肢に無い(users.role に確保しているが画面に出さない)。
  // 選ばせないまま member に倒すと、開いて保存しただけで種別が変わってしまう。
  // 初期値を member にしておき、「変わったものだけ送る」で送信対象から外す
  const initialRole = user.role === "admin" ? "admin" : "member";
  const [role, setRole] = useState<"admin" | "member">(initialRole);
  // 文字列で持つ。数値にすると、消している途中の空欄を 0 として扱うことになる
  const [years, setYears] = useState(initialYears(user));

  const preview = years === "" ? null : gradeLabel(Number(years));

  function submit() {
    const input: UpdateUserInput = {};
    // 変わったものだけ送る。触っていない項目まで送ると、
    // 卒業生の学年のようにサーバーが弾く値を、意図せず送ることになる
    if (role !== initialRole) input.role = role;
    if (years !== "" && Number(years) !== user.grade_years) input.grade_years = Number(years);

    onSave(input);
  }

  return (
    <ControlledFormDialog
      isOpen
      heading={`${user.name} を編集`}
      size="S"
      actionButton={{ text: "保存する", theme: "primary", disabled: busy }}
      closeButton={{ text: "キャンセル", disabled: busy }}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onClickClose={onCancel}
      onPressEscape={onCancel}
      responseStatus={busy ? { status: "processing" } : undefined}
    >
      <Stack gap={1}>
        {error !== null && <ErrorNote error={error} fallback="保存に失敗しました" />}

        <FormControl
          label="権限"
          helpMessage={
            isSelf
              ? "自分自身の権限は変えられません。降格すると、この画面に入れなくなります"
              : undefined
          }
        >
          <Select
            value={role}
            options={ROLE_OPTIONS}
            onChangeValue={(value) => setRole(value)}
            disabled={isSelf}
            width="100%"
          />
        </FormControl>

        {/* 入学年度と卒業年度は入力させない。部員ぶんを人手で入れるのは
            現実的でない(オーナー決定 2026-09-11)。年度はこの数字から逆算する */}
        <FormControl
          label="何年？"
          exampleMessage="3 → B3、5 → M1、8 → D2"
          helpMessage={
            user.graduated
              ? "卒業生に学年はありません。在学中に戻すと入れられます"
              : "1〜9。0 と 10 以上は入れられません"
          }
        >
          <span className="flex items-center gap-3">
            <Input
              value={years}
              // 1文字しか入らないので、0 と 10 以上は打ち込めない。
              // サーバーでも同じ範囲で弾く(curl で直接叩けるため)
              onChange={(e) => setYears(e.target.value.replace(/[^1-9]/g, "").slice(-1))}
              inputMode="numeric"
              maxLength={1}
              disabled={user.graduated}
              aria-label="在学何年目か"
              width="4em"
            />
            {/* 入れた数字がどの学年になるかを、その場で見せる */}
            <span className="text-sm text-gray-600">{preview ?? "—"}</span>
          </span>
        </FormControl>

        <Note>
          学年を変えると入学年度と卒業年度も入れ直します。卒業年度は「いまの課程が
          終わる年度末」として決めるので、進学や留年でずれることがあります。
        </Note>
      </Stack>
    </ControlledFormDialog>
  );
}

// 範囲の外（10年目以降や、入学年度が未来で 0 以下）は空欄から始める。
// そのまま出すと、打ち込めないはずの数字が最初から入っていることになる
function initialYears(user: AdminUserRow): string {
  if (user.graduated) return "";

  return gradeLabel(user.grade_years) === null ? "" : String(user.grade_years);
}
