require "rails_helper"

# 企画名の部分一致検索(?q=)。イベントとプロジェクトで同じ書式を受ける
# (app/controllers/concerns/title_searchable.rb)。
#
# 両方を1つの spec に置いているのは、同じ concern を共有しているため。
# 片方だけ通る状態に気づけるようにしておく。
RSpec.describe "企画名の部分一致検索", type: :request do
  describe "GET /api/events" do
    def titles
      response.parsed_body["events"].map { _1["title"] }
    end

    it "途中に含まれていても引ける" do
      create(:event, title: "春のハッカソン")
      create(:event, title: "LT会")

      get "/api/events", params: { q: "ハッカソン" }

      expect(titles).to eq([ "春のハッカソン" ])
    end

    # 英字の企画名を打つとき、大文字小文字まで合わせさせない
    it "英字の大文字小文字を区別しない" do
      create(:event, title: "Rails 勉強会")

      get "/api/events", params: { q: "rails" }

      expect(titles).to eq([ "Rails 勉強会" ])
    end

    it "一致しなければ0件" do
      create(:event, title: "春のハッカソン")

      get "/api/events", params: { q: "存在しない企画" }

      expect(titles).to be_empty
    end

    # % と _ は LIKE のワイルドカード。素通しすると「50%」の検索が
    # 「50」で始まる企画を全部拾う
    it "% をワイルドカードとして扱わない" do
      create(:event, title: "50%OFF企画")
      create(:event, title: "50円企画")

      get "/api/events", params: { q: "50%" }

      expect(titles).to eq([ "50%OFF企画" ])
    end

    it "_ をワイルドカードとして扱わない" do
      create(:event, title: "LT_会")
      create(:event, title: "LTX会")

      get "/api/events", params: { q: "LT_" }

      expect(titles).to eq([ "LT_会" ])
    end

    # URLを手で書き換えられてもエラーにせず全件を返す(tag_ids と同じ)
    it "空文字は絞り込まない" do
      create(:event, title: "春のハッカソン")

      get "/api/events", params: { q: "" }

      expect(titles).to eq([ "春のハッカソン" ])
    end

    it "空白だけは絞り込まない" do
      create(:event, title: "春のハッカソン")

      get "/api/events", params: { q: "   " }

      expect(titles).to eq([ "春のハッカソン" ])
    end

    # 企画名は100字までなので、超える語はどのみち0件になる。
    # 長い文字列で LIKE を走らせない
    it "長すぎる語は絞り込まない" do
      create(:event, title: "春のハッカソン")

      get "/api/events", params: { q: "あ" * (TitleSearchable::MAX_QUERY_LENGTH + 1) }

      expect(titles).to eq([ "春のハッカソン" ])
    end

    it "前後の空白は無視する" do
      create(:event, title: "春のハッカソン")

      get "/api/events", params: { q: "  ハッカソン  " }

      expect(titles).to eq([ "春のハッカソン" ])
    end

    # 既定の絞り込み(募集中のみ)は効いたまま。検索が status を素通しさせない
    it "終了したイベントは既定では出さない" do
      create(:event, title: "終わったハッカソン", status: :completed)

      get "/api/events", params: { q: "ハッカソン" }

      expect(titles).to be_empty
    end

    # タグと語の両方を指定したら AND。片方だけ効く状態にしない
    it "タグの絞り込みと重ねられる" do
      tag = create(:tag, name: "Web開発")
      create(:event, title: "春のハッカソン", tags: [ tag ])
      create(:event, title: "秋のハッカソン")

      get "/api/events", params: { q: "ハッカソン", tag_ids: tag.id.to_s }

      expect(titles).to eq([ "春のハッカソン" ])
    end
  end

  describe "GET /api/projects" do
    let(:user) { create(:user) }

    before { sign_in(user) }

    def titles
      response.parsed_body["projects"].map { _1["title"] }
    end

    it "途中に含まれていても引ける" do
      create(:project, title: "部室サイネージ開発")
      create(:project, title: "会計システム")

      get "/api/projects", params: { q: "サイネージ" }

      expect(titles).to eq([ "部室サイネージ開発" ])
    end

    it "% をワイルドカードとして扱わない" do
      create(:project, title: "達成率100%を目指す会")
      create(:project, title: "達成率の計測")

      get "/api/projects", params: { q: "達成率1" }

      expect(titles).to eq([ "達成率100%を目指す会" ])
    end

    it "空文字は絞り込まない" do
      create(:project, title: "部室サイネージ開発")

      get "/api/projects", params: { q: "" }

      expect(titles).to eq([ "部室サイネージ開発" ])
    end

    # 既定の絞り込み(終了以外)は効いたまま
    it "終了したプロジェクトは既定では出さない" do
      create(:project, title: "終わったサイネージ開発", status: :completed)

      get "/api/projects", params: { q: "サイネージ" }

      expect(titles).to be_empty
    end

    # 未ログインは一覧そのものが 401(docs/api-spec.md §3)。
    # 検索を足しても、ログインなしで企画名を探れるようにはしない
    it "未ログインでは 401" do
      delete "/api/session"
      create(:project, title: "部室サイネージ開発")

      get "/api/projects", params: { q: "サイネージ" }

      expect(response).to have_http_status(:unauthorized)
    end
  end
end
