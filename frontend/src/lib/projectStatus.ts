import type { ProjectSummary } from "../types/project";

// プロジェクトの状態を、バッジの色と日本語名に直す。
//
// **status は3値（recruiting / in_progress / completed）。** これを
// `status === "recruiting" ? "募集中" : "進行中"` と2値で書いていたため、
// 完了したプロジェクトが「進行中」と表示されていた（一覧・詳細とも）。
//
// tone と label を1つの表にまとめているのは、片方だけ直して食い違うのを
// 防ぐため。status が増えたときも、直す場所はここ1つで済む。
//
// tone の名前が `inprogress`（アンダースコアなし）なのは Badge 側の都合で、
// API の `in_progress` とは別物。**ここで突き合わせている**ので、
// 呼び出し側は意識しなくてよい。
//
// コンポーネントと同じファイルに置くと react-refresh の警告が出るので
// 別ファイルにしている（lib/grade.ts と同じ理由）。
export const PROJECT_STATUS: Record<
  ProjectSummary["status"],
  { tone: "recruiting" | "inprogress" | "completed"; label: string }
> = {
  recruiting: { tone: "recruiting", label: "募集中" },
  in_progress: { tone: "inprogress", label: "進行中" },
  completed: { tone: "completed", label: "完了" },
};
