require "rails_helper"

# 注目スコア。このプロジェクトの中核であり、面接で最も詳しく説明する部分。
#
#   spotlight_score = 開催間近ボーナス × 15 + 直近3日間の参加増加数 × 10
#   開催間近ボーナス = max(0, 14 - 開催までの日数)
#
# 設計思想は「締切感が主、勢いが従」(spec-v2.2.md §3.2)。
# 開催間近ボーナスの寄与は 0〜210、勢いは現実的に 0〜50 に収まるため、
# 勢いだけで開催の遠い企画が上位に来ることはない。
# 参加者数の絶対値を使わないのは、すでに人気の企画がさらに有利になるだけで、
# 参加促進というサイネージの目的に寄与しないため。
RSpec.describe Event, "#calculate_spotlight_score" do
  # 日単位の境界を確かめるので、実行時刻に結果が左右されないよう固定する
  around { |example| travel_to(Time.zone.local(2026, 6, 15, 12, 0, 0)) { example.run } }

  def event_starting_in(days)
    create(:event, starts_at: (Date.current + days).in_time_zone.change(hour: 19))
  end

  describe "開催間近ボーナス（締切感）" do
    it "開催まで15日なら 0 になる" do
      expect(event_starting_in(15).calculate_spotlight_score).to eq(0)
    end

    # 境界。14 - 14 = 0
    it "開催まで14日でも 0 になる（境界）" do
      expect(event_starting_in(14).calculate_spotlight_score).to eq(0)
    end

    # 境界の内側。1 × 15
    it "開催まで13日なら 15 になる" do
      expect(event_starting_in(13).calculate_spotlight_score).to eq(15)
    end

    # 最大値。14 × 15
    it "開催当日なら 210 になる" do
      expect(event_starting_in(0).calculate_spotlight_score).to eq(210)
    end

    it "開催まで1日なら 195 になる" do
      expect(event_starting_in(1).calculate_spotlight_score).to eq(195)
    end
  end

  describe "勢い（直近3日の参加増加数）" do
    let(:event) { event_starting_in(14) } # 開催間近ボーナスを0にして勢いだけを見る

    it "参加者が0人なら勢い成分は 0" do
      expect(event.calculate_spotlight_score).to eq(0)
    end

    it "直近3日の参加1件につき 10 加算される" do
      create(:event_participation, event: event, created_at: 1.day.ago)
      create(:event_participation, event: event, created_at: 2.days.ago)

      expect(event.calculate_spotlight_score).to eq(20)
    end

    # 窓は3日(spec-v2.2.md §3.3)。48時間だと日次更新と噛み合わないため3日にしている
    it "4日前の参加は集計に含まれない" do
      create(:event_participation, event: event, created_at: 4.days.ago)

      expect(event.calculate_spotlight_score).to eq(0)
    end

    it "3日前ちょうどの参加は含まれる（境界）" do
      create(:event_participation, event: event, created_at: 3.days.ago + 1.minute)

      expect(event.calculate_spotlight_score).to eq(10)
    end

    # キャンセルは物理削除しないので、集計時に除外する必要がある(spec-v2.2.md §2.5)
    it "キャンセル済みの参加は集計に含まれない" do
      create(:event_participation, event: event, created_at: 1.day.ago, cancelled_at: 1.hour.ago)

      expect(event.calculate_spotlight_score).to eq(0)
    end

    it "他のイベントの参加は数えない" do
      create(:event_participation, event: event_starting_in(14), created_at: 1.day.ago)

      expect(event.calculate_spotlight_score).to eq(0)
    end
  end

  describe "締切感と勢いの合算" do
    it "開催まで13日で直近参加2件なら 15 + 20 = 35" do
      event = event_starting_in(13)
      2.times { create(:event_participation, event: event, created_at: 1.day.ago) }

      expect(event.calculate_spotlight_score).to eq(35)
    end

    # 設計思想の確認: 勢いだけで開催の遠い企画が上位に来ない
    it "勢いが最大でも、開催の近い企画を追い越さない" do
      far = event_starting_in(14)
      5.times { create(:event_participation, event: far, created_at: 1.day.ago) }
      near = event_starting_in(10) # 4 × 15 = 60

      expect(far.calculate_spotlight_score).to eq(50)
      expect(near.calculate_spotlight_score).to eq(60)
      expect(near.calculate_spotlight_score).to be > far.calculate_spotlight_score
    end
  end
end

# spec-v2.2.md §3.5「表示対象から外す条件」。
# 計算式そのものではなく、どのイベントをサイネージに載せるかの条件。
#
# ここを分けているのには理由がある。開催日が過去のイベントは days_until が
# 負になり、開催間近ボーナスが 14 を超えて**スコアが最大級に高くなる**。
# つまり計算式だけに任せると、終わったイベントが先頭に居座る。
RSpec.describe Event, ".spotlight_targets" do
  around { |example| travel_to(Time.zone.local(2026, 6, 15, 12, 0, 0)) { example.run } }

  def event_starting_in(days, **attrs)
    create(:event, starts_at: (Date.current + days).in_time_zone.change(hour: 19), **attrs)
  end

  it "開催日が過去のイベントは対象から外す" do
    past = event_starting_in(-1)

    expect(Event.spotlight_targets).not_to include(past)
  end

  it "過去のイベントはスコアだけ見ると高くなってしまう（除外が必要な理由）" do
    past = event_starting_in(-1)

    # 14 - (-1) = 15 → 15 × 15 = 225。開催当日の 210 より高い
    expect(past.calculate_spotlight_score).to eq(225)
  end

  it "status: completed は対象から外す" do
    completed = event_starting_in(3, status: :completed)

    expect(Event.spotlight_targets).not_to include(completed)
  end

  it "visibility: trashed は対象から外す" do
    trashed = event_starting_in(3)
    trashed.trashed!

    expect(Event.spotlight_targets).not_to include(trashed)
  end

  it "未来の募集中イベントは対象に含める" do
    upcoming = event_starting_in(3)

    expect(Event.spotlight_targets).to include(upcoming)
  end

  it "開催当日はまだ対象に含める" do
    today = event_starting_in(0)

    expect(Event.spotlight_targets).to include(today)
  end
end
