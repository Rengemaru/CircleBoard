// wireframe-admin-ver2.html の .wf-form-group / .wf-label / .wf-input に対応する。
//
// input を Field の中に閉じ込めず children で受けるのは、type や
// onChange をラッパー越しに渡すと、どの属性が通るのかが読めなくなるため。
// 入力欄そのものは呼び出し側が素の <input> を書き、見た目だけ INPUT_CLASS を共有する。
// focus:outline-none でブラウザ標準のリングを消したまま、代わりが枠線の色変化
// だけだった。キーボードでいまどこにいるのかを追えない(Issue #57)。
// focus-visible にしているのは、マウスで押したときにリングを出さないため
export const INPUT_CLASS =
  "w-full rounded-[3px] border-[1.5px] border-gray-300 px-3 py-2 text-[13px] focus:border-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-1";

export function Field({
  label,
  required = false,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-xs font-semibold text-gray-700">
        {label}
        {required && (
          <>
            {/* 赤い * だけだと、色が見えない人にも読み上げにも伝わらない */}
            <span className="ml-1 text-red-600" aria-hidden="true">
              *
            </span>
            <span className="sr-only">必須</span>
          </>
        )}
      </span>
      {children}
      {hint !== undefined && <span className="mt-1 block text-[11px] text-gray-400">{hint}</span>}
    </label>
  );
}
