import { Link } from "react-router-dom";
import { TextLink } from "smarthr-ui";

// 企画名からその企画の画面へ行く導線(Issue #188)。
//
// 行き先が種別で変わるので、パスの組み立てをここ1箇所に置く。
// 管理画面は3つの表で同じことをするため、各画面で組み立てると
// 種別が増えたときに直し漏れる。
//
// **論理削除済みの企画には使わない。** 公開APIは削除済みを必ず404に
// するので(docs/api-spec.md §0)、リンクしても開けない。
export function PostLink({
  kind,
  id,
  children,
}: {
  kind: "event" | "project";
  id: number;
  children: React.ReactNode;
}) {
  return (
    <TextLink elementAs={Link} to={`/${kind === "event" ? "events" : "projects"}/${id}`} size="S">
      {children}
    </TextLink>
  );
}
