# whenever gem の設定。crontab を生成するためのファイルで、
# アプリの実行時には読み込まれない。
#
# **本番はこのファイルでは動かない。** 実行イメージは ruby:3.3-slim で cron が
# 入っておらず、whenever --update-crontab を打つ相手がいない。whenever は
# crontab を生成するだけの gem なので、生成先が要る。
# 本番で実際に動いているのは ops/crontab.example → VPS のホスト側 crontab で、
# そこから ops/spotlight.sh が docker compose exec する。
# **時刻を変えるときは両方直すこと。**
#
# ここを消していないのは、開発機で whenever --update-crontab を使えるように
# しておくため(手元で日次処理の動きを確かめたいときに要る)。
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
