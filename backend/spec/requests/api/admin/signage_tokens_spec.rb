require "rails_helper"

# サイネージトークンの管理(docs/api-spec.md §6)。
# 端末ごとに発行し、漏れたらその端末の分だけ止められるようにする。
RSpec.describe "Api::Admin::SignageTokens", type: :request do
  let(:admin) { create(:user, role: :admin) }
  let(:member) { create(:user) }

  describe "GET /api/admin/signage_tokens" do
    it "未ログインでは 401 を返す" do
      get "/api/admin/signage_tokens"

      expect(response).to have_http_status(:unauthorized)
    end

    it "一般メンバーでは 403 を返す" do
      sign_in(member)

      get "/api/admin/signage_tokens"

      expect(response).to have_http_status(:forbidden)
    end

    it "管理者は一覧を取得できる" do
      token = create(:signage_token, name: "部室メインディスプレイ")
      sign_in(admin)

      get "/api/admin/signage_tokens"

      expect(response).to have_http_status(:ok)
      first = response.parsed_body["signage_tokens"].first
      expect(first["id"]).to eq(token.id)
      expect(first["name"]).to eq("部室メインディスプレイ")
    end

    # 管理画面はトークンの実値とURLを見せる必要がある。
    # 端末に貼り付けるのが目的で、ここだけは伏せない
    it "token と url を返す" do
      token = create(:signage_token)
      sign_in(admin)

      get "/api/admin/signage_tokens"

      first = response.parsed_body["signage_tokens"].first
      expect(first["token"]).to eq(token.token)
      expect(first["url"]).to eq("#{ENV.fetch('PUBLIC_BASE_URL')}/signage?token=#{token.token}")
    end

    it "api-spec §6 のキーだけを返す" do
      create(:signage_token)
      sign_in(admin)

      get "/api/admin/signage_tokens"

      expect(response.parsed_body["signage_tokens"].first.keys).to contain_exactly(
        "id", "name", "token", "url", "revoked_at", "created_at"
      )
    end

    # 行を消さないので、失効したものも一覧に出る。
    # どのトークンをいつ止めたかを管理画面から追える
    it "失効済みのトークンも revoked_at つきで返す" do
      revoked = create(:signage_token, revoked_at: 1.day.ago)
      sign_in(admin)

      get "/api/admin/signage_tokens"

      found = response.parsed_body["signage_tokens"].find { _1["id"] == revoked.id }
      expect(found["revoked_at"]).to be_present
    end
  end

  describe "POST /api/admin/signage_tokens" do
    it "一般メンバーでは 403 を返し、発行しない" do
      sign_in(member)

      expect { post "/api/admin/signage_tokens", params: { signage_token: { name: "x" } }, as: :json }
        .not_to change(SignageToken, :count)

      expect(response).to have_http_status(:forbidden)
    end

    it "管理者はトークンを発行できる" do
      sign_in(admin)

      expect {
        post "/api/admin/signage_tokens",
             params: { signage_token: { name: "部室サブディスプレイ" } }, as: :json
      }.to change(SignageToken, :count).by(1)

      expect(response).to have_http_status(:created)
    end

    # SecureRandom.hex(16) = 32文字(spec-v2.2.md §2.7)
    it "token は32文字の16進文字列で自動生成される" do
      sign_in(admin)

      post "/api/admin/signage_tokens", params: { signage_token: { name: "端末A" } }, as: :json

      expect(response.parsed_body["token"]).to match(/\A[0-9a-f]{32}\z/)
    end

    # リクエストの token を信用すると、推測しやすい値を外から設定できてしまう
    it "リクエストで token を指定しても無視する" do
      sign_in(admin)

      post "/api/admin/signage_tokens",
           params: { signage_token: { name: "端末B", token: "guessable" } }, as: :json

      expect(response.parsed_body["token"]).not_to eq("guessable")
    end

    it "name が無いと 422 を返す" do
      sign_in(admin)

      post "/api/admin/signage_tokens", params: { signage_token: { name: "" } }, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "DELETE /api/admin/signage_tokens/:id" do
    let!(:token) { create(:signage_token) }

    it "一般メンバーでは 403 を返し、失効しない" do
      sign_in(member)

      delete "/api/admin/signage_tokens/#{token.id}"

      expect(response).to have_http_status(:forbidden)
      expect(token.reload.revoked_at).to be_nil
    end

    # 行を消さない。どのトークンをいつ止めたかの記録を残す(api-spec.md §6)
    it "管理者は失効でき、行は消さずに revoked_at を入れる" do
      sign_in(admin)

      expect { delete "/api/admin/signage_tokens/#{token.id}" }
        .not_to change(SignageToken, :count)

      expect(response).to have_http_status(:no_content)
      expect(token.reload.revoked_at).to be_present
    end

    it "失効させたトークンではサイネージAPIが 404 になる" do
      sign_in(admin)
      delete "/api/admin/signage_tokens/#{token.id}"

      get "/api/signage", params: { token: token.token }

      expect(response).to have_http_status(:not_found)
    end

    it "存在しないIDは 404 を返す" do
      sign_in(admin)

      delete "/api/admin/signage_tokens/999999"

      expect(response).to have_http_status(:not_found)
    end
  end
end
