require "rails_helper"

# プロフィールの更新(docs/api-spec.md §4.5)。
# この spec の本体は認可と検証で、docs/spec-my-page.md §6 がそのまま項目になる。
#
# 見たいことは3つ。
#   1. 受け取ってはいけない項目(name / email / role / 年度)が通らないこと
#   2. 上限とURLのスキームがサーバー側で弾かれること(フロントは curl で回避できる)
#   3. 弾かれたときに、既存のリンクが消えたままにならないこと
RSpec.describe "Api::Users PATCH /api/users/me", type: :request do
  let(:me) { create(:user, name: "山田太郎", department: "情報工学科") }

  def login(user)
    post "/api/session", params: { email: user.email, password: "password123" }, as: :json
  end

  def patch_me(params)
    patch "/api/users/me", params: params, as: :json
  end

  describe "認可" do
    it "未ログインは 401" do
      patch_me(department: "経営学科")

      expect(response).to have_http_status(:unauthorized)
    end

    it "停止中は 401" do
      login(me)
      me.suspend!
      patch_me(department: "経営学科")

      expect(response).to have_http_status(:unauthorized)
      expect(me.reload.department).to eq "情報工学科"
    end

    # パスに id が無いので他人は指せない。念のため、混ぜても自分が更新されることを見る
    it "リクエストの id を見ない" do
      other = create(:user, department: "経営学科")
      login(me)
      patch_me(id: other.id, department: "文学部")

      expect(response.parsed_body["id"]).to eq me.id
      expect(other.reload.department).to eq "経営学科"
    end
  end

  describe "受け取らない項目" do
    # name は 2026-09-12 から受け取るようになった(spec/requests/api/name_change_spec.rb)。
    # email / role / 年度は引き続き受け取らない
    it "email / role / 年度を混ぜても変わらない" do
      before_attrs = me.slice(:email, :role, :enrollment_year, :graduation_year)
      login(me)
      patch_me(
        email: "hijack@example.com", role: "admin",
        enrollment_year: 1999, graduation_year: 2099, bio: "更新した"
      )

      expect(response).to have_http_status(:ok)
      expect(me.reload.slice(:email, :role, :enrollment_year, :graduation_year)).to eq before_attrs
      expect(me.bio).to eq "更新した"
    end
  end

  describe "更新できるもの" do
    it "呼ばれ方を更新する" do
      login(me)
      patch_me(pronouns: "さん付けで")

      expect(response).to have_http_status(:ok)
      expect(me.reload.pronouns).to eq "さん付けで"
      expect(response.parsed_body["pronouns"]).to eq "さん付けで"
    end

    it "学科と自己紹介を更新する" do
      login(me)
      patch_me(department: "経営学科", bio: "こんにちは")

      expect(response).to have_http_status(:ok)
      expect(me.reload.department).to eq "経営学科"
      expect(me.bio).to eq "こんにちは"
    end

    it "スキルを差し替える" do
      old = create(:tag, name: "旧", category: :profile)
      new = create(:tag, name: "新", category: :profile)
      me.tags = [ old ]
      login(me)
      patch_me(tag_names: [ "新" ])

      expect(response).to have_http_status(:ok)
      expect(me.reload.tags).to contain_exactly(new)
    end

    # 自由記述。無い名前はその場で作る(docs/spec-tags.md §3.5)
    it "存在しない名前はその場で作られる" do
      login(me)

      expect { patch_me(tag_names: [ "Photogrammetry" ]) }.to change(Tag, :count).by(1)

      expect(response).to have_http_status(:ok)
      expect(me.reload.tags.map(&:name)).to eq([ "Photogrammetry" ])
    end

    # 企画と語彙を分ける(§3.4)。ここが project_event になると、
    # 3Dの人のプロフィールに企画用の語彙が混ざる
    it "作られるタグは profile になる" do
      login(me)
      patch_me(tag_names: [ "Blender" ])

      expect(Tag.find_by(name: "Blender")).to be_profile
    end

    it "tag_names を送らなければスキルに触らない" do
      tag = create(:tag)
      me.tags = [ tag ]
      login(me)
      patch_me(department: "経営学科")

      expect(me.reload.tags).to contain_exactly(tag)
    end

    it "リンクを送った順に position へ入れる" do
      login(me)
      patch_me(links: [
        { label: "GitHub", url: "https://github.com/x" },
        { label: "Zenn", url: "https://zenn.dev/x" }
      ])

      expect(response).to have_http_status(:ok)
      expect(me.reload.user_links.map { [ _1.label, _1.position ] }).to eq [ [ "GitHub", 0 ], [ "Zenn", 1 ] ]
      expect(response.parsed_body["links"].map { _1["label"] }).to eq [ "GitHub", "Zenn" ]
    end

    it "空配列を送るとリンクが全部消える" do
      create(:user_link, user: me)
      login(me)
      patch_me(links: [])

      expect(response).to have_http_status(:ok)
      expect(me.reload.user_links).to be_empty
    end

    it "links を送らなければリンクに触らない" do
      create(:user_link, user: me, label: "残る")
      login(me)
      patch_me(bio: "更新")

      expect(me.reload.user_links.map(&:label)).to eq [ "残る" ]
    end
  end

  describe "検証" do
    before { login(me) }

    it "学科が51字なら 422" do
      patch_me(department: "あ" * 51)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(me.reload.department).to eq "情報工学科"
    end

    # フォームは常に文字列を送るので、一度書いて消すと "" が残る。
    # 一度も書いていない人(nil)と区別が付かないと、画面の「—」が出ずに
    # 項目名だけの空行になる
    it "空文字で保存すると未入力(nil)に戻る" do
      me.update!(department: "情報工学科", pronouns: "he/him", bio: "はじめまして")

      patch_me(department: "", pronouns: "", bio: "")

      expect(response).to have_http_status(:ok)
      expect(me.reload.attributes.values_at("department", "pronouns", "bio")).to all(be_nil)
    end

    it "空白だけでも未入力(nil)に戻る" do
      me.update!(department: "情報工学科")

      patch_me(department: "   ")

      expect(me.reload.department).to be_nil
    end

    it "呼ばれ方が21字なら 422" do
      patch_me(pronouns: "あ" * 21)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(me.reload.pronouns).to be_nil
    end

    it "自己紹介が501字なら 422" do
      patch_me(bio: "あ" * 501)

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "スキルが6件なら 422" do
      patch_me(tag_names: %w[a b c d e f])

      expect(response).to have_http_status(:unprocessable_entity)
      expect(me.reload.tags).to be_empty
    end

    it "21文字なら 422" do
      patch_me(tag_names: [ "あ" * 21 ])

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "リンクが4件なら 422" do
      patch_me(links: Array.new(4) { |i| { label: "L#{i}", url: "https://example.com/#{i}" } })

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "リンクのラベルが21字なら 422" do
      patch_me(links: [ { label: "あ" * 21, url: "https://example.com" } ])

      expect(response).to have_http_status(:unprocessable_entity)
    end

    # javascript: を <a href> に置くと、他の部員がクリックしたときに動く
    it "javascript: の URL は 422" do
      patch_me(links: [ { label: "罠", url: "javascript:alert(1)" } ])

      expect(response).to have_http_status(:unprocessable_entity)
      expect(me.reload.user_links).to be_empty
    end

    it "配列でない links は 422" do
      patch_me(links: "https://example.com")

      expect(response).to have_http_status(:unprocessable_entity)
    end

    # permit は通らない値を黙って落とすので、配列だけ見ていると
    # links が [] になり、200 を返しながら既存のリンクを全部消す
    it "要素が組でない links は 422 で、既存のリンクが消えない" do
      create(:user_link, user: me, label: "既存", url: "https://example.com/old")
      patch_me(links: [ "xss" ])

      expect(response).to have_http_status(:unprocessable_entity)
      expect(me.reload.user_links.map(&:label)).to eq [ "既存" ]
    end

    it "要素が配列の links は 422 で、既存のリンクが消えない" do
      create(:user_link, user: me, label: "既存", url: "https://example.com/old")
      patch_me(links: [ [ "GitHub", "https://example.com" ] ])

      expect(response).to have_http_status(:unprocessable_entity)
      expect(me.reload.user_links.map(&:label)).to eq [ "既存" ]
    end
  end

  # 3つの書き込みを1つのトランザクションに入れている理由がこれ。
  # 失敗したときに「古いリンクは消えたが新しいリンクは入っていない」状態を残さない
  describe "トランザクション" do
    before { login(me) }

    it "リンクが弾かれたとき、既存のリンクが消えていない" do
      create(:user_link, user: me, label: "既存", url: "https://example.com/old")
      patch_me(links: [ { label: "OK", url: "https://example.com/new" }, { label: "NG", url: "javascript:alert(1)" } ])

      expect(response).to have_http_status(:unprocessable_entity)
      expect(me.reload.user_links.map(&:label)).to eq [ "既存" ]
    end

    it "自己紹介が弾かれたとき、リンクが消えていない" do
      create(:user_link, user: me, label: "既存", url: "https://example.com/old")
      patch_me(bio: "あ" * 501, links: [])

      expect(response).to have_http_status(:unprocessable_entity)
      expect(me.reload.user_links.map(&:label)).to eq [ "既存" ]
    end

    it "自己紹介が弾かれたとき、スキルが変わっていない" do
      tag = create(:tag, category: :profile)
      me.tags = [ tag ]
      patch_me(bio: "あ" * 501, tag_names: [])

      expect(response).to have_http_status(:unprocessable_entity)
      expect(me.reload.tags).to contain_exactly(tag)
    end
  end
end
