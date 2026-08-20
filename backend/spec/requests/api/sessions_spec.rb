require "rails_helper"

RSpec.describe "Api::Sessions", type: :request do
  let!(:user) { create(:user, email: "taro@example.ac.jp", password: "password123") }

  describe "POST /api/session" do
    it "正しい組み合わせならログインでき、ユーザーを返す" do
      post "/api/session", params: { email: user.email, password: "password123" }, as: :json

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["user"]).to include("id" => user.id, "name" => user.name)
    end

    # メールアドレスの存在有無を外部から調べられないようにする
    it "存在しないメールとパスワード違いで、同じ401と同じメッセージを返す" do
      post "/api/session", params: { email: "nobody@example.ac.jp", password: "password123" }, as: :json
      unknown_email = [ response.status, response.parsed_body ]

      post "/api/session", params: { email: user.email, password: "wrongpassword" }, as: :json
      wrong_password = [ response.status, response.parsed_body ]

      expect(unknown_email.first).to eq(401)
      expect(unknown_email).to eq(wrong_password)
    end

    # 認証情報をレスポンスに載せない(仕様書 §4.1 の表にない情報は出さない)
    it "email と password_digest を返さない" do
      post "/api/session", params: { email: user.email, password: "password123" }, as: :json

      expect(response.parsed_body["user"].keys).to contain_exactly("id", "name", "role")
    end
  end

  describe "GET /api/session" do
    # フロントの初期化で毎回叩くため、未ログインをエラー扱いにしない
    it "未ログインでも 401 ではなく 200 と null を返す" do
      get "/api/session"

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["user"]).to be_nil
    end

    it "ログイン後は自分を返す" do
      post "/api/session", params: { email: user.email, password: "password123" }, as: :json

      get "/api/session"

      expect(response.parsed_body["user"]).to include("id" => user.id)
    end
  end

  describe "DELETE /api/session" do
    it "ログアウトすると 204 を返し、以降は未ログインになる" do
      post "/api/session", params: { email: user.email, password: "password123" }, as: :json

      delete "/api/session"
      expect(response).to have_http_status(:no_content)

      get "/api/session"
      expect(response.parsed_body["user"]).to be_nil
    end
  end
end
