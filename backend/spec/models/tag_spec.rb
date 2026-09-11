require "rails_helper"

# タグの自由記述化(docs/spec-tags.md §3.1 / §3.2 / §3.4)。
#
# 利用者が打った文字列をそのまま受けるので、入り口で形を揃えられているかを
# 境界まで確かめる。ここが緩いと「Rails」と「Ｒａｉｌｓ」が別のタグとして
# 並び、あとから人手で統合することになる。
RSpec.describe Tag do
  describe ".normalize_name" do
    # 吸収するのは「全角と半角」と「空白」だけ(§3.1)
    {
      "前後の半角空白" => [ "  Rails  ", "Rails" ],
      "前後の全角空白" => [ "　Rails　", "Rails" ],
      "全角英数" => [ "Ｒａｉｌｓ", "Rails" ],
      "全角空白まじりの全角英数" => [ "　Ｒａｉｌｓ　", "Rails" ],
      "連続する空白" => [ "Web  開発", "Web 開発" ],
      "全角空白を挟んだ語" => [ "Web　開発", "Web 開発" ],
      "半角カナ" => [ "ﾊﾞｯｸｴﾝﾄﾞ", "バックエンド" ],
      "全角記号" => [ "Ｃ＋＋", "C++" ],
      "タブと改行" => [ "Web\t開発\n", "Web 開発" ]
    }.each do |label, (input, expected)|
      it "#{label}: #{input.inspect} を #{expected.inspect} にする" do
        expect(described_class.normalize_name(input)).to eq(expected)
      end
    end

    # 大文字小文字を変えないのは、iOS や LT のように大文字であることに
    # 意味のある名前が壊れるため(§3.1)
    it "大文字小文字は変えない" do
      expect(described_class.normalize_name("rails")).to eq("rails")
      expect(described_class.normalize_name("iOS")).to eq("iOS")
    end

    it "空白だけなら空文字になる" do
      expect(described_class.normalize_name("　 　")).to eq("")
    end

    it "nil でも落ちない" do
      expect(described_class.normalize_name(nil)).to eq("")
    end
  end

  describe "保存時の正規化" do
    it "正規化した名前で保存される" do
      tag = described_class.create!(name: "　Ｒａｉｌｓ　", category: :project_event)

      expect(tag.name).to eq("Rails")
    end

    it "正規化の結果が空文字になるものは保存できない" do
      tag = described_class.new(name: "　 　", category: :project_event)

      expect(tag).not_to be_valid
    end
  end

  describe "名前の長さ" do
    it "20文字は保存できる" do
      expect(described_class.new(name: "あ" * 20, category: :project_event)).to be_valid
    end

    it "21文字は保存できない" do
      expect(described_class.new(name: "あ" * 21, category: :project_event)).not_to be_valid
    end

    # 全角に寄せたあとの長さで数える。全角英数は1文字に潰れるので、
    # 正規化前の見た目で弾くと「Ｒ」20文字が通らなくなる
    it "正規化後の長さで数える" do
      tag = described_class.new(name: "Ａ" * 20, category: :project_event)

      expect(tag).to be_valid
    end
  end

  describe "名前の一意性" do
    before { described_class.create!(name: "Rails", category: :project_event) }

    it "同じ名前・同じ用途は2つ作れない" do
      expect(described_class.new(name: "Rails", category: :project_event)).not_to be_valid
    end

    # 正規化が先に効くので、見た目の違う文字列でも重複として弾かれる
    it "正規化すると同じになる名前も弾く" do
      expect(described_class.new(name: "　Ｒａｉｌｓ", category: :project_event)).not_to be_valid
    end

    # 大文字小文字は区別する。統合は管理画面で行う(§3.8)
    it "大文字小文字が違えば別のタグとして作れる" do
      expect(described_class.new(name: "rails", category: :project_event)).to be_valid
    end

    # 企画とプロフィールで語彙を分ける(§3.4)。
    # ここが通らないと「3D」を企画用とプロフィール用の両方に持てない
    it "用途が違えば同じ名前を作れる" do
      expect(described_class.new(name: "Rails", category: :profile)).to be_valid
    end

    it "用途が違う同名タグは両方DBに残る" do
      described_class.create!(name: "Rails", category: :profile)

      expect(described_class.where(name: "Rails").count).to eq(2)
    end
  end

  describe "category" do
    it "project_event と profile を持つ" do
      expect(described_class.categories.keys).to contain_exactly("project_event", "profile")
    end
  end
end
