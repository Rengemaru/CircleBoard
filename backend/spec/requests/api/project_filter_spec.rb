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

  describe "?tag_ids=" do
    it "1つのタグに絞れる" do
      tag = create(:tag, name: "Web開発")
      create(:project, title: "タグあり", tags: [ tag ])
      create(:project, title: "タグなし")

      get "/api/projects", params: { tag_ids: tag.id }

      expect(response.parsed_body["projects"].map { _1["title"] }).to eq([ "タグあり" ])
    end

    # 複数指定は OR。AND にするとタグを足すほど0件に近づく
    it "複数指定したときは、どれか1つでも持つプロジェクトを返す" do
      web = create(:tag, name: "Web開発")
      game = create(:tag, name: "ゲーム制作")
      create(:project, title: "Webのやつ", tags: [ web ])
      create(:project, title: "ゲームのやつ", tags: [ game ])
      create(:project, title: "どちらでもない")

      get "/api/projects", params: { tag_ids: "#{web.id},#{game.id}" }

      expect(response.parsed_body["projects"].map { _1["title"] })
        .to contain_exactly("Webのやつ", "ゲームのやつ")
    end

    # 2つのタグが付いたプロジェクトは join で2行になる。distinct が要る
    it "複数のタグを持つプロジェクトが重複しない" do
      web = create(:tag, name: "Web開発")
      game = create(:tag, name: "ゲーム制作")
      create(:project, title: "両方持ち", tags: [ web, game ])

      get "/api/projects", params: { tag_ids: "#{web.id},#{game.id}" }

      expect(response.parsed_body["projects"].map { _1["title"] }).to eq([ "両方持ち" ])
    end

    # Integer("010") は基数を省くと8進数として 8 になる
    it "先頭にゼロが付いていても10進数として読む" do
      tag = create(:tag, name: "Web開発")
      create(:project, title: "タグあり", tags: [ tag ])
      create(:project, title: "タグなし")

      get "/api/projects", params: { tag_ids: format("%03d", tag.id) }

      expect(response.parsed_body["projects"].map { _1["title"] }).to eq([ "タグあり" ])
    end

    it "bigint を超える値でもエラーにならない" do
      get "/api/projects", params: { tag_ids: "99999999999999999999" }

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["projects"]).to be_empty
    end

    it "空や数字でない値のときは絞り込まない" do
      create(:project, title: "タグなし")

      get "/api/projects", params: { tag_ids: "abc" }

      expect(response.parsed_body["projects"].map { _1["title"] }).to include("タグなし")
    end

    it "status と併用できる" do
      tag = create(:tag, name: "Web開発")
      create(:project, title: "募集中でタグあり", status: :recruiting, tags: [ tag ])
      create(:project, title: "進行中でタグあり", status: :in_progress, tags: [ tag ])

      get "/api/projects", params: { tag_ids: tag.id, status: "recruiting" }

      expect(response.parsed_body["projects"].map { _1["title"] }).to eq([ "募集中でタグあり" ])
    end
  end
end
