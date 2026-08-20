import { Link, useLocation } from "react-router-dom";
import { logout, type CurrentUser } from "../api/session";

// メンバー画面で共通のヘッダー(wireframes/wireframe-member.html)。
// サイネージには置かない（ナビゲーションを一切表示しない仕様のため）。
export function SiteHeader({ user }: { user: CurrentUser | null }) {
  return (
    <header className="border-b border-gray-200">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-6 gap-y-2 p-4">
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
            <span className="flex items-center gap-3 text-gray-700">
              {/* 管理画面への入口。admin のときだけ出す。
                  これは表示の話であって制限ではない。管理APIは全て
                  サーバー側で role を検証している(docs/api-spec.md §6)ので、
                  リンクを知られても操作はできない。
                  出しっぱなしにしないのは、押しても断られるだけのリンクを
                  全員に見せる意味がないため */}
              {user.role === "admin" && (
                <Link to="/admin/pin" className="underline">
                  管理
                </Link>
              )}
              {user.name}
              <LogoutButton />
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

// ログアウトすると Cookie が消えるので、画面を作り直すために遷移し直す
function LogoutButton() {
  async function submit() {
    await logout();
    // 状態を持ち回すより、トップから読み込み直す方が取りこぼしが無い
    window.location.assign("/");
  }

  return (
    <button type="button" onClick={submit} className="underline">
      ログアウト
    </button>
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
