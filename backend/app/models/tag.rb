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
