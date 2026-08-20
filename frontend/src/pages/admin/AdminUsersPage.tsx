import { useState } from "react";
import { createUser, type NewUserInput } from "../../api/admin";
import { AdminLayout } from "./AdminLayout";

// アカウント発行(wireframes/wireframe-admin.html A1)。
//
// 発行済みユーザーの一覧はこの画面に置かない。ユーザー管理UIは MVP 対象外で、
// 誰が登録済みかの確認は rails console で行う(CLAUDE.md §10)。
export function AdminUsersPage() {
  return <AdminLayout title="アカウント発行">{() => <IssueForm />}</AdminLayout>;
}

type Issued = { name: string; email: string; password: string };

function IssueForm() {
  const thisYear = new Date().getFullYear();
  const [form, setForm] = useState<NewUserInput>({
    name: "",
    email: "",
    password: "",
    enrollment_year: thisYear,
    graduation_year: thisYear + 4,
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
      // メール送信機能が無いので、口頭やDMで本人に伝える運用(ワイヤーフレーム A1)
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
    <form onSubmit={submit} className="max-w-md space-y-4">
      {error !== null && <p className="text-red-700">{error}</p>}

      <Field label="氏名">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full rounded border border-gray-300 px-3 py-2"
        />
      </Field>

      <Field label="メールアドレス">
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full rounded border border-gray-300 px-3 py-2"
        />
      </Field>

      <Field label="初期パスワード（8文字以上）">
        <input
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="w-full rounded border border-gray-300 px-3 py-2"
        />
      </Field>

      <div className="flex gap-4">
        <Field label="入学年度">
          <input
            type="number"
            value={form.enrollment_year}
            onChange={(e) => setForm({ ...form, enrollment_year: Number(e.target.value) })}
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
        </Field>
        {/* 卒業年度は必須。後から一括入力するとコストが高いため発行時に必ず取る */}
        <Field label="卒業年度">
          <input
            type="number"
            value={form.graduation_year}
            onChange={(e) => setForm({ ...form, graduation_year: Number(e.target.value) })}
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
        </Field>
      </div>

      {/* 権限の選択肢は管理者/メンバーの2つのみ。
          demo は users.role に確保済みだがUIには出さない(ワイヤーフレーム A1) */}
      <Field label="権限">
        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value as NewUserInput["role"] })}
          className="w-full rounded border border-gray-300 px-3 py-2"
        >
          <option value="member">メンバー</option>
          <option value="admin">管理者</option>
        </select>
      </Field>

      <button
        type="submit"
        disabled={busy}
        className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-40"
      >
        発行する
      </button>
    </form>
  );
}

function IssuedNotice({ issued, onClose }: { issued: Issued; onClose: () => void }) {
  return (
    <div className="max-w-md space-y-4 rounded border border-gray-900 p-6">
      <h2 className="text-lg font-bold">アカウントを発行しました</h2>
      <dl className="space-y-2 text-sm">
        <Row label="氏名" value={issued.name} />
        <Row label="メール" value={issued.email} />
        <Row label="初期パスワード" value={issued.password} />
      </dl>
      <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">
        本人に伝えてください。この画面を閉じると再表示できません。
      </p>
      <button
        type="button"
        onClick={onClose}
        className="rounded border border-gray-300 px-4 py-2"
      >
        閉じる
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <dt className="w-28 shrink-0 text-gray-500">{label}</dt>
      <dd className="font-mono break-all">{value}</dd>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-gray-700">{label}</span>
      {children}
    </label>
  );
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "発行に失敗しました";
}
