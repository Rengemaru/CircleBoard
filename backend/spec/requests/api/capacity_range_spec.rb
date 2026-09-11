require "rails_helper"

# 定員の範囲を API 越しに確かめる(2026-09-12 の監査)。
#
# モデルの検証はモデルspecで見ているが、**int4 を超える値は 500 になっていた**
# ので、HTTPのステータスまで見ないと直ったことを確認できない。
# 値の代入自体は通り、保存するときに ActiveModel::RangeError が投げられていた。
RSpec.describe "定員の範囲（API）", type: :request do
  let(:user) { create(:user) }

  before { sign_in(user) }

  def event_params(capacity)
    {
      event: {
        title: "定員の検査", description: "説明", location: "部室A",
        starts_at: 3.days.from_now.iso8601, capacity: capacity
      }
    }
  end

  it "int4 を超える定員は 500 ではなく 422 を返す" do
    post "/api/events", params: event_params(2_147_483_648), as: :json

    expect(response).to have_http_status(:unprocessable_entity)
    expect(Event.where(title: "定員の検査")).to be_empty
  end

  # 監査で実際に 201 が返っていた値
  it "負の定員は 422 を返す" do
    post "/api/events", params: event_params(-5), as: :json

    expect(response).to have_http_status(:unprocessable_entity)
  end

  it "1〜1000 は作成できる" do
    post "/api/events", params: event_params(20), as: :json

    expect(response).to have_http_status(:created)
    expect(response.parsed_body["capacity"]).to eq(20)
  end

  it "未入力なら無制限として作成できる" do
    post "/api/events", params: event_params(nil), as: :json

    expect(response).to have_http_status(:created)
    expect(response.parsed_body["capacity"]).to be_nil
  end

  it "プロジェクトでも int4 を超える定員が 422 になる" do
    post "/api/projects",
         params: { project: { title: "定員の検査", description: "説明", capacity: 2_147_483_648 } },
         as: :json

    expect(response).to have_http_status(:unprocessable_entity)
  end
end
