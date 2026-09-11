require "rails_helper"

# レート制限(spec-v2.2.md §7.5 A-3 / A-4)。
#
# :rack_attack を付けた spec だけで制限が有効になる(spec/rails_helper.rb)。
# 上限を超えたときだけでなく、上限内が通ることも確かめる。片方だけだと
# 「常に429を返す実装」でも通ってしまう。
RSpec.describe "レート制限", type: :request, rack_attack: true do
  # Rack::Attack は「Time.now.to_i / period が同じ値の間だけ数える」時間窓で判定する。
  # 実時間のまま31回続けて叩くと、途中で窓が切り替わることがあり、最後の1回が
  # 新しい窓の1件目になって 429 ではなく 200 が返る。同じコードで再実行すると通るため、
  # CI がランダムに落ちる原因になっていた(Issue #205)。
  #
  # 時刻を止めれば窓は跨ぎようがない。travel_to は Rails 標準
  # (ActiveSupport::Testing::TimeHelpers、rails_helper.rb で include 済み)なので、
  # Timecop のような gem を増やさずに済む。
  #
  # 秒を0に合わせるのは、止めた時刻が窓のどこにいるかを読んで分かるようにするため。
  around do |example|
    travel_to(Time.current.change(sec: 0)) { example.run }
  end

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
