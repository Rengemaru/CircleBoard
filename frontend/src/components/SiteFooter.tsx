import { Link } from "react-router-dom";

// メンバー画面で共通のフッター。
//
// /legal はワイヤーフレーム⑧に画面として存在するが、そこへ行く導線が
// どの画面にも描かれていない。ヘッダーのナビは3項目で固定されている
// (画面①)ため、フッターに置いた。
// サイネージには付けない（ナビゲーションを一切表示しない仕様のため）。
export function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-gray-200 bg-white">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-4 text-xs text-gray-500">
        <span>CircleBoard</span>
        <Link to="/legal" className="hover:text-gray-900">
          よくある質問・利用規約
        </Link>
      </div>
    </footer>
  );
}
