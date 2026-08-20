require "rails_helper"

# プロジェクト一覧の絞り込みと並び順(wireframes/wireframe-member.html 画面④)。
#
# 「進行中も一覧に表示する。途中参加できる設計のため。
#   並び順は 募集中 → 進行中。終了は非表示。」
RSpec.describe "GET /api/projects の絞り込み", type: :request do
  let(:user) { create(:user) }

  before { sign_in(user) }

  describe "既定の表示" do
    it "終了したプロジェクトは返さない" do
      create(:project, title: "募集中のもの", status: :recruiting)
      create(:project, title: "終わったもの", status: :completed)

      get "/api/projects"

      titles = response.parsed_body["projects"].map { _1["title"] }
      expect(titles).to eq([ "募集中のもの" ])
    end

    # 途中参加できる設計なので、進行中も出す
    it "進行中は返す" do
      create(:project, title: "進行中のもの", status: :in_progress)

      get "/api/projects"

      expect(response.parsed_body["projects"].map { _1["title"] }).to eq([ "進行中のもの" ])
    end

    it "論理削除したものは返さない" do
      create(:project, title: "消したもの", visibility: :trashed)

      get "/api/projects"

      expect(response.parsed_body["projects"]).to be_empty
    end

    # enum の整数(0:recruiting 1:in_progress)がそのままこの順序になる
    it "募集中 → 進行中 の順に返す" do
      create(:project, title: "進行中", status: :in_progress)
      create(:project, title: "募集中", status: :recruiting)

      get "/api/projects"

      expect(response.parsed_body["projects"].map { _1["title"] }).to eq([ "募集中", "進行中" ])
    end
  end

  describe "?status=" do
    it "募集中だけに絞れる" do
      create(:project, title: "募集中", status: :recruiting)
      create(:project, title: "進行中", status: :in_progress)

      get "/api/projects", params: { status: "recruiting" }

      expect(response.parsed_body["projects"].map { _1["title"] }).to eq([ "募集中" ])
    end

    it "進行中だけに絞れる" do
      create(:project, title: "募集中", status: :recruiting)
      create(:project, title: "進行中", status: :in_progress)

      get "/api/projects", params: { status: "in_progress" }

      expect(response.parsed_body["projects"].map { _1["title"] }).to eq([ "進行中" ])
    end

    # URLを手で編集されただけで画面が壊れないようにする
    it "未知の値を渡されたら既定に戻す" do
      create(:project, title: "募集中", status: :recruiting)
      create(:project, title: "終わったもの", status: :completed)

      get "/api/projects", params: { status: "unknown" }

      expect(response.parsed_body["projects"].map { _1["title"] }).to eq([ "募集中" ])
    end
  end

  describe "?tag_id=" do
    it "1つのタグに絞れる" do
      tag = create(:tag, name: "Web開発")
      create(:project, title: "タグあり", tags: [ tag ])
      create(:project, title: "タグなし")

      get "/api/projects", params: { tag_id: tag.id }

      expect(response.parsed_body["projects"].map { _1["title"] }).to eq([ "タグあり" ])
    end

    it "status と併用できる" do
      tag = create(:tag, name: "Web開発")
      create(:project, title: "募集中でタグあり", status: :recruiting, tags: [ tag ])
      create(:project, title: "進行中でタグあり", status: :in_progress, tags: [ tag ])

      get "/api/projects", params: { tag_id: tag.id, status: "recruiting" }

      expect(response.parsed_body["projects"].map { _1["title"] }).to eq([ "募集中でタグあり" ])
    end
  end
end
