class Event < ApplicationRecord
  enum :status, { recruiting: 0, completed: 1 }
  enum :visibility, { active: 0, trashed: 1 }
  # 🟡 DBだけ。UIとロジックは作らない
  enum :recurrence_type, { one_time: 0, recurring: 1 }, prefix: true

  belongs_to :owner, class_name: "User", optional: true

  # DB の NOT NULL 制約に対応する presence のみ(仕様書 §2.2)。
  # 一意性や数値範囲など、仕様書に無い検証は足さない。
  # DB制約だけだと保存時に例外が飛び、フォームにエラーを返せないため
  # アプリ層にも同じ制約を置いている。
  # 注目スコアの係数(spec-v2.2.md §3.1/§3.4)。
  #
  #   spotlight_score = 開催間近ボーナス × 15 + 直近3日間の参加増加数 × 10
  #   開催間近ボーナス = max(0, 14 - 開催までの日数)
  #
  # 締切感が主、勢いが従。開催間近ボーナスの寄与は 0〜210、勢いは現実的に
  # 0〜50 なので、勢いだけで開催の遠い企画が上位に来ることはない(§3.2)。
  SPOTLIGHT_IMMINENCE_WEIGHT = 15
  SPOTLIGHT_MOMENTUM_WEIGHT = 10
  SPOTLIGHT_IMMINENCE_WINDOW = 14 # 日
  SPOTLIGHT_MOMENTUM_WINDOW = 3   # 日

  # サイネージに載せる候補(spec-v2.2.md §3.5)。
  #
  # 計算式から分けているのは、開催日が過去のイベントは days_until が負になり、
  # 開催間近ボーナスが 14 を超えて**スコアが最大級に高くなる**ため。
  # 例: 昨日開催 → 14 - (-1) = 15 → 225。開催当日の 210 より高い。
  # 計算式だけに任せると、終わったイベントがサイネージの先頭に居座る。
  #
  # 開催当日は23時まで載せ、23時を過ぎたら落とす(§3.5 の括弧書き)。
  # 日付が変わるまで載せ続けると、深夜に「今日開催」と出続けてしまう
  SPOTLIGHT_SAME_DAY_CUTOFF_HOUR = 23

  scope :spotlight_targets, lambda {
    from = if Time.current.hour >= SPOTLIGHT_SAME_DAY_CUTOFF_HOUR
             Date.current.tomorrow.in_time_zone
    else
             Time.current.beginning_of_day
    end

    active.recruiting.where(starts_at: from..)
  }

  # 参加者数の絶対値は使わない。すでに人気の企画がさらに有利になるだけで、
  # 参加促進というサイネージの目的に寄与しないため(§3.2)
  def calculate_spotlight_score
    days_until = (starts_at.to_date - Date.current).to_i
    imminence = [ 0, SPOTLIGHT_IMMINENCE_WINDOW - days_until ].max
    # キャンセルは物理削除しないので、集計時に除外する(§2.5)。
    # 窓を48時間ではなく3日にしているのは、日次更新と噛み合わせるため(§3.3)
    momentum = event_participations
                 .where(cancelled_at: nil)
                 .where(created_at: SPOTLIGHT_MOMENTUM_WINDOW.days.ago..)
                 .count

    imminence * SPOTLIGHT_IMMINENCE_WEIGHT + momentum * SPOTLIGHT_MOMENTUM_WEIGHT
  end

  # 定員判定はここ1箇所。capacity が nil のときは無制限(仕様書 §2.2)。
  # フロントでボタンを隠すのは表示の話であって制限ではないので、API側で必ず使う
  def full?
    capacity.present? && active_event_participations.size >= capacity
  end

  validates :title, presence: true
  validates :description, presence: true
  validates :location, presence: true
  validates :starts_at, presence: true

  has_many :event_tags, dependent: :destroy
  has_many :tags, through: :event_tags
  # DB側の ON DELETE CASCADE と二重になるが、Rails 経由の削除でも
  # モデルのコールバックが走るよう明示しておく。
  # Project 側は逆に DB 任せにしている(理由は project.rb のコメント)
  has_many :event_participations, dependent: :destroy

  # 参加者数を数えるための、スコープ付きの関連。
  # event_participations.active.size と書くと、includes で事前ロード済みでも
  # スコープ呼び出しでキャッシュが捨てられ、1件ごとに COUNT が飛ぶ(実測済み)。
  # 関連側にスコープを付けておけば includes がその条件のまま先読みするので、
  # イベントが何件でもSQLは1本で済む。
  has_many :active_event_participations,
           -> { active },
           class_name: "EventParticipation",
           inverse_of: :event,
           dependent: nil
end
