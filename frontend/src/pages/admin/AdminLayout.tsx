import { useEffect, useState } from "react";
import { fetchCurrentUser, type CurrentUser } from "../../api/session";

type Props = {
  title: string;
  children: (user: CurrentUser) => React.ReactNode;
};

// 管理者画面3枚で共通の枠。
//
// ここでの出し分けは「表示の話」であって制限ではない。
// API 側がすべてのエンドポイントで role: admin を検証している
// (docs/api-spec.md §6)ので、この画面を突破されても操作はできない。
// 画面側で隠すのは、権限の無い人に押せないボタンを見せないため。
export function AdminLayout({ title, children }: Props) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetchCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setChecked(true));
  }, []);

  if (!checked) {
    return <p className="p-8 text-gray-500">読み込み中…</p>;
  }

  if (user === null) {
    return <Notice>この画面を見るにはログインが必要です。</Notice>;
  }

  if (user.role !== "admin") {
    return <Notice>管理者だけが使える画面です。</Notice>;
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="mb-6 text-2xl font-bold">{title}</h1>
      {children(user)}
    </main>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-4xl p-6">
      <p className="rounded border border-gray-200 bg-gray-50 p-4 text-gray-700">{children}</p>
    </main>
  );
}
