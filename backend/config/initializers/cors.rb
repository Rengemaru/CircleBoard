# フロントエンド(別オリジンのVite)からAPIを叩けるようにする。
#
# origins にワイルドカードを使わない。Cookieセッションを使うため
# credentials: true が必要で、ワイルドカードとは併用できない仕様でもある。
# 許可オリジンは環境変数で渡す(CLAUDE.md §3-5)。開発と本番でURLが変わるため。
#
# 開発中は LAN の別端末（スマホ・部室のディスプレイなど）から触りたい。
# 端末ごとにIPを書き足すのは現実的でないので、プライベートIPからのアクセスを
# まとめて許すスイッチを用意する。既定は off で、本番の挙動は変わらない。
ALLOWED_ORIGINS = ENV.fetch("CORS_ALLOWED_ORIGINS", "").split(",").map(&:strip).freeze

ALLOW_PRIVATE_NETWORK = ENV.fetch("CORS_ALLOW_PRIVATE_NETWORK", "false") == "true"

# RFC1918 のプライベートIPと loopback。ポートは任意
PRIVATE_ORIGIN = %r{
  \Ahttps?://
  (localhost|127\.\d+\.\d+\.\d+|
   10\.\d+\.\d+\.\d+|
   192\.168\.\d+\.\d+|
   172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)
  (:\d+)?\z
}x

Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins do |source, _env|
      ALLOWED_ORIGINS.include?(source) || (ALLOW_PRIVATE_NETWORK && source.match?(PRIVATE_ORIGIN))
    end

    resource "*",
             headers: :any,
             methods: [ :get, :post, :patch, :put, :delete, :options ],
             credentials: true
  end
end
