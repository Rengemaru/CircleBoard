require "rails_helper"

RSpec.describe "GET /api/tags", type: :request do
  # イベント一覧の絞り込みに使うため、未ログインでも取得できる必要がある
  it "未ログインでも取得できる" do
    create(:tag, name: "Web開発")

    get "/api/tags"

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["tags"].first.keys).to contain_exactly("id", "name")
  end

  # プロフィール用の語彙は企画側に出さない(docs/spec-tags.md §3.4)
  it "category が project_event のタグだけを返す" do
    visible = create(:tag, name: "Web開発", category: :project_event)
    hidden = create(:tag, name: "Rails", category: :profile)

    get "/api/tags"

    ids = response.parsed_body["tags"].map { _1["id"] }
    expect(ids).to include(visible.id)
    expect(ids).not_to include(hidden.id)
  end

  # 企画用とプロフィール用で語彙を分ける(docs/spec-tags.md §3.4)
  it "category=profile を指定するとプロフィール用だけを返す" do
    hidden = create(:tag, name: "Web開発", category: :project_event)
    visible = create(:tag, name: "3D", category: :profile)

    get "/api/tags", params: { category: "profile" }

    ids = response.parsed_body["tags"].map { _1["id"] }
    expect(ids).to include(visible.id)
    expect(ids).not_to include(hidden.id)
  end

  # 未ログインでも開く画面が使う。URLを手で書き換えられただけで500にしない
  it "知らない category は企画用に倒す" do
    visible = create(:tag, name: "Web開発", category: :project_event)

    get "/api/tags", params: { category: "でたらめ" }

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["tags"].map { _1["id"] }).to eq([ visible.id ])
  end

  # タグ単体を作るAPIは作らない。企画かプロフィールに付ける過程で生まれる
  # (docs/spec-tags.md §3.5)
  it "作成APIは存在しない" do
    post "/api/tags", params: { tag: { name: "勝手なタグ" } }, as: :json

    expect(response).to have_http_status(:not_found)
  end
end
