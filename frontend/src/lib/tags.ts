// 1つの企画・プロフィールに付けられるタグの数(docs/spec-tags.md §3.2)。
// サーバー側の ApplicationController::MAX_TAGS_PER_RESOURCE と同じ値。
//
// 上限そのものはサーバーが 422 で守る。ここに置くのは「押せなくする」ためで、
// 打ててから弾かれるより、打てない方が理由が早く伝わる
export const MAX_TAGS_PER_RESOURCE = 5;
