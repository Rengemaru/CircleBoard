require "rails_helper"

# ピン留め設定画面で使う管理者専用の一覧。
#
# **なぜ公開APIを使い回さないか**
# wireframes/wireframe-admin.html A2 が「score はこの画面にだけ表示する。
# 一般ユーザーには見せない（数値が見えると、順位を上げるための操作を
# 誘発するため）」と明記している。spotlight_score を GET /api/events に
# 足すと、その要求を破ることになる。
RSpec.describe "GET /api/admin/events", type: :request do
  let(:admin) { create(:user, role: :admin) }
  let(:member) { create(:user) }

  it "未ログインでは 401 を返す" do
    get "/api/admin/events"

    expect(response).to have_http_status(:unauthorized)
  end

  it "一般メンバーでは 403 を返す" do
    sign_in(member)

    get "/api/admin/events"

    expect(response).to have_http_status(:forbidden)
  end

  it "管理者はピン留め設定に必要な情報を取得できる" do
    create(:event, spotlight_score: 210, pinned: true)
    sign_in(admin)

    get "/api/admin/events"

    expect(response).to have_http_status(:ok)
    first = response.parsed_body["events"].first
    expect(first["spotlight_score"]).to eq(210)
    expect(first["pinned"]).to be(true)
  end

  it "必要なキーだけを返す" do
    create(:event)
    sign_in(admin)

    get "/api/admin/events"

    expect(response.parsed_body["events"].first.keys).to contain_exactly(
      "id", "title", "starts_at", "location", "participants_count", "spotlight_score", "pinned"
    )
  end

  # ワイヤーフレーム A2「対象イベント（開催前のみ表示）」
  it "開催日が過去のイベントは含めない" do
    past = create(:event, starts_at: 2.days.ago)
    upcoming = create(:event, starts_at: 3.days.from_now)
    sign_in(admin)

    get "/api/admin/events"

    ids = response.parsed_body["events"].map { _1["id"] }
    expect(ids).to include(upcoming.id)
    expect(ids).not_to include(past.id)
  end

  it "論理削除済みは含めない" do
    trashed = create(:event, starts_at: 3.days.from_now)
    trashed.trashed!
    sign_in(admin)

    get "/api/admin/events"

    expect(response.parsed_body["events"].map { _1["id"] }).not_to include(trashed.id)
  end

  it "ピン留めを先頭に、残りは spotlight_score 降順で返す" do
    low = create(:event, starts_at: 5.days.from_now, spotlight_score: 10)
    high = create(:event, starts_at: 6.days.from_now, spotlight_score: 200)
    pinned = create(:event, starts_at: 7.days.from_now, spotlight_score: 1, pinned: true)
    sign_in(admin)

    get "/api/admin/events"

    ids = response.parsed_body["events"].map { _1["id"] }
    expect(ids).to eq([ pinned.id, high.id, low.id ])
  end

  # 一般ユーザーには score を見せない、という要求が守られていることの確認
  it "公開APIは spotlight_score を返さない" do
    create(:event, spotlight_score: 210)

    get "/api/events"

    expect(response.parsed_body["events"].first.keys).not_to include("spotlight_score")
  end
end
