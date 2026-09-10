import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// 遷移した先で1度だけ出す知らせ(Issue #43「何が起きたかを文言で伝える」)。
//
// 何が起きたかは遷移した側しか知らないので、遷移の state で渡す。
// クエリパラメータにすると、URL を共有したときにも出てしまう。
//
// マイページの保存で使っていた仕組みを、企画の作成でも使えるように
// 切り出した。同じことを画面ごとに書くと、片方だけ知らせが出ない状態が
// できる（実際、企画の作成だけ文言が出ていなかった。Issue #191）。
export function flashState(message: string): { flash: string } {
  return { flash: message };
}

// react-router の state は any なので、そのまま .flash を読むと型が消える
// (CLAUDE.md §4「any 禁止。unknown + 絞り込み」)
function readFlash(state: unknown): string | null {
  if (typeof state !== "object" || state === null || !("flash" in state)) return null;

  const value = state.flash;
  return typeof value === "string" ? value : null;
}

// 受け取った知らせを返し、履歴からは消す。
//
// state は history.state に入るので、消さないと再読み込みのたびに
// 「保存しました」が出続ける（実際に出た）。表示そのものは useState で
// 受け取った時点で確定しているので、ここで消しても画面からは消えない。
export function useFlash(): string | null {
  const location = useLocation();
  const navigate = useNavigate();
  const [message] = useState(() => readFlash(location.state));

  useEffect(() => {
    if (readFlash(location.state) === null) return;

    navigate(location.pathname + location.search, { replace: true, state: null });
  }, [location, navigate]);

  return message;
}
