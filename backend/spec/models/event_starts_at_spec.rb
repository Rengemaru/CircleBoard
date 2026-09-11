require "rails_helper"

# 過去の日時でイベントを作らせない(2026-09-12 の監査で追加)。
#
# 10年前のイベントが作れていた。一覧は upcoming で隠すので表には出ないが、
# recalculate_spotlight_scores は active 全件を回すため、注目スコアだけが
# 巨大な値になる(imminence = 14 - (-3650))。
RSpec.describe "開催日時" do
  # create ではなく build を使う。factory は「開催日が過ぎたのに募集中のまま」の
  # 企画を用意するために、過去日時のときだけ検証を迂回する
  it "過去の日時では作れない" do
    event = build(:event, starts_at: 10.years.ago)

    expect(event).not_to be_valid
    expect(event.errors[:starts_at]).to be_present
  end

  it "未来の日時なら作れる" do
    expect(build(:event, starts_at: 3.days.from_now)).to be_valid
  end

  # 境目は upcoming と同じにしてある。一覧に出ない日時では作れない、
  # 一覧に出る日時なら作れる、が揃う
  describe "当日の扱い" do
    # 開催当日は23時まで一覧に残る(SAME_DAY_CUTOFF_HOUR)
    it "当日の朝の予定を昼に登録できる" do
      travel_to(Time.zone.local(2026, 9, 12, 14, 0)) do
        expect(build(:event, starts_at: Time.zone.local(2026, 9, 12, 10, 0))).to be_valid
      end
    end

    it "23時を過ぎたら当日の予定は登録できない" do
      travel_to(Time.zone.local(2026, 9, 12, 23, 30)) do
        expect(build(:event, starts_at: Time.zone.local(2026, 9, 12, 10, 0))).not_to be_valid
      end
    end

    it "前日は登録できない" do
      travel_to(Time.zone.local(2026, 9, 12, 14, 0)) do
        expect(build(:event, starts_at: Time.zone.local(2026, 9, 11, 10, 0))).not_to be_valid
      end
    end
  end

  # **更新では見ない。** 見ると、開催済みのイベントの説明を直せなくなる
  describe "更新" do
    it "開催済みのイベントの説明を直せる" do
      event = create(:event, starts_at: 10.days.ago, status: :completed)

      expect(event.update(description: "終わったあとの追記")).to be(true)
    end

    it "開催日が過ぎて募集中のままのイベントも直せる" do
      event = create(:event, starts_at: 2.days.ago)

      expect(event.update(status: :completed)).to be(true)
    end
  end

  # 終わった企画を記録として後から登録するのは普通の操作。seed もそうしている。
  # APIの作成は status を受け取らないので、この経路では必ず募集中になる
  it "終了として登録するなら過去でも作れる" do
    expect(build(:event, starts_at: 10.days.ago, status: :completed)).to be_valid
  end
end
