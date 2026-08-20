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

  # 「常に owner を返さない実装」でも上のテストは通ってしまうため、
  # 逆方向も確かめる。同じ EventSerializer の分岐が両方向で効いていることの確認
  it "ログイン時は owner を返す" do
    user = create(:user)
    event = create(:event, owner: user)
    sign_in(user)

    get "/api/events"

    owner = response.parsed_body["events"].first["owner"]
    expect(owner).to eq("id" => event.owner.id, "name" => event.owner.name)
  end
end
