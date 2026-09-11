require "rails_helper"

# 文字数の上限(2026-09-12 の監査で追加。オーナー承認済み)。
#
# PostgreSQL の varchar は桁数を書かなければ無制限なので、上限は書いたところに
# しか生まれない。実際に 10MB のタイトルが保存でき、未ログインで叩ける一覧APIが
# 11.5MB を返していた。
#
# 上限ちょうどと +1 の両側を必ず見る。片側だけだと「常に通す実装」でも通ってしまう。
RSpec.describe "文字数の上限" do
  # 上限ちょうどが通り、1文字超えると止まることを1つの表で確かめる。
  # 属性が12個あり、1つずつ書くと同じ形の it が24個並ぶ
  shared_examples "上限で止まる" do |attribute, limit|
    it "#{attribute} は #{limit} 字まで通る" do
      expect(build_with(attribute, limit)).to be_valid
    end

    it "#{attribute} は #{limit + 1} 字で止まる" do
      record = build_with(attribute, limit + 1)

      expect(record).not_to be_valid
      expect(record.errors[attribute]).to be_present
    end
  end

  describe Event do
    def build_with(attribute, length)
      # 外部リンクは形式の検証(https?://)も通るように組み立てる。
      # 長さ以外の理由で落ちると、何を確かめたのか分からなくなる
      value = attribute == :external_url ? url_of(length) : "あ" * length
      build(:event, attribute => value)
    end

    include_examples "上限で止まる", :title, Event::MAX_TITLE_LENGTH
    include_examples "上限で止まる", :description, Event::MAX_DESCRIPTION_LENGTH
    include_examples "上限で止まる", :location, Event::MAX_LOCATION_LENGTH

    # 任意項目。未入力のまま通ることも見ておく(maximum だけの検証は nil を通す)
    include_examples "上限で止まる", :external_url, Event::MAX_EXTERNAL_URL_LENGTH

    it "external_url は未入力でも通る" do
      expect(build(:event, external_url: nil)).to be_valid
    end
  end

  describe Project do
    def build_with(attribute, length)
      build(:project, attribute => "あ" * length)
    end

    include_examples "上限で止まる", :title, Project::MAX_TITLE_LENGTH
    include_examples "上限で止まる", :description, Project::MAX_DESCRIPTION_LENGTH
    include_examples "上限で止まる", :activity_schedule, Project::MAX_SCHEDULE_LENGTH
    include_examples "上限で止まる", :meeting_schedule, Project::MAX_SCHEDULE_LENGTH

    it "活動予定と集まる日は未入力でも通る" do
      expect(build(:project, activity_schedule: nil, meeting_schedule: nil)).to be_valid
    end
  end

  describe User do
    def build_with(attribute, length)
      # メールは長さだけを見たいので、形の整った値を組み立てる
      domain = "@example.ac.jp"
      value = attribute == :email ? ("a" * (length - domain.length)) + domain : "あ" * length
      build(:user, attribute => value)
    end

    include_examples "上限で止まる", :name, User::MAX_NAME_LENGTH
    include_examples "上限で止まる", :email, User::MAX_EMAIL_LENGTH
  end

  describe UserLink do
    def build_with(attribute, length)
      build(:user_link, attribute => url_of(length))
    end

    include_examples "上限で止まる", :url, UserLink::MAX_URL_LENGTH
  end

  describe SignageToken do
    def build_with(attribute, length)
      build(:signage_token, attribute => "あ" * length)
    end

    include_examples "上限で止まる", :name, SignageToken::MAX_NAME_LENGTH
  end

  # ちょうど length 文字の URL。スキームの分を引いて埋める
  def url_of(length)
    prefix = "https://e.jp/"
    prefix + ("a" * (length - prefix.length))
  end

  # 監査で実際に通ってしまった値。同じことが起きたら気づけるようにしておく
  describe "監査で通ってしまった値" do
    it "10MB 相当のタイトルは止まる" do
      expect(build(:event, title: "あ" * 350_000)).not_to be_valid
    end

    it "1000字の氏名は止まる" do
      expect(build(:user, name: "あ" * 1000)).not_to be_valid
    end
  end
end
