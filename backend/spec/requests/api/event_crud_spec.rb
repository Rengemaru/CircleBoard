require "rails_helper"

RSpec.describe "イベントの作成・編集・論理削除", type: :request do
  let(:owner) { create(:user) }
  let(:other) { create(:user) }
  let(:admin) { create(:user, role: :admin) }
  let(:valid_params) do
    {
      event: {
        title: "LT大会 vol.14", description: "5分間のLT", location: "情報棟202",
        starts_at: 10.days.from_now.iso8601, capacity: 30
      }
    }
  end

  describe "POST /api/events" do
    it "未ログインでは 401 を返す" do
      post "/api/events", params: valid_params, as: :json

      expect(response).to have_http_status(:unauthorized)
      expect(response.parsed_body.keys).to eq([ "error" ])
      expect(response.parsed_body["error"]["code"]).to eq("unauthorized")
    end

    it "ログインしていれば作成でき、201 を返す" do
      sign_in(owner)

      post "/api/events", params: valid_params, as: :json

      expect(response).to have_http_status(:created)
      expect(Event.find(response.parsed_body["id"]).title).to eq("LT大会 vol.14")
    end

    # リクエストの owner_id を信用しない(docs/api-spec.md §2)。
    # 信用すると、他人を企画者に仕立てられる
    it "リクエストの owner_id を無視し、ログイン中のユーザーを owner にする" do
      sign_in(owner)
      params = valid_params.deep_dup
      params[:event][:owner_id] = admin.id

      post "/api/events", params: params, as: :json

      expect(Event.find(response.parsed_body["id"]).owner_id).to eq(owner.id)
    end

    it "必須項目が欠けていると 422 を返す" do
      sign_in(owner)
      params = valid_params.deep_dup
      params[:event][:title] = ""

      post "/api/events", params: params, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.parsed_body.keys).to eq([ "error" ])
      expect(response.parsed_body["error"].keys).to contain_exactly("code", "message")
    end
  end

  describe "PATCH /api/events/:id" do
    let!(:event) { create(:event, owner: owner) }

    it "owner 本人は編集できる" do
      sign_in(owner)

      patch "/api/events/#{event.id}", params: { event: { title: "変更後" } }, as: :json

      expect(response).to have_http_status(:ok)
      expect(event.reload.title).to eq("変更後")
    end

    it "admin は他人の企画でも編集できる" do
      sign_in(admin)

      patch "/api/events/#{event.id}", params: { event: { title: "管理者が修正" } }, as: :json

      expect(response).to have_http_status(:ok)
    end

    it "無関係なメンバーは 403 を返し、内容が変わらない" do
      sign_in(other)

      patch "/api/events/#{event.id}", params: { event: { title: "乗っ取り" } }, as: :json

      expect(response).to have_http_status(:forbidden)
      expect(response.parsed_body.keys).to eq([ "error" ])
      expect(response.parsed_body["error"].keys).to contain_exactly("code", "message")
      expect(response.parsed_body["error"]["code"]).to eq("forbidden")
      expect(event.reload.title).not_to eq("乗っ取り")
    end

    it "未ログインは 401 を返す" do
      patch "/api/events/#{event.id}", params: { event: { title: "変更" } }, as: :json

      expect(response).to have_http_status(:unauthorized)
    end

    # 論理削除済みの企画を他人が編集しようとしたとき、403 ではなく 404 が先に返る。
    # 403 だと「消された企画がそこにある」ことが分かってしまう
    it "論理削除済みの企画は、他人が編集しようとしても 404 を返す" do
      event.trashed!
      sign_in(other)

      patch "/api/events/#{event.id}", params: { event: { title: "乗っ取り" } }, as: :json

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "DELETE /api/events/:id" do
    let!(:event) { create(:event, owner: owner) }

    it "owner 本人は論理削除でき、204 を返す。物理削除はしない" do
      sign_in(owner)

      delete "/api/events/#{event.id}"

      expect(response).to have_http_status(:no_content)
      expect(event.reload).to be_trashed
      expect(Event.find_by(id: event.id)).to be_present
    end

    it "無関係なメンバーは 403 を返し、削除されない" do
      sign_in(other)

      delete "/api/events/#{event.id}"

      expect(response).to have_http_status(:forbidden)
      expect(event.reload).to be_active
    end
  end

  # 論理削除済みは一覧にも出さない(T1-6 で Event.active に絞っている)
  it "論理削除済みのイベントは一覧に出ない" do
    event = create(:event, owner: owner)
    event.trashed!

    get "/api/events"

    expect(response.parsed_body["events"].map { _1["id"] }).not_to include(event.id)
  end
end
