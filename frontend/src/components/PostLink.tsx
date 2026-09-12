import { Link } from "react-router-dom";
import { TextLink } from "smarthr-ui";
import { postPath } from "../lib/postPath";

// 企画名からその企画の画面へ行く導線(Issue #188)。
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
    <TextLink elementAs={Link} to={postPath(kind, id)} size="S">
      {children}
    </TextLink>
  );
}
