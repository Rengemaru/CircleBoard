import { Link } from "react-router-dom";
import { Base, Section, Stack, Text } from "smarthr-ui";
import { SectionHeading } from "./ui/SectionHeading";
import type { NotificationItem } from "../api/notifications";

// アプリ内通知(Issue #292)。**あるときだけ出す。**
//
// 脱退申請は、オーナーが自分でプロジェクトの詳細を開かない限り気づけない。
// 申請した側は待っているのに、された側は来ていることを知らない状態になる。
//
// **承認・却下のボタンはここに置かない。** 同じ操作UIが2箇所に増えると、
// 片方だけ直して食い違う。気づく所と操作する所を分け、ここからは
// プロジェクトの詳細(WithdrawalSection がある)へ送るだけにする。
//
// 取得に失敗しても何も出さない。「通知が取れませんでした」は、
// 用が無い人には意味が無く、ホームを開くたびに出ると邪魔になる
export function NotificationSection({ items }: { items: NotificationItem[] }) {
  if (items.length === 0) return null;

  return (
    <Section>
      <SectionHeading>お知らせ（{items.length}件）</SectionHeading>
      <Stack gap={0.5}>
        {items.map((item) => (
          <Base key={`${item.type}-${item.id}`} padding={1} overflow="auto">
            <Text size="S" as="p">
              {/* user は退会で null になりうる。「誰か」が抜けたい事実は残る */}
              <strong>{item.user?.name ?? "退会したメンバー"}</strong>
              さんが
              <Link to={`/projects/${item.project.id}`} className="mx-1 underline">
                {item.project.title}
              </Link>
              からの脱退を申請しています。
            </Text>
            <Text size="S" color="TEXT_GREY" as="p">
              {formatRequestedAt(item.requested_at)}に申請されました。承認か却下をしてください
            </Text>
          </Base>
        ))}
      </Stack>
    </Section>
  );
}

// 「いつ来たか」が分かれば十分なので日付だけ。放置の長さが読める
function formatRequestedAt(iso: string): string {
  const at = new Date(iso);
  return `${at.getMonth() + 1}/${at.getDate()}`;
}
