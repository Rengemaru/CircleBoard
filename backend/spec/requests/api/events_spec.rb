require "rails_helper"

RSpec.describe "GET /api/events", type: :request do
  # 企画者の実名がインターネットに露出しないことの確認(仕様書 §0.1 #8、§4.1)。
  # フロントで隠すのは禁止で、APIレスポンスから落ちている必要がある(CLAUDE.md §3-2)。
  it "未ログインでは owner を返さない" do
    create(:event)

    get "/api/events"

    expect(response).to have_http_status(:ok)
    events = response.parsed_body["events"]
    expect(events.size).to eq(1)
    expect(events.first).not_to have_key("owner")
  end
end
