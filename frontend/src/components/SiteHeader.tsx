import { Link, useLocation } from "react-router-dom";
import { AppNavi, AppNaviCustomTag } from "smarthr-ui";
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
export function SiteHeader({
  user,
  sessionFailed = false,
}: {
  user: CurrentUser | null;
  sessionFailed?: boolean;
}) {
  // ログインしたら、いま見ていた画面に戻す(Issue #37)
  const location = useLocation();

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
        <Link to="/" className="text-base font-bold tracking-tight">
          CircleBoard
        </Link>
        <div className="ml-auto flex items-center gap-3 text-[13px]">
          {/* ログイン状態が分からないときは、ログインボタンも名前も出さない。
              本文が「確認できませんでした」と言っている横で「ログイン」を出すと、
              ログアウトされたのだと読めてしまう(Issue #72) */}
          {sessionFailed ? null : user === null ? (
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

      {/* 主要機能を切り替える段。自前の下線と太字で選択状態を作っていたが、
          smarthr-ui の AppNavi に寄せる。管理のドロップダウンを足すときに
          選択状態の表現が2通りになるのを避けるため(Issue #142) */}
      <AppNavi>
        <NavItem to="/">ホーム</NavItem>
        <NavItem to="/projects">プロジェクト</NavItem>
        <NavItem to="/events">イベント</NavItem>
      </AppNavi>
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

// AppNavi の項目。tag に react-router の Link を渡して SPA 遷移を保つ
// （既定の a タグだと画面全体が再読み込みされる）
function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  const { pathname } = useLocation();

  return (
    <AppNaviCustomTag tag={Link} to={to} current={pathname === to}>
      {children}
    </AppNaviCustomTag>
  );
}
