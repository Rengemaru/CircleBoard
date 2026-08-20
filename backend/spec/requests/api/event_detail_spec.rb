require "rails_helper"

# 詳細API。一覧と同じ EventSerializer を通すこと自体が要求(CLAUDE.md §3-2)。
RSpec.describe "GET /api/events/:id", type: :request do
  let(:owner) { create(:user, name: "佐藤花子") }
  let(:event) { create(:event, owner: owner) }

  context "未ログイン" do
    # 値を null や空配列で返すのではなく、キーごと存在しないことを確かめる。
    # キーがあること自体が「参加者情報が存在する」という情報になるため
    it "owner / participants / current_user_joined をキーごと返さない" do
      get "/api/events/#{event.id}"

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body.keys).not_to include("owner", "participants", "current_user_joined")
    end
  end

  context "ログイン済み" do
    it "owner / participants / current_user_joined を返す" do
      member = create(:user, name: "山田太郎")
      create(:event_participation, event: event, user: member)
      sign_in(member)

      get "/api/events/#{event.id}"

      body = response.parsed_body
      expect(body["owner"]).to eq("id" => owner.id, "name" => owner.name)
      expect(body["participants"]).to eq([ { "id" => member.id, "name" => member.name } ])
      expect(body["current_user_joined"]).to be(true)
    end

    it "キャンセル済みの参加者は participants に含めない" do
      member = create(:user)
      other = create(:user)
      create(:event_participation, event: event, user: member)
      create(:event_participation, event: event, user: other, cancelled_at: 1.day.ago)
      sign_in(member)

      get "/api/events/#{event.id}"

      expect(response.parsed_body["participants"].map { _1["id"] }).to eq([ member.id ])
    end
  end

  # 存在を隠したいものは404を返す(docs/api-spec.md §0)。
  # 403だと「消されたイベントがそこにある」ことが分かってしまう
  it "論理削除済みは 404 を返す" do
    event.trashed!

    get "/api/events/#{event.id}"

    expect(response).to have_http_status(:not_found)
    expect(response.parsed_body.keys).to eq([ "error" ])
    expect(response.parsed_body["error"]["code"]).to eq("not_found")
  end
end
