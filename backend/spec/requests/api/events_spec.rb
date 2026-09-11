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
    expect(events.first).not_to have_key("current_user_joined")
  end

  # 「常に owner を返さない実装」でも上のテストは通ってしまうため、
  # 逆方向も確かめる。同じ EventSerializer の分岐が両方向で効いていることの確認
  it "ログイン時は owner を返す" do
    user = create(:user)
    event = create(:event, owner: user)
    sign_in(user)

    get "/api/events"

    owner = response.parsed_body["events"].first["owner"]
    # 学科と呼ばれ方も返す。参加者・主催のカードに出すため(Issue #214)
    expect(owner).to eq(
      "id" => event.owner.id, "name" => event.owner.name,
      "department" => nil, "pronouns" => nil
    )
  end

  # マイページの「参加中の企画」が使う(Issue #165)。
  # 詳細を1件ずつ引くと参加数だけリクエストが増えるので、一覧でも返す
  describe "current_user_joined" do
    it "参加していなければ false" do
      user = create(:user)
      create(:event)
      sign_in(user)

      get "/api/events"

      expect(response.parsed_body["events"].first["current_user_joined"]).to be(false)
    end

    it "参加していれば true" do
      user = create(:user)
      event = create(:event)
      create(:event_participation, event: event, user: user)
      sign_in(user)

      get "/api/events"

      expect(response.parsed_body["events"].first["current_user_joined"]).to be(true)
    end

    # キャンセルは参加を取り消す操作なので、行が残っていても false に戻る
    it "キャンセル済みなら false" do
      user = create(:user)
      event = create(:event)
      create(:event_participation, event: event, user: user, cancelled_at: Time.current)
      sign_in(user)

      get "/api/events"

      expect(response.parsed_body["events"].first["current_user_joined"]).to be(false)
    end

    # 一覧で1件ずつ参加を数えに行かせない(CLAUDE.md §3-3)。
    # 本数そのものを固定すると、無関係な変更で落ちて意味が薄れるので、
    # 「件数を増やしても本数が変わらないこと」を見る
    it "イベントが増えてもクエリの本数が変わらない" do
      user = create(:user)
      create(:event)
      sign_in(user)
      one = count_queries { get "/api/events" }

      create_list(:event, 4)
      many = count_queries { get "/api/events" }

      expect(response.parsed_body["events"].size).to eq(5)
      expect(many).to eq(one)
    end
  end
end
