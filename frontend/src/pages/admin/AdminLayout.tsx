import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { fetchCurrentUser, type CurrentUser } from "../../api/session";

type Props = {
  title: string;
  // トップバー左のタイトル下に出す1行。この画面で何ができるかを書く
  subtitle: string;
  // トップバー右端の主操作（例: 「＋ トークンを発行」）
  action?: React.ReactNode;
  children: (user: CurrentUser) => React.ReactNode;
};

// 管理者画面で共通の枠(wireframes/wireframe-admin-ver2.html .admin-shell)。
//
// ここでの出し分けは「表示の話」であって制限ではない。
// API 側がすべてのエンドポイントで role: admin を検証している
// (docs/api-spec.md §6)ので、この画面を突破されても操作はできない。
export function AdminLayout({ title, subtitle, action, children }: Props) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetchCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setChecked(true));
  }, []);

  if (!checked) {
    return <Notice>読み込み中…</Notice>;
  }
  if (user === null) {
    return <Notice>この画面を見るにはログインが必要です。</Notice>;
  }
  if (user.role !== "admin") {
    return <Notice>管理者だけが使える画面です。</Notice>;
  }

  return (
    // 200px 固定のサイドバー + 残り全部。サイドバーは画面の高さいっぱいに伸ばす
    <div className="grid min-h-screen grid-cols-[200px_1fr]">
      <AdminSidebar user={user} />
      <div className="min-w-0 bg-gray-50">
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3.5">
          <div>
            <h1 className="text-base font-bold">{title}</h1>
            <p className="mt-px text-xs text-gray-500">{subtitle}</p>
          </div>
          {action}
        </div>
        <div className="p-6">{children(user)}</div>
      </div>
    </div>
  );
}

function AdminSidebar({ user }: { user: CurrentUser }) {
  return (
    <nav className="bg-gray-900 text-white">
      <div className="border-b border-gray-800 px-4 py-5">
        <div className="text-sm font-bold">CircleBoard</div>
        <div className="mt-1.5">
          <span className="rounded-sm bg-red-600 px-[7px] py-px text-[10px] font-bold tracking-wider">
            ADMIN
          </span>
        </div>
        <div className="mt-2 text-xs text-gray-400">{user.name}</div>
      </div>

      {/* 未実装の画面はここに出さない。押すと 404 になるリンクを並べても
          「準備中」という情報しか伝わらない。
          ダッシュボード(T7-2)・企画一覧(T7-3)・FAQ編集(T7-6)は
          実装した時点でこの一覧に足す */}
      <div className="py-3">
        <NavGroup>管理</NavGroup>
        <NavItem to="/admin/users" icon="👥">
          アカウント発行
        </NavItem>

        <NavGroup>サイネージ</NavGroup>
        <NavItem to="/admin/signage" icon="🖥">
          トークン管理
        </NavItem>
        <NavItem to="/admin/pin" icon="📌">
          ピン留め設定
        </NavItem>

        <NavGroup>アカウント</NavGroup>
        <NavItem to="/" icon="↩">
          通常画面に戻る
        </NavItem>
      </div>
    </nav>
  );
}

function NavGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pt-2.5 pb-1 text-[10px] tracking-widest text-gray-600 uppercase">
      {children}
    </div>
  );
}

function NavItem({
  to,
  icon,
  children,
}: {
  to: string;
  icon: string;
  children: React.ReactNode;
}) {
  const { pathname } = useLocation();
  const active = pathname === to;

  return (
    <Link
      to={to}
      className={`flex items-center gap-2 border-l-[3px] px-4 py-2.5 text-[13px] ${
        active
          ? "border-l-white bg-gray-800 text-white"
          : "border-l-transparent text-gray-400 hover:bg-gray-800 hover:text-white"
      }`}
    >
      <span className="w-[18px] text-center text-sm">{icon}</span>
      {children}
    </Link>
  );
}

// 権限が無い / 読み込み中は、サイドバーごと出さない。
// 管理画面の構造そのものを、入れない人に見せる必要がない
function Notice({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-4xl p-6">
      <p className="rounded border border-gray-200 bg-gray-50 p-4 text-gray-700">{children}</p>
      <Link to="/" className="mt-4 inline-block">
        <Button size="sm" variant="ghost">
          ← サイトに戻る
        </Button>
      </Link>
    </main>
  );
}
