# request spec でログイン状態を作るためのヘルパー。
#
# 認可の出し分けは「未ログインで返らないこと」と「ログイン時は返ること」の
# 両方向を確かめる必要がある(片方だけだと、常に返さない実装でも通ってしまう)。
# そのぶんログイン処理が各 spec に散らばるので、ここ1箇所にまとめる。
module AuthenticationHelpers
  def sign_in(user, password: "password123")
    post "/api/session", params: { email: user.email, password: password }, as: :json
  end
end
