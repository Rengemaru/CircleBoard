# whenever gem の設定。crontab を生成するためのファイルで、
# アプリの実行時には読み込まれない。
#
# 本番への反映は Phase 5(D-8 初回デプロイ)で行う:
#   bundle exec whenever --update-crontab
#
# 出力先を明示しているのは、cron の実行結果が見えないと
# 「動いていないこと」に気づけないため。
set :output, "log/cron.log"
set :environment, ENV.fetch("RAILS_ENV", "production")

# 注目スコアの日次更新(spec-v2.2.md §3.4)。
# 7時にしているのは、部員が登校する前に当日分の並び順を確定させるため。
# 集計窓を48時間ではなく3日にしているのも、この日次更新と噛み合わせるため(§3.3)
every 1.day, at: "7:00 am" do
  runner "Event.recalculate_spotlight_scores"
end
