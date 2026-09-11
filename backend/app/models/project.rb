class Project < ApplicationRecord
  enum :status, { recruiting: 0, in_progress: 1, completed: 2 }
  enum :visibility, { active: 0, trashed: 1 }
  # 🟡 DBだけ。UIとロジックは作らない
  enum :recurrence_type, { one_time: 0, recurring: 1 }, prefix: true

  belongs_to :owner, class_name: "User", optional: true

  # 定員判定。capacity が nil のときは無制限(spec-v2.2.md §2.3)。
  # イベントと違いキャンセルの概念が無いので、参加レコードをそのまま数える
  def full?
    capacity.present? && project_participations.size >= capacity
  end

  # DB の NOT NULL 制約に対応する presence のみ(spec-v2.2.md §2.3)。
  # activity_schedule / meeting_schedule / capacity は NULL可なので付けない
  # 文字数の上限(2026-09-12 の監査で追加。オーナー承認済み)。
  #
  # **PostgreSQL の varchar は桁数を書かなければ無制限**で、Rails の t.string は
  # 桁数を書かない。MySQL の VARCHAR(255) のような暗黙の上限が無いので、
  # 上限は書いたところにしか生まれない。
  #
  # 実際、10MB のタイトルを持つイベントが 201 で保存でき、未ログインでも叩ける
  # GET /api/events の応答が 11.5MB になっていた。一覧が崩れるだけの話ではなく、
  # 部員なら誰でも公開APIを重くできる状態だった。
  #
  # DBのカラムには桁数を入れない。マイグレーションを伴わせず、
  # spec-v2.2.md §2(確定済み)に触れないため(オーナー決定 2026-09-12)
  MAX_TITLE_LENGTH = 100
  MAX_DESCRIPTION_LENGTH = 2000
  # 「毎週土曜」「毎週水曜 19:00〜」程度の自由記述。予定表を貼る欄ではない
  MAX_SCHEDULE_LENGTH = 100

  validates :title, presence: true, length: { maximum: MAX_TITLE_LENGTH }
  validates :description, presence: true, length: { maximum: MAX_DESCRIPTION_LENGTH }
  validates :activity_schedule, length: { maximum: MAX_SCHEDULE_LENGTH }
  validates :meeting_schedule, length: { maximum: MAX_SCHEDULE_LENGTH }

  has_many :project_tags, dependent: :destroy
  has_many :tags, through: :project_tags
  # プロジェクトを消しても参加レコードは残す（project_id が NULL になる）ため
  # dependent は指定しない。DB側の ON DELETE SET NULL に任せる
  has_many :project_participations
end
