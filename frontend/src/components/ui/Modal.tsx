import { useEffect } from "react";
import { ControlledActionDialog } from "smarthr-ui";

// 取り消せない操作の前に挟む確認ダイアログ(docs/instructions.md Phase 8-4)。
//
// window.confirm を使わないのは、ブラウザの標準ダイアログだと
// 「何を消すのか」を1行しか書けず、取り返しのつかない操作の前に
// 十分な情報を出せないため。
//
// フォーカスの閉じ込め・Esc・開いた位置への復帰(Issue #56)は
// smarthr-ui の ControlledActionDialog が持っているので、自前で書かない。
export function Modal({
  title,
  confirmLabel,
  onConfirm,
  onCancel,
  busy = false,
  children,
}: {
  title: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  children: React.ReactNode;
}) {
  // 初期フォーカスはキャンセル側に置く。Enter を押しただけで
  // 取り返しのつかない操作が確定しないようにする(Issue #56)。
  // 既定では body にフォーカスが残ったままになる。
  //
  // ダイアログ本体は portal に出るので React の ref では中のボタンを掴めず、
  // firstFocusTarget も React 19 の useRef の型（null を含む）を受け取らない。
  // フッターの先頭にあるキャンセルボタンを DOM から取る
  useEffect(() => {
    document.querySelector<HTMLButtonElement>('[role="dialog"] button')?.focus();
  }, []);

  return (
    <ControlledActionDialog
      isOpen
      heading={title}
      size="S"
      // 確定側は danger。ここに来るのは削除・停止・無効化だけで、
      // 一覧に並ぶ引き金のボタンとは重みが違う
      actionButton={{ text: confirmLabel, theme: "danger", disabled: busy }}
      closeButton={{ text: "キャンセル", disabled: busy }}
      onClickAction={() => onConfirm()}
      onClickClose={onCancel}
      onPressEscape={onCancel}
      // オーバーレイのクリックでは閉じない(onClickOverlay を渡さない)。
      // 背景を押したつもりで閉じてやり直しになるより、明示的に選ばせる
      responseStatus={busy ? { status: "processing" } : undefined}
    >
      {children}
    </ControlledActionDialog>
  );
}
