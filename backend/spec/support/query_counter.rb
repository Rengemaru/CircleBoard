# 発行された SQL の本数を数えるヘルパー。
#
# N+1 は「動くが遅い」不具合なので、レスポンスの中身を見ても気づけない。
# 件数を変えてもクエリが増えないことを、テストで押さえられるようにする
# (CLAUDE.md §3-3)。gem は増やさない(§1)。
module QueryCounter
  # SCHEMA と TRANSACTION は件数に比例しないので数えない
  IGNORED_NAMES = [ "SCHEMA", "TRANSACTION" ].freeze

  def count_queries
    count = 0
    subscriber = ActiveSupport::Notifications.subscribe("sql.active_record") do |*, payload|
      count += 1 unless IGNORED_NAMES.include?(payload[:name])
    end

    yield
    count
  ensure
    ActiveSupport::Notifications.unsubscribe(subscriber)
  end
end

RSpec.configure do |config|
  config.include QueryCounter, type: :request
end
