import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
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
    <>
      <AdminNav />
      <main className="mx-auto max-w-4xl p-6">
        <h1 className="mb-6 text-2xl font-bold">{title}</h1>
        {children(user)}
      </main>
    </>
  );
}

// 管理者3画面で共通のナビ(wireframes/wireframe-admin.html A1〜A3)。
// 3画面を行き来する手段が無いと、URL直打ちでしか移動できない
function AdminNav() {
  return (
    <header className="border-b border-gray-200 bg-gray-50">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
        <span className="font-bold">CircleBoard ADMIN</span>
        <AdminNavLink to="/admin/users">アカウント発行</AdminNavLink>
        <AdminNavLink to="/admin/pins">注目イベントのピン留め</AdminNavLink>
        <AdminNavLink to="/admin/signage-tokens">サイネージ端末</AdminNavLink>
        <Link to="/" className="ml-auto text-gray-600 underline">
          ← サイトに戻る
        </Link>
      </div>
    </header>
  );
}

function AdminNavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const { pathname } = useLocation();

  return (
    <Link
      to={to}
      className={pathname === to ? "border-b-2 border-gray-900 font-bold" : "text-gray-600"}
    >
      {children}
    </Link>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-4xl p-6">
      <p className="rounded border border-gray-200 bg-gray-50 p-4 text-gray-700">{children}</p>
      <Link to="/" className="mt-4 inline-block text-sm underline">
        ← サイトに戻る
      </Link>
    </main>
  );
}
