# 企画名の部分一致検索。イベントとプロジェクトが同じ書式を受ける。
#
# TagFilterable と同じ理由でここにまとめる。同じ解釈を2箇所に置くと、
# 片方だけ直る事故が起きる。
module TitleSearchable
  extend ActiveSupport::Concern

  # これより長い語は受けない。企画名は100字までなので(spec-v2.2.md §2.2/§2.3)、
  # 超える語はどのみち0件になる。長い文字列で LIKE を走らせない
  MAX_QUERY_LENGTH = 100

  private

  # ?q= の部分一致。大文字小文字は区別しない(ILIKE)。
  #
  # **sanitize_sql_like が要る。** % と _ は LIKE のワイルドカードなので、
  # そのまま渡すと「50%」の検索が「50」で始まる企画を全部拾ってしまう。
  #
  # 空・空白だけ・長すぎるものは「絞り込まない」に倒す。URLを手で書き換え
  # られてもエラーにせず全件を返す(tag_ids と同じ考え方)。
  #
  # テーブル名を付けるのは、タグで絞り込むときに join した先と列名が
  # ぶつからないようにするため
  def filter_by_title(scope)
    query = params[:q].to_s.strip
    return scope if query.empty? || query.length > MAX_QUERY_LENGTH

    pattern = "%#{ActiveRecord::Base.sanitize_sql_like(query)}%"
    scope.where("#{scope.table_name}.title ILIKE ?", pattern)
  end
end
