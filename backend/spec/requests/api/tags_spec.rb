require "rails_helper"

RSpec.describe "GET /api/tags", type: :request do
  # イベント一覧の絞り込みに使うため、未ログインでも取得できる必要がある
  it "未ログインでも取得できる" do
    create(:tag, name: "Web開発")

    get "/api/tags"

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["tags"].first.keys).to contain_exactly("id", "name")
  end

  # category: skill(1) は未使用(仕様書 §2.4)
  it "category が project_event のタグだけを返す" do
    visible = create(:tag, name: "Web開発", category: :project_event)
    hidden = create(:tag, name: "Rails", category: :skill)

    get "/api/tags"

    ids = response.parsed_body["tags"].map { _1["id"] }
    expect(ids).to include(visible.id)
    expect(ids).not_to include(hidden.id)
  end

  # タグの作成APIは作らない(seeds.rb と rails console で管理)
  it "作成APIは存在しない" do
    post "/api/tags", params: { tag: { name: "勝手なタグ" } }, as: :json

    expect(response).to have_http_status(:not_found)
  end
end
