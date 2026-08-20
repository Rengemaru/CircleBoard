# request spec でログイン状態を作るためのヘルパー。
#
# 認可の出し分けは「未ログインで返らないこと」と「ログイン時は返ること」の
# 両方向を確かめる必要がある(片方だけだと、常に返さない実装でも通ってしまう)。
# そのぶんログイン処理が各 spec に散らばるので、ここ1箇所にまとめる。
module AuthenticationHelpers
  def sign_in(user, password: "password123")
    post "/api/session", params: { email: user.email, password: password }, as: :json
    # ログイン自体が失敗していると、呼び出し元のテストが別の理由で落ちて
    # 原因の切り分けを誤らせる。ここで先に気づけるようにしておく
    raise "sign_in に失敗しました: #{response.status} #{response.body}" unless response.successful?
  end
end
