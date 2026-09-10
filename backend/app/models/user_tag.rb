class UserTag < ApplicationRecord
  belongs_to :user
  belongs_to :tag

  validate :user_within_tag_limit, on: :create

  private

  # 上限は User 側にも書いてあるが、そちらだけでは足りない。
  # user.tags = [...] は中間テーブルへ直接 INSERT するため、
  # User のバリデーションを通らずに増える（実際に6件通ってしまった）。
  #
  # 逆に、ここだけでも足りない。user.user_tags.build を何本も並べてから
  # save すると、どの行から見ても「DB上の既存はまだ0件」になる。
  # 経路が2つあるので、両方に置く。
  def user_within_tag_limit
    return if user.nil?
    return if user.user_tags.count < User::MAX_TAGS

    errors.add(:base, "スキルは#{User::MAX_TAGS}件までです")
  end
end
