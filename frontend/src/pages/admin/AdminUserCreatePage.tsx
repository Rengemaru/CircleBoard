import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { CopyButton } from "../../components/CopyButton";
import { FormControl, Input, Select, Stack, StatusLabel } from "smarthr-ui";
import { ErrorNote } from "../../components/ui/ErrorNote";
import { Note } from "../../components/ui/Note";
import { Panel } from "../../components/ui/Panel";
import { createUser, type NewUserInput } from "../../api/admin";
import { gradeLabel } from "../../lib/grade";
import { AdminOnly } from "./AdminOnly";

// アカウント発行(wireframes/wireframe-admin-ver2.html ③)。
//
// 一覧(②)とは別の画面にしている。発行は「たまに1人ぶんだけ行う操作」で、
// 一覧を見ながら行うものではないため。
// 必須は赤いラベルで出す。従来は赤い * と読み上げ用の「必須」を自前で
// 並べていたが、FormControl の statusLabels が同じことをする
const REQUIRED = <StatusLabel type="red">必須</StatusLabel>;

// サーバー側の検証と同じ値(backend の User::MAX_NAME_LENGTH / MAX_EMAIL_LENGTH)
const NAME_MAX = 50;
const EMAIL_MAX = 255;

const ROLE_OPTIONS: { label: string; value: NewUserInput["role"] }[] = [
  { label: "メンバー（通常）", value: "member" },
  { label: "管理者", value: "admin" },
];

export function AdminUserCreatePage() {
  return (
    <AdminOnly title="アカウント発行" subtitle="新しいメンバーのアカウントを作成する">
      {() => <IssueForm />}
    </AdminOnly>
  );
}

type Issued = { name: string; email: string; password: string };

function IssueForm() {
  const navigate = useNavigate();
  // 学年は form に持たない。入力中の空欄を 0 として扱わないよう文字列で持ち、
  // 送るときに数値へ直す。form 側にも持つと、空にしたときだけ2つがずれる
  const [form, setForm] = useState<Omit<NewUserInput, "grade_years">>({
    name: "",
    email: "",
    password: "",
    role: "member",
  });
  const [years, setYears] = useState("1");
  const [issued, setIssued] = useState<Issued | null>(null);
  // エラーは文字列に潰さず、そのまま持つ。401 かどうかを
  // 表示側(ErrorNote)で判定するため(Issue #72)
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createUser({ ...form, grade_years: Number(years) });
      // 発行した初期パスワードはこの画面で一度だけ表示して終わり。
      // メール送信機能が無いので、口頭やDMで本人に伝える運用(ワイヤーフレーム③)
      setIssued({ name: form.name, email: form.email, password: form.password });
      setForm({ ...form, name: "", email: "", password: "" });
    } catch (e: unknown) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  if (issued !== null) {
    return <IssuedNotice issued={issued} onClose={() => setIssued(null)} />;
  }

  return (
    <form onSubmit={submit} className="max-w-[560px]">
      <Panel title="新規アカウント情報">
        {error !== null && <ErrorNote error={error} fallback="発行に失敗しました" />}

        {/* 項目の間隔は Stack で決める。FormControl は自分では下余白を持たない */}
        <Stack gap={1.25}>
          <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
            <FormControl label="名前" statusLabels={REQUIRED} exampleMessage="山田 一郎">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={NAME_MAX}
                required
                width="100%"
              />
            </FormControl>
            <FormControl
              label="メールアドレス（大学）"
              statusLabels={REQUIRED}
              exampleMessage="xxxxx@xxx.ac.jp"
            >
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                maxLength={EMAIL_MAX}
                required
                width="100%"
              />
            </FormControl>
          </div>

          {/* 入学年度と卒業年度は入力させない。部員ぶんを人手で入れるのは
            現実的でない(オーナー決定 2026-09-11)。年度はこの数字から逆算する。
            学科の入力欄は逆に、本人が /me/edit で書くのでここには無い */}
          <FormControl
            label="何年？"
            statusLabels={REQUIRED}
            exampleMessage="3 → B3、5 → M1、8 → D2"
            helpMessage="1〜9。0 と 10 以上は入れられません"
          >
            <span className="flex items-center gap-3">
              <Input
                value={years}
                // 1文字しか入らないので、0 と 10 以上は打ち込めない。
                // サーバーでも同じ範囲で弾く(curl で直接叩けるため)
                onChange={(e) => setYears(e.target.value.replace(/[^1-9]/g, "").slice(-1))}
                inputMode="numeric"
                maxLength={1}
                aria-label="在学何年目か"
                width="4em"
                required
              />
              {/* 入れた数字がどの学年になるかを、その場で見せる */}
              <span className="text-sm text-gray-600">{gradeLabel(Number(years)) ?? "—"}</span>
            </span>
          </FormControl>

          <FormControl
            label="初期パスワード"
            statusLabels={REQUIRED}
            exampleMessage="8文字以上。管理者が設定して本人に伝える"
            helpMessage="パスワード再発行機能はないため、本人に直接伝えてください"
          >
            <Input
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              width="100%"
            />
          </FormControl>

          {/* 権限の選択肢は管理者/メンバーの2つのみ。
            demo は users.role に確保済みだがUIには出さない(ワイヤーフレーム③) */}
          <FormControl label="権限">
            <Select
              value={form.role}
              options={ROLE_OPTIONS}
              onChangeValue={(value) => setForm({ ...form, role: value })}
              width="100%"
            />
          </FormControl>
        </Stack>

        <hr className="my-4 border-gray-200" />

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => navigate("/admin/users")}>
            キャンセル
          </Button>
          <Button type="submit" variant="primary" busy={busy} busyLabel="発行中…">
            アカウントを発行する
          </Button>
        </div>
      </Panel>
    </form>
  );
}

function IssuedNotice({ issued, onClose }: { issued: Issued; onClose: () => void }) {
  const navigate = useNavigate();

  return (
    <div className="max-w-[560px]">
      <Panel title="アカウントを発行しました" action={<Badge tone="active">発行済み</Badge>}>
        <dl className="mb-4 space-y-2 text-[13px]">
          <Row label="名前" value={issued.name} />
          <Row label="メール" value={issued.email} />
          <Row label="初期パスワード" value={issued.password} />
        </dl>

        <Note tone="warning">本人に伝えてください。この画面を閉じると再表示できません。</Note>

        {/* 手で書き写すと打ち間違える。そのまま DM に貼れる形でコピーする */}
        <div className="flex flex-wrap items-center gap-3">
          <CopyButton text={handoverText(issued)} label="コピー" />
          <Button variant="ghost" onClick={onClose}>
            続けて発行する
          </Button>
          <Button variant="ghost" onClick={() => navigate("/admin/users")}>
            一覧へ戻る
          </Button>
        </div>
      </Panel>
    </div>
  );
}

// 本人に渡す文面。メール送信機能が無いので、口頭やDMで伝える運用
function handoverText(issued: Issued): string {
  return [
    "CircleBoard のアカウントを発行しました。",
    `メールアドレス: ${issued.email}`,
    `初期パスワード: ${issued.password}`,
  ].join("\n");
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <dt className="w-28 shrink-0 text-gray-500">{label}</dt>
      <dd className="font-mono break-all">{value}</dd>
    </div>
  );
}
