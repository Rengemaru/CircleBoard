class Event < ApplicationRecord
  enum :status, { recruiting: 0, completed: 1 }
  enum :visibility, { active: 0, trashed: 1 }
  # 🟡 DBだけ。UIとロジックは作らない
  enum :recurrence_type, { one_time: 0, recurring: 1 }, prefix: true

  belongs_to :owner, class_name: "User", optional: true

  # presence は DB の NOT NULL 制約に対応させる(仕様書 §2.2)。
  # DB制約だけだと保存時に例外が飛び、フォームにエラーを返せないため
  # アプリ層にも同じ制約を置いている。
  #
  # 長さの上限は NULL可の列にも付ける。maximum だけの検証は nil も空文字も
  # 通すので、必須かどうかとは独立して置ける。
  #
  # 以前は「仕様書に無い検証は足さない」としていたが、上限が1つも無く
  # 10MB のタイトルが保存できる状態だったため、2026-09-12 の監査を経て
  # 長さだけ足した(オーナー承認済み)。
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
  # 【鮮度が二重になっていることに注意】
  # spotlight_score は cron が毎日7時に書き戻したスナップショット。
  # 一方このスコープは呼ばれるたびに Time.current を見るライブな判定。
  # そのため「スコアは朝の値だが、23時を過ぎた瞬間に対象から外れる」という
  # 挙動になる。意図的にそうしている:
  #   - スコアを毎リクエスト計算すると、60秒ごとに叩かれるサイネージで
  #     全イベント分のCOUNTが走る
  #   - 一方、表示可否は「今この瞬間」で判断しないと、深夜に「今日開催」が
  #     出続けるなどの実害が出る
  # 順位が入れ替わるのは1日1回でよいが、載せる/外すは即座に効かせたい。
  #
  # 計算式から分けているのは、開催日が過去のイベントは days_until が負になり、
  # 開催間近ボーナスが 14 を超えて**スコアが最大級に高くなる**ため。
  # 例: 昨日開催 → 14 - (-1) = 15 → 225。開催当日の 210 より高い。
  # 計算式だけに任せると、終わったイベントがサイネージの先頭に居座る。
  #
  # 開催当日は23時まで載せ、23時を過ぎたら落とす(§3.5 の括弧書き)。
  # 日付が変わるまで載せ続けると、深夜に「今日開催」と出続けてしまう。
  #
  # サイネージ専用の値ではないので SPOTLIGHT_ を付けない。
  # 一覧APIも同じ基準で「まだ開催されていない」を判断する(upcoming 参照)
  SAME_DAY_CUTOFF_HOUR = 23

  # まだ開催されていないもの。この判定はここ1箇所だけに置く。
  # サイネージ(spotlight_targets)と一覧API(EventsController#index)が
  # 別々に「開催日 > 今」と書くと、23時台だけ食い違う
  scope :upcoming, lambda {
    from = if Time.current.hour >= SAME_DAY_CUTOFF_HOUR
             Date.current.tomorrow.in_time_zone
    else
             Time.current.beginning_of_day
    end

    where(starts_at: from..)
  }

  scope :spotlight_targets, -> { active.recruiting.upcoming }

  # cron から毎日1回呼ばれる入口(spec-v2.2.md §3.4)。
  #
  # 論理削除済みは除く。サイネージに出ないので計算する意味がない。
  # 一方、開催日が過去のイベントはスコアを更新する。表示するかどうかは
  # spotlight_targets の責務で、ここで両方を判断すると除外条件が変わるたびに
  # このメソッドも直すことになる。
  #
  # update_column を使うのは updated_at を動かさないため。集計の書き戻しで
  # 毎日全件の updated_at が変わると、「いつ編集されたか」が読めなくなる。
  #
  # 1件につきCOUNTが1本飛ぶが、日次のバッチであり件数も部内の企画数なので
  # そのままにしている。まとめて集計する書き方より、計算式が1箇所に
  # 収まっている方が読んで分かる(CLAUDE.md §0)。
  def self.recalculate_spotlight_scores
    active.find_each do |event|
      event.update_column(:spotlight_score, event.calculate_spotlight_score)
    end
  end

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
  MAX_LOCATION_LENGTH = 100
  MAX_EXTERNAL_URL_LENGTH = 2000

  validates :title, presence: true, length: { maximum: MAX_TITLE_LENGTH }
  validates :description, presence: true, length: { maximum: MAX_DESCRIPTION_LENGTH }
  validates :location, presence: true, length: { maximum: MAX_LOCATION_LENGTH }
  validates :starts_at, presence: true
  # 任意項目。maximum だけの検証は nil も空文字も通すので allow_nil は付けない。
  #
  # 形式は2026-09-12 の監査で追加。javascript: で始まる文字列が保存でき、
  # 詳細画面がそれをそのまま <a href> に渡していた。
  # **実際には発火しなかった**(React 19 が描画時に差し替えていた)が、
  # 止めていたのはフレームワークであってこちらのコードではない状態だった。
  # プロフィールのリンクには最初から同じ検証がある(UserLink)。
  #
  # format には allow_blank が要る。未入力・空文字は「リンク無し」で通す
  validates :external_url,
            length: { maximum: MAX_EXTERNAL_URL_LENGTH },
            format: {
              with: HTTP_URL_SCHEME,
              message: "は http:// または https:// で始めてください",
              allow_blank: true
            }

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
  # allow_nil は要る。nil = 無制限が仕様(spec-v2.2.md §2.2/§2.3)で、
  # numericality は presence と違い nil をそのまま不正として弾く
  MAX_CAPACITY = 1000

  validates :capacity,
            numericality: {
              only_integer: true,
              greater_than: 0,
              less_than_or_equal_to: MAX_CAPACITY
            },
            allow_nil: true

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
