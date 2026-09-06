# ログイン試行のレート制限(spec-v2.2.md §7.5 A-3)。
#
# カウンタの置き場を明示している。Rails.cache は development で :null_store に
# なることがあり、その場合カウントが1つも残らず、制限が黙って効かなくなる。
# 「設定したつもりで素通り」が一番まずいので、専用のメモリストアを持つ。
#
# プロセスごとのカウンタなので、Puma を複数ワーカーで動かすと上限はワーカー数倍に
# なる。1台構成(spec-v2.2.md §7.2)では1プロセスなので、いまは問題にならない。
Rack::Attack.cache.store = ActiveSupport::Cache::MemoryStore.new

LOGIN_ATTEMPTS_PER_MINUTE = 5

# 同一IPから5回/分。総当たりを止めるのが目的で、打ち間違いを咎めるものではない。
# 5回は「打ち間違い数回は通り、機械的な試行は止まる」ところに置いている。
#
# req.ip は Rails の RemoteIp ミドルウェアが X-Forwarded-For から組み立てた値。
# Caddy を挟んでも、コンテナ間の私設アドレスは除かれて実クライアントのIPが残る。
# ここを素の REMOTE_ADDR にすると、全アクセスが Caddy 1つのIPに見え、
# 1人が引っかかった瞬間に全員が締め出される
Rack::Attack.throttle("logins/ip", limit: LOGIN_ATTEMPTS_PER_MINUTE, period: 1.minute) do |req|
  req.ip if req.post? && req.path == "/api/session"
end

# 制限に当たったときの応答。形は docs/api-spec.md §0 の
# { "error": { "code": ..., "message": ... } } に合わせる。
# ここだけ別の形にすると、フロントのエラー処理が1箇所で済まなくなる
Rack::Attack.throttled_responder = lambda do |_request|
  body = { error: { code: "too_many_requests", message: "リクエストが多すぎます。しばらく待ってからやり直してください" } }

  [ 429, { "Content-Type" => "application/json" }, [ body.to_json ] ]
end
