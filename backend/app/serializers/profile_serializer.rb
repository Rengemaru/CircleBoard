# マイページのプロフィール(docs/api-spec.md §4.5)。
#
# UserSerializer とは別クラスにする。あちらはセッションと管理APIが使う
# 「id / name / role」の3つで、返す集合も見せる相手も違う。
# 1つにまとめると、ログイン応答にプロフィールが混ざるか、
# プロフィールに role が混ざるかのどちらかになる。
#
# 自分用(/api/users/me)と他人用(/api/users/:id)は分けない。
# 片方だけ塞いで漏れる事故を構造的に起こせなくするため(CLAUDE.md §3-2)。
# EventSerializer が detail: で切り替えているのと同じ考え方。
#
#   base   … ログインした人になら誰にでも返す
#   email  … 本人にだけ返す。他人のメールアドレスを配る理由がない
#
# role と suspended_at は返さない。管理画面の情報であって、
# プロフィールではない。
class ProfileSerializer
  def initialize(user, current_user: nil)
    @user = user
    @current_user = current_user
  end

  def as_json
    base = {
      id: @user.id,
      name: @user.name,
      department: @user.department,
      bio: @user.bio,
      enrollment_year: @user.enrollment_year,
      graduation_year: @user.graduation_year,
      # 学年(B1 / M1 / D2 …)。年度の切り替わり(4月始まり)を跨ぐ規則なので
      # サーバーが出す。画面ごとに計算させると、RubyとTypeScriptに同じものが
      # 2本並ぶ(graduated? と同じ理由)。卒業後と算出できないときは null。
      #
      # grade だけだと「卒業した」と「算出できない(入学年度が未来・10年目以降)」
      # の区別が付かないので、graduated も返す。管理APIも同じ形で返している
      grade: @user.grade,
      graduated: @user.graduated?,
      tags: @user.tags.map { TagSerializer.new(_1).as_json },
      links: @user.user_links.map { link_json(_1) }
    }

    return base unless self_view?

    base.merge(email: @user.email)
  end

  private

  def self_view?
    @current_user.present? && @current_user.id == @user.id
  end

  def link_json(link)
    { id: link.id, label: link.label, url: link.url }
  end
end
