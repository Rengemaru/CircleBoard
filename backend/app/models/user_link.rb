class UserLink < ApplicationRecord
  # http(s) 以外を弾く。利用者が入れた文字列をそのまま <a href> に置くので、
  # javascript: を通すと、他の部員がクリックしたときにスクリプトが動く。
  # フロント側でも弾くが、curl で回避できるのでここを正とする
  # (docs/spec-my-page.md §6.1)
  ALLOWED_URL_SCHEME = %r{\Ahttps?://}

  belongs_to :user

  validates :label, presence: true, length: { maximum: 20 }
  # 形式は最初から見ていたが長さは見ていなかった(2026-09-12 の監査)。
  # 2000 はブラウザが扱える URL の実務上の上限
  MAX_URL_LENGTH = 2000

  validates :url, presence: true, length: { maximum: MAX_URL_LENGTH },
                  format: { with: ALLOWED_URL_SCHEME, message: "は http:// または https:// で始めてください" }
  validate :user_within_link_limit, on: :create

  private

  # UserTag と同じ理由で、User 側とここの両方に置く。
  # user.user_links = [...] は User のバリデーションを通らずに保存される
  def user_within_link_limit
    return if user.nil?
    return if user.user_links.count < User::MAX_LINKS

    errors.add(:base, "リンクは#{User::MAX_LINKS}件までです")
  end
end
