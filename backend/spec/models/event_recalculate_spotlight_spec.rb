require "rails_helper"

# 注目スコアの日次更新(spec-v2.2.md §3.4)。
# cron から呼ばれる入口。計算そのものは calculate_spotlight_score の担当で、
# ここは「どのイベントを対象に、どう書き戻すか」を受け持つ。
RSpec.describe Event, ".recalculate_spotlight_scores" do
  around { |example| travel_to(Time.zone.local(2026, 6, 15, 7, 0, 0)) { example.run } }

  def event_starting_in(days, **attrs)
    create(:event, starts_at: (Date.current + days).in_time_zone.change(hour: 19), **attrs)
  end

  it "spotlight_score を計算結果で更新する" do
    event = event_starting_in(13) # 1 × 15

    expect { described_class.recalculate_spotlight_scores }
      .to change { event.reload.spotlight_score }.from(0).to(15)
  end

  it "複数のイベントをまとめて更新する" do
    near = event_starting_in(1)  # 13 × 15 = 195
    far = event_starting_in(20)  # 0

    described_class.recalculate_spotlight_scores

    expect(near.reload.spotlight_score).to eq(195)
    expect(far.reload.spotlight_score).to eq(0)
  end

  # 論理削除済みはサイネージに出ないので、計算する意味がない
  it "論理削除済みのイベントは更新しない" do
    trashed = event_starting_in(13)
    trashed.trashed!

    expect { described_class.recalculate_spotlight_scores }
      .not_to change { trashed.reload.spotlight_score }
  end

  # 集計の書き戻しで updated_at を動かすと、「いつ編集されたか」が分からなくなる。
  # 毎日全件の updated_at が変わるのは、履歴として意味のないノイズになる
  it "updated_at を変更しない" do
    event = event_starting_in(13)
    before = event.reload.updated_at

    described_class.recalculate_spotlight_scores

    expect(event.reload.updated_at).to eq(before)
  end

  # 開催日が過去のイベントはスコアが最大級に高くなる(§3.5 で表示対象から外す)。
  # スコア自体は計算しておき、表示するかどうかは spotlight_targets が決める。
  # 責務を分けておくと、除外条件が変わってもこのメソッドを触らなくてよい
  it "開催日が過去のイベントもスコアは更新する（表示可否は別の責務）" do
    past = event_starting_in(-1)

    described_class.recalculate_spotlight_scores

    expect(past.reload.spotlight_score).to eq(225)
    expect(Event.spotlight_targets).not_to include(past)
  end

  it "参加者の勢いを反映する" do
    event = event_starting_in(14) # 開催間近ボーナスは0
    2.times { create(:event_participation, event: event, created_at: 1.day.ago) }

    described_class.recalculate_spotlight_scores

    expect(event.reload.spotlight_score).to eq(20)
  end
end
