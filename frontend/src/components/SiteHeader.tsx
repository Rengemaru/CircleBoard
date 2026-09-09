import { Link, useLocation } from "react-router-dom";
import { Button } from "./ui/Button";
import { LinkButton } from "./ui/LinkButton";
import { logout, type CurrentUser } from "../api/session";
import { loginPathFrom } from "../lib/redirectTo";

// メンバー画面で共通のヘッダー。
// サイネージには置かない（ナビゲーションを一切表示しない仕様のため）。
//
// 見た目は wireframes/wireframe-admin-ver2.html の .admin-topbar に合わせている。
// member 用の新しいワイヤーフレームは無いので、管理画面と同じ寸法・色・字送りを
// 使うことで「同じプロダクトの画面」に見せる(docs/instructions.md Phase 7 T7-5)。
export function SiteHeader({ user }: { user: CurrentUser | null }) {
  // ログインしたら、いま見ていた画面に戻す(Issue #37)
  const location = useLocation();

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
        <Link to="/" className="text-base font-bold tracking-tight">
          CircleBoard
        </Link>
        <nav className="flex gap-4 text-[13px]">
          <NavLink to="/">ホーム</NavLink>
          <NavLink to="/projects">プロジェクト</NavLink>
          <NavLink to="/events">イベント</NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-3 text-[13px]">
          {user === null ? (
            <LinkButton to={loginPathFrom(location.pathname + location.search)} size="sm">
              ログイン
            </LinkButton>
          ) : (
            <>
              {/* 管理画面への入口。admin のときだけ出す。
                  これは表示の話であって制限ではない。管理APIは全て
                  サーバー側で role を検証している(docs/api-spec.md §6)ので、
                  リンクを知られても操作はできない。
                  出しっぱなしにしないのは、押しても断られるだけのリンクを
                  全員に見せる意味がないため */}
              {user.role === "admin" && (
                <LinkButton to="/admin" size="sm" variant="ghost">
                  管理
                </LinkButton>
              )}
              <span className="text-gray-700">{user.name}</span>
              <LogoutButton />
            </>
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
    <Button size="sm" variant="ghost" onClick={submit}>
      ログアウト
    </Button>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const { pathname } = useLocation();
  const active = pathname === to;

  return (
    <Link
      to={to}
      className={
        active
          ? "border-b-2 border-gray-900 pb-0.5 font-bold"
          : "border-b-2 border-transparent pb-0.5 text-gray-500 hover:text-gray-900"
      }
    >
      {children}
    </Link>
  );
}
