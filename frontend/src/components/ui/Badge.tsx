// wireframe-admin-ver2.html の .badge に対応する。
//
// 状態の名前をそのまま型にしている。色を呼び出し側から渡せるようにすると、
// 同じ「募集中」が画面ごとに違う色になる
type Tone =
  | "recruiting"
  | "inprogress"
  | "completed"
  | "pinned"
  | "active"
  | "suspended"
  | "grad"
  | "admin"
  | "trashed";

const TONE: Record<Tone, string> = {
  recruiting: "border-blue-300 bg-blue-100 text-blue-800",
  inprogress: "border-green-300 bg-green-100 text-green-800",
  completed: "border-gray-300 bg-gray-100 text-gray-500",
  pinned: "border-amber-300 bg-amber-100 text-amber-800",
  active: "border-green-300 bg-green-100 text-green-800",
  suspended: "border-red-300 bg-red-100 text-red-800",
  grad: "border-gray-300 bg-gray-100 text-gray-500",
  admin: "border-amber-300 bg-amber-100 text-amber-800",
  trashed: "border-red-300 bg-red-100 text-red-800",
};

export function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-block rounded-sm border px-2 py-0.5 text-[11px] font-semibold tracking-wide ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}
