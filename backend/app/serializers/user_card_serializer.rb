# 参加者・主催の一覧に出す1人分(docs/spec-my-page.md §4.4、Issue #214)。
#
# UserSerializer とは別クラスにする。あちらはログイン応答と管理APIが使う
# id / name / role の3つで、role は名前の横に出すものではない。
#
# 学科と呼ばれ方は、ログインした人なら GET /api/users/:id でも見られる
# (ProfileSerializer)。ここに足しても見せる範囲は変わらない。
#
# **出すかどうかの判断はここでしない。** 未ログインには owner も
# participants もキーごと返さないという判断は、EventSerializer /
# ProjectSerializer 側にある(CLAUDE.md §3-2)。
class UserCardSerializer
  def initialize(user)
    @user = user
  end

  def as_json
    {
      id: @user.id,
      name: @user.name,
      department: @user.department,
      pronouns: @user.pronouns
    }
  end
end
