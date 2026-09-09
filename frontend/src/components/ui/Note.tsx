// wireframe-admin-ver2.html の .wf-note に対応する。左の色帯で強さを分ける。
type Tone = "info" | "success" | "warning" | "danger";

const TONE: Record<Tone, string> = {
  info: "border-l-gray-500 bg-gray-50 text-gray-500",
  // 操作が成功したことを伝える。色だけに頼らないよう、文面は必ず
  // 「〇〇しました」と何が起きたかを書く(Issue #43)
  success: "border-l-green-600 bg-green-50 text-green-800",
  warning: "border-l-amber-500 bg-amber-50 text-amber-800",
  danger: "border-l-red-600 bg-red-50 text-red-800",
};

export function Note({ tone = "info", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <p
      className={`mb-4 rounded border border-gray-200 border-l-[3px] px-3.5 py-2.5 text-xs ${TONE[tone]}`}
    >
      {children}
    </p>
  );
}
