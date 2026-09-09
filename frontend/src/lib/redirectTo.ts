// ログイン後に戻る先を ?redirect_to= で受け渡すための処理。
//
// 「ログインして参加」を押した人を /  に飛ばすと、参加したかったイベントを
// 自分で探し直すことになる（Issue #37）。戻る先を URL に載せて引き継ぐ。
//
// 戻り先を URL から受け取る以上、外部サイトへ飛ばされないことを保証する
// 必要がある。判定はこのファイル1か所に閉じ込め、呼ぶ側で書かない。

const LOGIN_PATH = "/login";
const REDIRECT_PARAM = "redirect_to";
const FALLBACK = "/";

// 受け取った値を、このサイト内のパスとして安全に使えるかどうかで絞る。
//
// 弾く必要があるのは「//evil.com」（プロトコル相対URL）と「https://evil.com」。
// どちらもブラウザは外部への遷移として解釈する。
// 「/」で始まり、かつ2文字目が「/」でも「\」でもないことを条件にする。
// バックスラッシュを見るのは、一部のブラウザが「/\evil.com」を
// プロトコル相対として扱うため。
export function safeRedirectPath(value: string | null): string {
  if (value === null || !value.startsWith("/")) return FALLBACK;
  if (value.startsWith("//") || value.startsWith("/\\")) return FALLBACK;
  // ログイン画面自身を指されると、ログイン後にまたログイン画面に戻る
  if (value === LOGIN_PATH || value.startsWith(`${LOGIN_PATH}?`)) return FALLBACK;

  return value;
}

// ログイン画面へのリンク先を組み立てる。
// from には useLocation() の pathname + search を渡す
export function loginPathFrom(from: string): string {
  const target = safeRedirectPath(from);
  if (target === FALLBACK) return LOGIN_PATH;

  return `${LOGIN_PATH}?${REDIRECT_PARAM}=${encodeURIComponent(target)}`;
}

export { REDIRECT_PARAM };
