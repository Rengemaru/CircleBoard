// 在学何年目かを、学年の表記(B3 / M1 / D2)に直す。
//
// 1〜4年目が B、5〜6年目が M、7〜9年目が D。backend の User::PROGRAMS と
// 同じ表だが、こちらは**日付を跨がない**。年度の切り替わり(4月始まり)の計算を
// 二重に持っているわけではなく、入力中の数字がどの表記になるかを見せるだけで、
// 保存する値を決めるのはサーバー側(User#grade)。
//
// コンポーネントと同じファイルに置くと react-refresh の警告が出るので
// 別ファイルにしている(Issue #54 と同じ理由)。
const PROGRAMS = [
  { prefix: "B", years: 4 },
  { prefix: "M", years: 2 },
  { prefix: "D", years: 3 },
];

// 表せない年数（0 以下、10 以上）は null。0 を通すと B0 のような表記が出る
export function gradeLabel(years: number): string | null {
  if (years < 1) return null;

  let remaining = years;
  for (const program of PROGRAMS) {
    if (remaining <= program.years) return `${program.prefix}${remaining}`;
    remaining -= program.years;
  }

  return null;
}
