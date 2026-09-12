require "rails_helper"

# マイページのプロフィール(docs/spec-my-page.md §2、§6.1)。
# 検証の抜けがそのまま「他の部員がクリックしたら何か起きる」に繋がるので、
# 上限とURLのスキームを厚めに見る(CLAUDE.md §6)。
RSpec.describe "User のプロフィール", type: :model do
  let(:user) { create(:user) }

  describe "文字数の上限" do
    it "学科は50字まで" do
      user.department = "あ" * 50
      expect(user).to be_valid

      user.department = "あ" * 51
      expect(user).not_to be_valid
    end

    # 字数を直に書かない。上限を変えたときに spec が嘘をつくため(Issue #303)
    it "自己紹介は上限まで書ける" do
      user.bio = "あ" * User::MAX_BIO_LENGTH
      expect(user).to be_valid

      user.bio = "あ" * (User::MAX_BIO_LENGTH + 1)
      expect(user).not_to be_valid
    end

    it "どちらも空のまま保存できる" do
      expect(create(:user, department: nil, bio: nil)).to be_persisted
    end

    it "自己紹介は改行を保持する" do
      user.update!(bio: "1行目\n2行目")

      expect(user.reload.bio).to include("\n")
    end
  end

  describe "スキルの件数" do
    it "5件までは持てる" do
      user.tags = create_list(:tag, 5)

      expect(user.reload.tags.count).to eq 5
    end

    # user.tags = [...] は中間テーブルへ直接 INSERT するため、
    # User 側のバリデーションだけでは止まらない。UserTag 側で見ている
    it "6件目は弾かれ、件数が増えない" do
      user.tags = create_list(:tag, 5)

      expect { user.tags = create_list(:tag, 6) }.to raise_error(ActiveRecord::RecordInvalid)
      expect(user.reload.tags.count).to eq 5
    end

    it "同じタグは2回付かない" do
      tag = create(:tag)
      create(:user_tag, user:, tag:)

      expect { create(:user_tag, user:, tag:) }.to raise_error(ActiveRecord::RecordNotUnique)
    end
  end

  describe "リンクの件数" do
    it "3件までは持てる" do
      create_list(:user_link, 3, user:)

      expect(user.reload.user_links.count).to eq 3
    end

    it "4件目は弾かれる" do
      create_list(:user_link, 3, user:)

      expect(build(:user_link, user:)).not_to be_valid
    end

    # メモリ上で組み立ててから save する経路。どの行から見ても
    # 「DB上の既存は0件」に見えるので、User 側で見ている
    it "まとめて4件作ろうとすると弾かれる" do
      4.times { |i| user.user_links.build(label: "L#{i}", url: "https://example.com/#{i}") }

      expect(user).not_to be_valid
    end
  end

  describe "リンクのURL" do
    it "http と https は通る" do
      expect(build(:user_link, url: "http://example.com")).to be_valid
      expect(build(:user_link, url: "https://example.com")).to be_valid
    end

    # 利用者が入れた文字列をそのまま <a href> に置くので、
    # javascript: を通すと他の部員がクリックしたときにスクリプトが動く
    it "javascript: は弾く" do
      expect(build(:user_link, url: "javascript:alert(1)")).not_to be_valid
    end

    it "スキームが無いもの・別のスキームは弾く" do
      [ "example.com", "ftp://example.com", "data:text/html,x", "" ].each do |url|
        expect(build(:user_link, url:)).not_to be_valid, "#{url} が通ってしまった"
      end
    end

    it "ラベルは必須で20字まで" do
      expect(build(:user_link, label: "")).not_to be_valid
      expect(build(:user_link, label: "あ" * 20)).to be_valid
      expect(build(:user_link, label: "あ" * 21)).not_to be_valid
    end
  end

  describe "利用者を消したとき" do
    # 参加記録は SET NULL で残すが、プロフィールは本人に属する情報なので消す
    it "スキルとリンクも消える" do
      user.tags = create_list(:tag, 2)
      create_list(:user_link, 2, user:)

      expect { user.destroy }.to change(UserTag, :count).by(-2).and change(UserLink, :count).by(-2)
    end
  end

  describe "タグを消したとき" do
    it "利用者は消えず、その人のスキルだけが消える" do
      tag = create(:tag)
      create(:user_tag, user:, tag:)

      expect { tag.destroy }.to change(UserTag, :count).by(-1)
      expect(User.exists?(user.id)).to be true
    end
  end

  describe "並び順" do
    it "リンクは position の昇順で返る" do
      create(:user_link, user:, label: "3番目", position: 2)
      create(:user_link, user:, label: "1番目", position: 0)
      create(:user_link, user:, label: "2番目", position: 1)

      expect(user.reload.user_links.map(&:label)).to eq [ "1番目", "2番目", "3番目" ]
    end
  end
end
