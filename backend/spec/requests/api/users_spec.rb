require "rails_helper"

# プロフィールの参照(docs/api-spec.md §4.5)。
# 未ログインに漏れないことと、他人のメールアドレスが出ないことを見る
# (spec-v2.2.md §4.1、CLAUDE.md §3-2)。
RSpec.describe "Api::Users", type: :request do
  let(:me) { create(:user, department: "情報工学科", bio: "テスト") }
  let(:other) { create(:user) }

  def login(user)
    post "/api/session", params: { email: user.email, password: "password123" }, as: :json
  end

  describe "GET /api/users/me" do
    it "未ログインは 401" do
      get "/api/users/me"

      expect(response).to have_http_status(:unauthorized)
    end

    it "自分の情報を返す" do
      login(me)
      get "/api/users/me"
      body = response.parsed_body

      expect(response).to have_http_status(:ok)
      expect(body["id"]).to eq me.id
      expect(body["department"]).to eq "情報工学科"
    end

    # 学年は年度の切り替わりを跨ぐ規則なのでサーバーが出す。
    # 時刻を固定しないと、1〜3月に実行したときだけ1つ手前の学年になる
    it "学年を返す" do
      travel_to(Date.new(2026, 9, 1)) do
        me.update!(enrollment_year: 2024, graduation_year: 2099)
        login(me)
        get "/api/users/me"

        expect(response.parsed_body["grade"]).to eq("B3")
      end
    end

    it "卒業していれば学年は null" do
      travel_to(Date.new(2026, 9, 1)) do
        me.update!(enrollment_year: 2018, graduation_year: 2022)
        login(me)
        get "/api/users/me"

        expect(response.parsed_body["grade"]).to be_nil
      end
    end

    it "自分にはメールアドレスを返す" do
      login(me)
      get "/api/users/me"

      expect(response.parsed_body).to have_key("email")
    end

    it "スキルとリンクを返す" do
      me.tags = [ create(:tag, name: "Web開発") ]
      create(:user_link, user: me, label: "GitHub", url: "https://github.com/x", position: 0)
      login(me)
      get "/api/users/me"
      body = response.parsed_body

      expect(body["tags"].map { _1["name"] }).to eq [ "Web開発" ]
      expect(body["links"].map { _1["label"] }).to eq [ "GitHub" ]
    end

    it "リンクは position の昇順で返る" do
      create(:user_link, user: me, label: "2番目", position: 1)
      create(:user_link, user: me, label: "1番目", position: 0)
      login(me)
      get "/api/users/me"

      expect(response.parsed_body["links"].map { _1["label"] }).to eq [ "1番目", "2番目" ]
    end
  end

  describe "GET /api/users/:id" do
    it "未ログインは 401" do
      get "/api/users/#{other.id}"

      expect(response).to have_http_status(:unauthorized)
    end

    it "ログインしていれば他人のプロフィールを返す" do
      login(me)
      get "/api/users/#{other.id}"

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["id"]).to eq other.id
    end

    # 他人のメールアドレスを配る理由がない
    it "他人のメールアドレスは返さない" do
      login(me)
      get "/api/users/#{other.id}"

      expect(response.parsed_body).not_to have_key("email")
    end

    it "自分を id で引いたときはメールアドレスを返す" do
      login(me)
      get "/api/users/#{me.id}"

      expect(response.parsed_body).to have_key("email")
    end

    # 管理画面の情報であって、プロフィールではない
    it "role と suspended_at はどちらでも返さない" do
      login(me)
      get "/api/users/#{other.id}"

      expect(response.parsed_body).not_to have_key("role")
      expect(response.parsed_body).not_to have_key("suspended_at")
    end

    it "存在しない id は 404" do
      login(me)
      get "/api/users/999999"

      expect(response).to have_http_status(:not_found)
    end

    # "me" が :id に吸われていないことの確認
    it "/api/users/me が show ではなく me に届く" do
      login(me)
      get "/api/users/me"

      expect(response.parsed_body["id"]).to eq me.id
    end
  end

  describe "他のAPIへの漏れ" do
    # 今回増えた列は users にあるので、user.as_json のような書き方が
    # 残っていると参加者一覧に混ざる
    it "未ログインのイベント詳細に department が混ざらない" do
      event = create(:event, owner: me)
      create(:event_participation, event:, user: me)

      get "/api/events/#{event.id}"

      expect(response.body).not_to include("department")
      expect(response.body).not_to include("情報工学科")
    end

    # 2026-09-11 に方針を変えた。参加者・主催のカードに学科と呼ばれ方を
    # 出すため、ログイン済みには返す(Issue #214)。
    #
    # 見せる範囲は増えていない。ログインした人は GET /api/users/:id で
    # 同じ2つを見られる。未ログインには owner も participants もキーごと
    # 返さないので、上のテストがそのまま効く
    it "ログイン済みのイベント詳細には department と pronouns を返す" do
      me.update!(department: "情報工学科", pronouns: "he/him")
      event = create(:event, owner: me)
      create(:event_participation, event:, user: me)
      login(other)

      get "/api/events/#{event.id}"

      body = response.parsed_body
      expect(body["owner"]).to include("department" => "情報工学科", "pronouns" => "he/him")
      expect(body["participants"].first).to include("department" => "情報工学科")
    end

    # 名前の横に出すためのものだけを足す。role や suspended_at は
    # 管理画面の情報で、参加者の一覧に出すものではない
    it "イベント詳細に role や email は出さない" do
      event = create(:event, owner: me)
      create(:event_participation, event:, user: me)
      login(other)

      get "/api/events/#{event.id}"

      expect(response.parsed_body["owner"].keys)
        .to contain_exactly("id", "name", "department", "pronouns")
      expect(response.body).not_to include("suspended_at")
    end
  end
end
