class Project < ApplicationRecord
  enum :status, { recruiting: 0, in_progress: 1, completed: 2 }
  enum :visibility, { active: 0, trashed: 1 }
  # 🟡 DBだけ。UIとロジックは作らない
  enum :recurrence_type, { one_time: 0, recurring: 1 }, prefix: true

  belongs_to :owner, class_name: "User", optional: true

  # 定員判定。capacity が nil のときは無制限(spec-v2.2.md §2.3)。
  # **抜けた人は数えない。** 数えると、脱退したぶんの枠が空かない
  # (2026-09-12 に脱退を足すまではキャンセルの概念が無かった)
  def full?
    capacity.present? && active_project_participations.size >= capacity
  end

  # presence は DB の NOT NULL 制約に対応させる(spec-v2.2.md §2.3)。
  # capacity は NULL可なので付けない。
  #
  # 長さの上限は NULL可の activity_schedule / meeting_schedule にも付ける。
  # maximum だけの検証は nil も空文字も通すので、必須かどうかとは独立して置ける。
  # 経緯と、DBのカラムに桁数を入れない理由は Event 側に書いてある
  MAX_TITLE_LENGTH = 100
  # Markdown で書けるようにしたぶん増やす(Issue #303、オーナー決定 2026-09-13)。
  # 記法そのものが字数を食う。表を1つ入れると 200〜300字使う
  MAX_DESCRIPTION_LENGTH = 3000
  # 「毎週土曜」「毎週水曜 19:00〜」程度の自由記述。予定表を貼る欄ではない
  MAX_SCHEDULE_LENGTH = 100

  validates :title, presence: true, length: { maximum: MAX_TITLE_LENGTH }
  validates :description, presence: true, length: { maximum: MAX_DESCRIPTION_LENGTH }
  validates :activity_schedule, length: { maximum: MAX_SCHEDULE_LENGTH }
  validates :meeting_schedule, length: { maximum: MAX_SCHEDULE_LENGTH }

  # 定員の範囲(2026-09-12 の監査で追加。オーナー承認済み)。
  #
  # 検証が1つも無く、capacity: -5 が 201 で保存できていた。負の定員は
  # full? が `参加者数 >= -5` で常に true になるので、**誰も参加できない企画**
  # ができる。0 も同じ。
  #
  # 上限を 1000 にしているのは、int4 の限界(2_147_483_647)を超える値を送られると
  # ActiveModel::RangeError が投げられ、422 ではなく 500 になっていたため。
  # サークルの規模から現実的な値で、限界のずっと手前で止める。
  #
  # allow_nil は要る。nil = 無制限が仕様(spec-v2.2.md §2.3)で、
  # numericality は presence と違い nil をそのまま不正として弾く
  MAX_CAPACITY = 1000

  validates :capacity,
            numericality: {
              only_integer: true,
              greater_than: 0,
              less_than_or_equal_to: MAX_CAPACITY
            },
            allow_nil: true

  has_many :project_tags, dependent: :destroy
  has_many :tags, through: :project_tags
  # プロジェクトを消しても参加レコードは残す（project_id が NULL になる）ため
  # dependent は指定しない。DB側の ON DELETE SET NULL に任せる
  has_many :project_participations, dependent: nil
  # 抜けた人を外したもの。数える・並べるのは常にこちらを使う
  # (Event の active_event_participations と同じ形)
  has_many :active_project_participations,
           -> { active },
           class_name: "ProjectParticipation",
           inverse_of: :project,
           dependent: nil
end
