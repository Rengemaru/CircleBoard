import { Link, useLocation } from "react-router-dom";
import { AppNavi, AppNaviCustomTag, AppNaviDropdown, Stack, TextLink } from "smarthr-ui";
import { Button } from "./ui/Button";
import { LinkButton } from "./ui/LinkButton";
import { logout } from "../api/session";
import type { SessionState } from "../hooks/useCurrentUser";
import { loginPathFrom } from "../lib/redirectTo";

// メンバー画面で共通のヘッダー。
// サイネージには置かない（ナビゲーションを一切表示しない仕様のため）。
//
// 見た目は wireframes/wireframe-admin-ver2.html の .admin-topbar に合わせている。
// member 用の新しいワイヤーフレームは無いので、管理画面と同じ寸法・色・字送りを
// 使うことで「同じプロダクトの画面」に見せる(docs/instructions.md Phase 7 T7-5)。
// サイドバーが付けていたグループ見出し（メイン / 管理 / サイネージ /
// アカウント）は引き継がない。5項目に見出しが4つあり、分類が項目数に
// 見合っていなかった。
//
// 「トークン管理」を「サイネージトークン」にしているのは、グループ見出し
// 「サイネージ」が無くなると何のトークンか分からなくなるため
const ADMIN_ITEMS = [
  { to: "/admin", label: "ダッシュボード" },
  { to: "/admin/users", label: "ユーザー管理" },
  { to: "/admin/posts", label: "企画一覧（全件）" },
  { to: "/admin/pin", label: "ピン留め設定" },
  { to: "/admin/signage", label: "サイネージトークン" },
  { to: "/admin/tags", label: "タグ" },
];

// hideNav はパスワード変更の強制画面で使う(Issue #288)。あの状態では
// 他のAPIが全て403なので、ナビを出すと押した先が全部エラーになる。
// 上段(名前とログアウト)は残す。**初期パスワードを思い出せない人の
// 出口がログアウトしか無い**ため
export function SiteHeader({
  session,
  hideNav = false,
}: {
  session: SessionState;
  hideNav?: boolean;
}) {
  const { user, loading, failed } = session;
  // ログインしたら、いま見ていた画面に戻す(Issue #37)
  const location = useLocation();

  return (
    <header className="border-b border-gray-200 bg-white">
      {/* 画面幅いっぱいに置き、左端を下の AppNavi と揃える。
          max-w-3xl で中央に寄せていたときは、本文(Container)とも
          ナビとも幅が合っていなかった */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
        <Link to="/" className="text-base font-bold tracking-tight">
          CircleBoard
        </Link>
        <div className="ml-auto flex items-center gap-3 text-[13px]">
          {/* ログイン状態が分からないうちは、ログインボタンも名前も出さない。
              本文が「確認できませんでした」と言っている横で「ログイン」を出すと、
              ログアウトされたのだと読めてしまう(Issue #72)。
              読み込み中も同じ扱いにする。まだ確かめていないだけなのに
              「ログイン」を出すと、開くたびにログアウトされたように見える
              (Issue #184)。出さない方が、間違ったことを言うより良い */}
          {loading || failed ? null : user === null ? (
            <LinkButton to={loginPathFrom(location.pathname + location.search)} size="sm">
              ログイン
            </LinkButton>
          ) : (
            <>
              {/* 管理画面への入口はナビゲーションの「管理」に集約した。
                  ここにも置くと、同じ場所へ行く導線が1画面に2つ並ぶ */}
              {/* 名前をマイページへの入口にする。ナビに「マイページ」を
                  足すと、毎日使う3つと同じ重みで並んでしまう。
                  名前が出ている場所は、その人自身の設定を探す場所でもある */}
              <TextLink elementAs={Link} to="/me" className="text-gray-700">
                {user.name}
              </TextLink>
              <LogoutButton />
            </>
          )}
        </div>
      </div>

      {/* 主要機能を切り替える段。自前の下線と太字で選択状態を作っていたが、
          smarthr-ui の AppNavi に寄せる。管理のドロップダウンを足すときに
          選択状態の表現が2通りになるのを避けるため(Issue #142) */}
      {hideNav || (
        <AppNavi>
          <NavItem to="/">ホーム</NavItem>
          <NavItem to="/projects">プロジェクト</NavItem>
          <NavItem to="/events">イベント</NavItem>
          {/* 管理者にだけ出す。SmartHR の「権限による表示制御」は
            権限が無い機能の操作UIを非表示にする（パターンA: 非表示・理由なし）。
            これは表示の話であって制限ではない。管理APIはサーバー側で
            role を検証している(docs/api-spec.md §6)ので、URLを直接開いても
            操作はできない(CLAUDE.md §3-2) */}
          {user?.role === "admin" && <AdminMenu />}
        </AppNavi>
      )}
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

// 管理機能はドロップダウンにまとめる。平らに並べると8項目になり、
// 毎日使う3つと部長だけが時々使う5つが同じ重みで並んでしまう
// (docs/spec-layout-unification.md §4)
function AdminMenu() {
  const { pathname } = useLocation();

  return (
    <AppNaviDropdown
      // /admin/users/new のような配下の画面でも選択状態にする。
      // 選択状態を持てるのは AppNaviDropdown だけで、
      // AppNaviDropdownMenuButton には current が無い
      current={pathname === "/admin" || pathname.startsWith("/admin/")}
      dropdownContent={
        <Stack gap={0} className="p-1">
          {ADMIN_ITEMS.map((item) => (
            <Link key={item.to} to={item.to} className="px-3 py-2 text-sm hover:bg-gray-100">
              {item.label}
            </Link>
          ))}
        </Stack>
      }
    >
      管理
    </AppNaviDropdown>
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
