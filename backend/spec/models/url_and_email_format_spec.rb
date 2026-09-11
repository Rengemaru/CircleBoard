require "rails_helper"

# URL とメールの形式(2026-09-12 の監査で追加)。
#
# どちらも「保存できてしまう」ことが問題だった。URL は javascript: が、
# メールは "not-an-email" が通っていた。
RSpec.describe "URL とメールの形式" do
  describe "Event#external_url" do
    # 監査で実際に保存できた値。詳細画面はこれをそのまま <a href> に渡していた。
    # 発火しなかったのは React 19 が描画時に差し替えていたためで、
    # 止めていたのはフレームワークであってこちらのコードではなかった
    it "javascript: は止まる" do
      event = build(:event, external_url: "javascript:alert(1)")

      expect(event).not_to be_valid
      expect(event.errors[:external_url]).to be_present
    end

    it "data: も止まる" do
      expect(build(:event, external_url: "data:text/html,<script></script>")).not_to be_valid
    end

    # スキームだけを見ているので、ホスト名の形は問わない
    it "http:// と https:// は通る" do
      expect(build(:event, external_url: "http://connpass.com/event/1")).to be_valid
      expect(build(:event, external_url: "https://connpass.com/event/1")).to be_valid
    end

    # 任意項目。allow_blank を落とすと「リンク無し」が作れなくなる
    it "未入力と空文字は通る" do
      expect(build(:event, external_url: nil)).to be_valid
      expect(build(:event, external_url: "")).to be_valid
    end
  end

  describe "UserLink#url" do
    # 元から効いていた検証が、定数の移動で壊れていないことを見る
    it "javascript: は引き続き止まる" do
      expect(build(:user_link, url: "javascript:alert(1)")).not_to be_valid
    end

    it "https:// は通る" do
      expect(build(:user_link, url: "https://github.com/example")).to be_valid
    end
  end

  describe "User#email" do
    # 監査で実際に保存できた値。ログインできないアカウントを発行できていた
    it "@ が無いものは止まる" do
      user = build(:user, email: "not-an-email")

      expect(user).not_to be_valid
      expect(user.errors[:email]).to be_present
    end

    it "ドメインにドットが無いものは止まる" do
      expect(build(:user, email: "taro@localhost")).not_to be_valid
    end

    it "空白を含むものは止まる" do
      expect(build(:user, email: "ta ro@example.ac.jp")).not_to be_valid
    end

    it "@ が2つあるものは止まる" do
      expect(build(:user, email: "a@b@example.ac.jp")).not_to be_valid
    end

    it "大学のアドレスは通る" do
      expect(build(:user, email: "taro@st.example.ac.jp")).to be_valid
    end

    # RFC 準拠の検証はしていない。打ち間違いを弾くのが目的で、
    # 記号を含むアドレスを使えなくしない
    it "記号を含むアドレスも通る" do
      expect(build(:user, email: "taro.yamada+circle@example.ac.jp")).to be_valid
    end
  end
end
