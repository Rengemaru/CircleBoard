class Tag < ApplicationRecord
  # 企画用とプロフィール用で語彙を分ける(docs/spec-tags.md §3.4)。
  #
  # 以前は「同じタグを両方の用途で使う」方針で 1:skill を未使用のまま置いていたが、
  # プロフィールのタグは「その人が何者か」のラベルとして残り続けるため、企画の語彙と
  # 混ぜると人を型にはめてしまう(3Dの人がWebを始めるときに自分のタグが足を引っ張る)。
  # 値の追加にマイグレーションが要らないよう integer + Rails の enum で持つ
  enum :category, { project_event: 0, profile: 1 }

  has_many :event_tags, dependent: :destroy
  has_many :events, through: :event_tags
  has_many :project_tags, dependent: :destroy
  has_many :projects, through: :project_tags
  has_many :user_tags, dependent: :destroy
  has_many :users, through: :user_tags

  # 20文字。Photogrammetry(14) や Substance Painter(17) を通すために広く取っている。
  # 長い名前が画面を崩さないのは、表示側が文字数ではなく幅で切るため
  # (docs/spec-tags.md §3.3)
  MAX_NAME_LENGTH = 20

  before_validation :normalize_name

  validates :name, presence: true,
                   length: { maximum: MAX_NAME_LENGTH },
                   uniqueness: { scope: :category }

  # 管理画面の一覧で使う件数(docs/spec-tags.md §3.8)。
  #
  # 3つの中間テーブルを別々に数えるのは、企画用とプロフィール用で付く先が
  # 違うため。1本の JOIN にまとめると、行が掛け算になって件数がずれる。
  #
  # N+1 を避けるためにサブクエリで持ってくる。タグは数十件になりうるので、
  # 1件ずつ count を投げると一覧を開くたびに数十クエリが走る(CLAUDE.md §3-3)
  USAGE_COUNT_SQL = <<~SQL.squish.freeze
    (SELECT COUNT(*) FROM event_tags   WHERE event_tags.tag_id   = tags.id)
  + (SELECT COUNT(*) FROM project_tags WHERE project_tags.tag_id = tags.id)
  + (SELECT COUNT(*) FROM user_tags    WHERE user_tags.tag_id    = tags.id)
  SQL

  scope :with_usage_count, lambda {
    select("tags.*, #{USAGE_COUNT_SQL} AS usage_count").order(:category, :name)
  }

  # 一覧以外(改名・削除)からも同じ名前で呼べるようにする。
  # with_usage_count を通っていれば select の値を使い、そうでなければ数える
  def usage_count
    return self[:usage_count].to_i if has_attribute?(:usage_count)

    event_tags.count + project_tags.count + user_tags.count
  end

  # 表記ゆれのうち「全角と半角」「空白」だけを吸収する(docs/spec-tags.md §3.1)。
  #
  # NFKC が担うのは全角英数→半角、半角カナ→全角カナ、全角空白→半角空白。
  # **大文字小文字は変えない。** Rails と rails は別のタグとして立ち、
  # 統合が要るときは管理画面で行う(§3.8)。ここで小文字に寄せると
  # 「iOS」や「LT」のような、大文字であることに意味のある名前が壊れる。
  #
  # クラスメソッドで公開するのは、保存前だけでなく「送られてきた名前で既存の
  # タグを探す」ときにも同じ変換が要るため(find_or_create する API 側)
  def self.normalize_name(raw)
    raw.to_s.unicode_normalize(:nfkc).gsub(/[[:space:]]+/, " ").strip
  end

  private

  def normalize_name
    self.name = self.class.normalize_name(name)
  end
end
