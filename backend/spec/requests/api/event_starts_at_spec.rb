require "rails_helper"

# 過去の日時でイベントを作らせない(2026-09-12 の監査)を API 越しに確かめる。
# モデルの境界はモデルspecで見ているので、ここはステータスだけを見る。
RSpec.describe "開催日時（API）", type: :request do
  let(:user) { create(:user) }

  before { sign_in(user) }

  def create_event(starts_at)
    post "/api/events",
         params: {
           event: {
             title: "開催日時の検査", description: "説明", location: "部室A",
             starts_at: starts_at.iso8601
           }
         },
         as: :json
  end

  it "過去の日時は 422 を返す" do
    create_event(10.years.ago)

    expect(response).to have_http_status(:unprocessable_entity)
    expect(Event.where(title: "開催日時の検査")).to be_empty
  end

  it "未来の日時は作成できる" do
    create_event(3.days.from_now)

    expect(response).to have_http_status(:created)
  end

  # 開催当日は23時まで残る(SAME_DAY_CUTOFF_HOUR)。一覧に出る日時なら作れる
  it "当日の朝の予定を昼に登録できる" do
    travel_to(Time.zone.local(2026, 9, 12, 14, 0)) do
      create_event(Time.zone.local(2026, 9, 12, 10, 0))

      expect(response).to have_http_status(:created)
    end
  end

  # 更新では見ない。開催済みのイベントの説明を直せなくなるため
  it "開催済みのイベントは更新できる" do
    event = create(:event, starts_at: 10.days.ago, owner: user)
    patch "/api/events/#{event.id}",
          params: { event: { description: "終わったあとの追記" } }, as: :json

    expect(response).to have_http_status(:ok)
  end
end
