# タグ絞り込みのクエリ解釈。イベントとプロジェクトが同じ書式を受ける。
#
# 同じ解釈を2箇所に置くと、片方だけ直る事故が起きる（実際に
# Integer の基数指定漏れが両方に入っていた）。1箇所にまとめる。
module TagFilterable
  extend ActiveSupport::Concern

  private

  # "1,3" を [1, 3] にする。数字でないものは捨てる。
  #
  # 基数10を明示する。省略すると Integer("010") が8進数として 8 になり、
  # フロントの Number("010") が返す 10 と食い違う。URLを手で書き換えた人が
  # 押したタグと違う結果を見ることになる。
  #
  # 空・不正な値のときは空配列を返し、呼び出し側で「絞り込まない」に倒す。
  # URLを手で書き換えられてもエラーにしない(docs/api-spec.md §2)
  def parse_tag_ids(raw)
    raw.to_s.split(",").filter_map { |s| Integer(s, 10, exception: false) }
  end
end
