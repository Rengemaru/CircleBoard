import { Link, useLocation } from "react-router-dom";
import type { CurrentUser } from "../api/session";

// メンバー画面で共通のヘッダー(wireframes/wireframe-member.html)。
// サイネージには置かない（ナビゲーションを一切表示しない仕様のため）。
export function SiteHeader({ user }: { user: CurrentUser | null }) {
  return (
    <header className="border-b border-gray-200">
      <div className="mx-auto flex max-w-3xl items-center gap-6 p-4">
        <Link to="/" className="font-bold">
          CircleBoard
        </Link>
        <nav className="flex gap-4 text-sm">
          <NavLink to="/">ホーム</NavLink>
          <NavLink to="/projects">プロジェクト</NavLink>
          <NavLink to="/events">イベント</NavLink>
        </nav>
        <div className="ml-auto text-sm">
          {user === null ? (
            <Link to="/login" className="text-gray-700 underline">
              ログイン
            </Link>
          ) : (
            <span className="text-gray-700">{user.name}</span>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const { pathname } = useLocation();
  const active = pathname === to;

  return (
    <Link
      to={to}
      className={active ? "border-b-2 border-gray-900 font-bold" : "text-gray-600"}
    >
      {children}
    </Link>
  );
}
