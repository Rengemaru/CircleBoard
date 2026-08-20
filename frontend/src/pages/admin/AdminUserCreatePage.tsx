import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { CopyButton } from "../../components/CopyButton";
import { Field, INPUT_CLASS } from "../../components/ui/Field";
import { Note } from "../../components/ui/Note";
import { Panel } from "../../components/ui/Panel";
import { createUser, type NewUserInput } from "../../api/admin";
import { AdminLayout } from "./AdminLayout";

// アカウント発行(wireframes/wireframe-admin-ver2.html ③)。
//
// 一覧(②)とは別の画面にしている。発行は「たまに1人ぶんだけ行う操作」で、
// 一覧を見ながら行うものではないため。
export function AdminUserCreatePage() {
  return (
    <AdminLayout title="アカウント発行" subtitle="新しいメンバーのアカウントを作成する">
      {() => <IssueForm />}
    </AdminLayout>
  );
}

type Issued = { name: string; email: string; password: string };

// 入学年度・卒業年度の選択肢。今年の前後を出しておけば足りる
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 14 }, (_, i) => THIS_YEAR - 6 + i);

function IssueForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState<NewUserInput>({
    name: "",
    email: "",
    password: "",
    enrollment_year: THIS_YEAR,
    graduation_year: THIS_YEAR + 4,
    role: "member",
  });
  const [issued, setIssued] = useState<Issued | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createUser(form);
      // 発行した初期パスワードはこの画面で一度だけ表示して終わり。
      // メール送信機能が無いので、口頭やDMで本人に伝える運用(ワイヤーフレーム③)
      setIssued({ name: form.name, email: form.email, password: form.password });
      setForm({ ...form, name: "", email: "", password: "" });
    } catch (e: unknown) {
      setError(toMessage(e));
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
        {error !== null && <Note tone="danger">{error}</Note>}

        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field label="名前" required>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="山田 一郎"
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="メールアドレス（大学）" required>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              placeholder="xxxxx@xxx.ac.jp"
              className={INPUT_CLASS}
            />
          </Field>
        </div>

        {/* 入学年度はワイヤーフレーム③に無いが、users.enrollment_year が
            NOT NULL なので外せない(spec-v2.2.md §2)。
            学科の入力欄は逆に、列が無いので今は作れない(T7-4) */}
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field label="入学年度" required>
            <select
              value={form.enrollment_year}
              onChange={(e) => setForm({ ...form, enrollment_year: Number(e.target.value) })}
              className={INPUT_CLASS}
            >
              {YEARS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </Field>
          {/* 卒業年度は必須。後から一括入力するとコストが高いため発行時に必ず取る */}
          <Field label="卒業年度" required>
            <select
              value={form.graduation_year}
              onChange={(e) => setForm({ ...form, graduation_year: Number(e.target.value) })}
              className={INPUT_CLASS}
            >
              {YEARS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field
          label="初期パスワード"
          required
          hint="※ パスワード再発行機能はないため、本人に直接伝えてください"
        >
          <input
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            placeholder="8文字以上。管理者が設定して本人に伝える"
            className={INPUT_CLASS}
          />
        </Field>

        {/* 権限の選択肢は管理者/メンバーの2つのみ。
            demo は users.role に確保済みだがUIには出さない(ワイヤーフレーム③) */}
        <Field label="権限">
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as NewUserInput["role"] })}
            className={INPUT_CLASS}
          >
            <option value="member">メンバー（通常）</option>
            <option value="admin">管理者</option>
          </select>
        </Field>

        <hr className="my-4 border-gray-200" />

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => navigate("/admin/users")}>
            キャンセル
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
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

        <Note tone="warning">
          本人に伝えてください。この画面を閉じると再表示できません。
        </Note>

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

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "発行に失敗しました";
}
