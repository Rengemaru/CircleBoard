import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LinkButton } from "../../components/ui/LinkButton";
import { PageHeading } from "../../components/ui/PageHeading";
import { fetchCurrentUser, type CurrentUser } from "../../api/session";
import { loginPathFrom } from "../../lib/redirectTo";

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
  // /api/session は未ログインでも 200 + null を返す(docs/api-spec.md §1)ので、
  // 例外が飛んだときは「未ログイン」ではなく「確かめられなかった」。
  // ここを未ログイン扱いにすると、通信が切れただけでログインを促すことになる(Issue #72)
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchCurrentUser()
      .then(setUser)
      .catch(() => setFailed(true))
      .finally(() => setChecked(true));
  }, []);

  if (!checked) {
    return <Notice>読み込み中…</Notice>;
  }
  if (failed) {
    return (
      <Notice>
        ログイン状態を確認できませんでした。通信を確認して、ページを再読み込みしてください。
      </Notice>
    );
  }
  if (user === null) {
    // 「見えません」で終わらせず、次に何をすればよいかを置く。
    // member 側の LoginRequired と同じ形に揃える(Issue #72)
    return <Notice login>この画面を見るにはログインが必要です。</Notice>;
  }
  if (user.role !== "admin") {
    return <Notice>管理者だけが使える画面です。</Notice>;
  }

  return (
    // 200px 固定のサイドバー + 残り全部。サイドバーは画面の高さいっぱいに伸ばす
    <div className="grid min-h-screen grid-cols-[200px_1fr]">
      <AdminSidebar user={user} />
      <div className="min-w-0 bg-gray-50">
        {/* member 側と同じ PageHeading を通す。自前の h1 のままだと
            document.title が書き換わらず、管理画面のタブが全部
            「CircleBoard」になって見分けられない(PR #119) */}
        <div className="border-b border-gray-200 bg-white px-6 py-3.5">
          <PageHeading title={title} subtitle={subtitle} action={action} className="" />
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
          <span className="rounded bg-red-600 px-[7px] py-px text-[10px] font-bold tracking-wider">
            ADMIN
          </span>
        </div>
        <div className="mt-2 text-xs text-gray-400">{user.name}</div>
      </div>

      {/* 未実装の画面はここに出さない。押すと 404 になるリンクを並べても
          「準備中」という情報しか伝わらない。
          FAQ編集(T7-6)は実装した時点でこの一覧に足す */}
      <div className="py-3">
        <NavGroup>メイン</NavGroup>
        <NavItem to="/admin" icon="📊" exact>
          ダッシュボード
        </NavItem>

        <NavGroup>管理</NavGroup>
        <NavItem to="/admin/users" icon="👥">
          ユーザー管理
        </NavItem>
        <NavItem to="/admin/posts" icon="📋">
          企画一覧（全件）
        </NavItem>

        <NavGroup>サイネージ</NavGroup>
        <NavItem to="/admin/signage" icon="🖥">
          トークン管理
        </NavItem>
        <NavItem to="/admin/pin" icon="📌">
          ピン留め設定
        </NavItem>

        <NavGroup>アカウント</NavGroup>
        <NavItem to="/" icon="↩" exact>
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
  exact = false,
  children,
}: {
  to: string;
  icon: string;
  exact?: boolean;
  children: React.ReactNode;
}) {
  const { pathname } = useLocation();
  // 配下の画面(例: /admin/users/new)でも親の項目を選択状態にする。
  // 発行画面にいるとき、どこにも印が付いていないと現在地が分からない。
  // ただし /admin は全ての管理画面の前方一致になるので完全一致だけで判定する
  const active = exact ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);

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
function Notice({ login = false, children }: { login?: boolean; children: React.ReactNode }) {
  // ログインしたら、いま開こうとしていた管理画面に戻す(Issue #37)
  const location = useLocation();

  return (
    <main className="mx-auto max-w-4xl p-6">
      <p className="rounded border border-gray-200 bg-gray-50 p-4 text-gray-700">{children}</p>
      <div className="mt-4 flex gap-2">
        {login && (
          <LinkButton
            to={loginPathFrom(location.pathname + location.search)}
            size="sm"
            variant="primary"
          >
            ログイン
          </LinkButton>
        )}
        <LinkButton to="/" size="sm" variant="ghost">
          ← サイトに戻る
        </LinkButton>
      </div>
    </main>
  );
}
