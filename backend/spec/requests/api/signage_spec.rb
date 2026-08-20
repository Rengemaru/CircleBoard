require "rails_helper"

# サイネージ。部室ディスプレイ用に、必要なデータを1リクエストで返す
# (docs/api-spec.md §5)。60秒ごとに叩かれるため、リクエスト数を最小化する。
#
# 「トークン認証は通っているが current_user は nil」という状態(§0)。
# ここを混同すると事故る。
RSpec.describe "GET /api/signage", type: :request do
  let!(:token) { create(:signage_token) }

  def get_signage(params = {})
    get "/api/signage", params: { token: token.token }.merge(params)
  end

  describe "トークン認証" do
    it "有効なトークンなら 200 を返す" do
      get_signage

      expect(response).to have_http_status(:ok)
    end

    # 401 ではなく 404。トークンの存在有無を推測させないため(§0)
    it "トークンが無いと 404 を返す" do
      get "/api/signage"

      expect(response).to have_http_status(:not_found)
      expect(response.parsed_body["error"]["code"]).to eq("not_found")
    end

    it "存在しないトークンは 404 を返す" do
      get "/api/signage", params: { token: "invalid" }

      expect(response).to have_http_status(:not_found)
    end

    it "失効したトークンは 404 を返す" do
      token.update!(revoked_at: 1.hour.ago)

      get_signage

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "spotlight_events" do
    def event_starting_in(days, **attrs)
      create(:event, starts_at: (Date.current + days).in_time_zone.change(hour: 19), **attrs)
    end

    it "ピン留めを先頭に、残りは spotlight_score の降順で返す" do
      low = event_starting_in(10, spotlight_score: 10)
      high = event_starting_in(3, spotlight_score: 200)
      pinned = event_starting_in(12, spotlight_score: 1, pinned: true)

      get_signage

      ids = response.parsed_body["spotlight_events"].map { _1["id"] }
      expect(ids).to eq([ pinned.id, high.id, low.id ])
    end

    it "最大4件までしか返さない" do
      6.times { |i| event_starting_in(i + 1, spotlight_score: i) }

      get_signage

      expect(response.parsed_body["spotlight_events"].size).to eq(4)
    end

    it "開催日が過去 / completed / trashed を除外する" do
      past = event_starting_in(-1)
      completed = event_starting_in(3, status: :completed)
      trashed = event_starting_in(3)
      trashed.trashed!
      visible = event_starting_in(3)

      get_signage

      ids = response.parsed_body["spotlight_events"].map { _1["id"] }
      expect(ids).to eq([ visible.id ])
      expect(ids).not_to include(past.id, completed.id, trashed.id)
    end

    it "api-spec §5 のキーだけを返す" do
      event_starting_in(3)

      get_signage

      expect(response.parsed_body["spotlight_events"].first.keys).to contain_exactly(
        "id", "title", "starts_at", "days_until", "location", "description",
        "tags", "pinned", "detail_url"
      )
    end

    # 「トークン認証は通っているが current_user は nil」なので自動的に落ちる
    it "owner と participants を含めない" do
      event_starting_in(3, owner: create(:user))

      get_signage

      first = response.parsed_body["spotlight_events"].first
      expect(first.keys).not_to include("owner", "participants", "current_user_joined")
    end

    it "days_until を返す" do
      event_starting_in(3)

      get_signage

      expect(response.parsed_body["spotlight_events"].first["days_until"]).to eq(3)
    end

    # フロントでURLを組み立てない。サイネージ端末の設定に依存させないため
    it "detail_url をサーバー側で組み立てて返す" do
      event = event_starting_in(3)

      get_signage

      expect(response.parsed_body["spotlight_events"].first["detail_url"])
        .to eq("#{ENV.fetch('PUBLIC_BASE_URL')}/events/#{event.id}")
    end
  end

  describe "projects" do
    it "recruiting → in_progress の順で返し、completed は除外する" do
      in_progress = create(:project, status: :in_progress)
      completed = create(:project, status: :completed)
      recruiting = create(:project, status: :recruiting)

      get_signage

      ids = response.parsed_body["projects"].map { _1["id"] }
      expect(ids).to eq([ recruiting.id, in_progress.id ])
      expect(ids).not_to include(completed.id)
    end

    it "最大6件までしか返さない" do
      8.times { create(:project, status: :recruiting) }

      get_signage

      expect(response.parsed_body["projects"].size).to eq(6)
    end

    it "論理削除済みは除外する" do
      trashed = create(:project)
      trashed.trashed!

      get_signage

      expect(response.parsed_body["projects"].map { _1["id"] }).not_to include(trashed.id)
    end

    it "api-spec §5 のキーだけを返す" do
      create(:project)

      get_signage

      expect(response.parsed_body["projects"].first.keys).to contain_exactly(
        "id", "title", "status", "participants_count", "capacity",
        "meeting_schedule", "tags", "detail_url"
      )
    end

    it "owner と participants を含めない" do
      create(:project)

      get_signage

      expect(response.parsed_body["projects"].first.keys)
        .not_to include("owner", "participants", "current_user_joined")
    end
  end
end
