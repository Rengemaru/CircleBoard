# 素のRubyクラス。gemは使わない(CLAUDE.md §4)。
#
# email と password_digest は返さない。仕様書 §4.1 のアクセス制御表に
# 載っていない情報は外に出さない。
class UserSerializer
  def initialize(user)
    @user = user
  end

  def as_json
    {
      id: @user.id,
      name: @user.name,
      role: @user.role
    }
  end
end
