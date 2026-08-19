# フロントエンド(別オリジンのVite)からAPIを叩けるようにする。
#
# origins にワイルドカードを使わない。Cookieセッションを使うため
# credentials: true が必要で、ワイルドカードとは併用できない仕様でもある。
# 許可オリジンは環境変数で渡す(CLAUDE.md §3-5)。開発と本番でURLが変わるため。
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins ENV.fetch("CORS_ALLOWED_ORIGINS", "").split(",").map(&:strip)

    resource "*",
             headers: :any,
             methods: [:get, :post, :patch, :put, :delete, :options],
             credentials: true
  end
end
