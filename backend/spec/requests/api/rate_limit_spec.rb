require "rails_helper"

# レート制限(spec-v2.2.md §7.5 A-3 / A-4)。
#
# :rack_attack を付けた spec だけで制限が有効になる(spec/rails_helper.rb)。
# 上限を超えたときだけでなく、上限内が通ることも確かめる。片方だけだと
# 「常に429を返す実装」でも通ってしまう。
RSpec.describe "レート制限", type: :request, rack_attack: true do
  describe "ログイン試行 (A-3)" do
    let(:user) { create(:user) }

    it "同一IPから5回までは制限されない" do
      LOGIN_ATTEMPTS_PER_MINUTE.times do
        post "/api/session", params: { email: user.email, password: "wrong" }, as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end

    it "6回目は429を返す" do
      (LOGIN_ATTEMPTS_PER_MINUTE + 1).times do
        post "/api/session", params: { email: user.email, password: "wrong" }, as: :json
      end

      expect(response).to have_http_status(:too_many_requests)
    end

    it "429のレスポンスは api-spec §0 のエラー形に従う" do
      (LOGIN_ATTEMPTS_PER_MINUTE + 1).times do
        post "/api/session", params: { email: user.email, password: "wrong" }, as: :json
      end

      body = response.parsed_body
      expect(body.keys).to contain_exactly("error")
      expect(body["error"].keys).to contain_exactly("code", "message")
      expect(body["error"]["code"]).to eq("too_many_requests")
    end

    it "正しいパスワードでも回数は数える" do
      # 総当たりは当たった時点で止まるので、成功したリクエストを数えないと
      # 「5回外して6回目に当てる」試行を素通りさせてしまう
      LOGIN_ATTEMPTS_PER_MINUTE.times do
        post "/api/session", params: { email: user.email, password: "password123" }, as: :json
      end

      post "/api/session", params: { email: user.email, password: "password123" }, as: :json
      expect(response).to have_http_status(:too_many_requests)
    end
  end

  describe "サイネージ (A-4)" do
    let(:signage_token) { create(:signage_token) }

    it "同一IPから30回までは制限されない" do
      SIGNAGE_REQUESTS_PER_MINUTE.times do
        get "/api/signage", params: { token: signage_token.token }
        expect(response).to have_http_status(:ok)
      end
    end

    it "31回目は429を返す" do
      (SIGNAGE_REQUESTS_PER_MINUTE + 1).times do
        get "/api/signage", params: { token: signage_token.token }
      end

      expect(response).to have_http_status(:too_many_requests)
    end
  end

  describe "制限の対象外" do
    it "イベント一覧は数えない" do
      # 未ログインでも見える画面なので、部室の共有回線から複数人が開いただけで
      # 止まってはいけない(spec-v2.2.md §4.1)
      (SIGNAGE_REQUESTS_PER_MINUTE + 1).times { get "/api/events" }

      expect(response).to have_http_status(:ok)
    end
  end
end
