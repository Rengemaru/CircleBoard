require "active_support/core_ext/integer/time"

Rails.application.configure do
  # Settings specified here will take precedence over those in config/application.rb.

  # Code is not reloaded between requests.
  config.enable_reloading = false

  # Eager load code on boot. This eager loads most of Rails and
  # your application in memory, allowing both threaded web servers
  # and those relying on copy on write to perform better.
  # Rake tasks automatically ignore this option for performance.
  config.eager_load = true

  # Full error reports are disabled and caching is turned on.
  config.consider_all_requests_local = false

  # Ensures that a master key has been made available in ENV["RAILS_MASTER_KEY"], config/master.key, or an environment
  # key such as config/credentials/production.key. This key is used to decrypt credentials (and other encrypted files).
  # config.require_master_key = true

  # Disable serving static files from `public/`, relying on NGINX/Apache to do so instead.
  # config.public_file_server.enabled = false

  # Enable serving of images, stylesheets, and JavaScripts from an asset server.
  # config.asset_host = "http://assets.example.com"

  # Specifies the header that your server uses for sending files.
  # config.action_dispatch.x_sendfile_header = "X-Sendfile" # for Apache
  # config.action_dispatch.x_sendfile_header = "X-Accel-Redirect" # for NGINX

  # Store uploaded files on the local file system (see config/storage.yml for options).
  # Active Storage は使わない(CLAUDE.md §1)ので設定も持たない

  # Mount Action Cable outside main process or domain.
  # config.action_cable.mount_path = nil
  # config.action_cable.url = "wss://example.com/cable"
  # config.action_cable.allowed_request_origins = [ "http://example.com", /http:\/\/example.*/ ]

  # HTTPSの強制。既定は true で、FORCE_SSL=false のときだけ切れる。
  # スイッチの実体と、なぜ1つにまとめているかは config/application.rb にある。
  #
  # assume_ssl を同じ値で動かすのは、TLS を終端するのが Caddy で、
  # backend に届くのは http だから。これが無いと force_ssl が
  # 「まだ http だ」と判断して https へ 301 し、Caddy がまた同じ http を
  # 投げ、リダイレクトが往復し続ける。
  config.assume_ssl = config.x.force_ssl
  config.force_ssl = config.x.force_ssl

  # Skip http-to-https redirect for the default health check endpoint.
  # config.ssl_options = { redirect: { exclude: ->(request) { request.path == "/up" } } }

  # Log to STDOUT by default
  config.logger = ActiveSupport::Logger.new(STDOUT)
    .tap  { |logger| logger.formatter = ::Logger::Formatter.new }
    .then { |logger| ActiveSupport::TaggedLogging.new(logger) }

  # Prepend all log lines with the following tags.
  config.log_tags = [ :request_id ]

  # "info" includes generic and useful information about system operation, but avoids logging too much
  # information to avoid inadvertent exposure of personally identifiable information (PII). If you
  # want to log everything, set the level to "debug".
  config.log_level = ENV.fetch("RAILS_LOG_LEVEL", "info")

  # Use a different cache store in production.
  # config.cache_store = :mem_cache_store

  # Use a real queuing backend for Active Job (and separate queues per environment).
  # config.active_job.queue_adapter = :resque
  # config.active_job.queue_name_prefix = "app_production"

  # Disable caching for Action Mailer templates even if Action Controller
  # caching is enabled.

  # Ignore bad email addresses and do not raise email delivery errors.
  # Set this to true and configure the email server for immediate delivery to raise delivery errors.
  # config.action_mailer.raise_delivery_errors = false

  # Enable locale fallbacks for I18n (makes lookups for any locale fall back to
  # the I18n.default_locale when a translation cannot be found).
  config.i18n.fallbacks = true

  # Don't log any deprecations.
  config.active_support.report_deprecations = false

  # Do not dump schema after migrations.
  config.active_record.dump_schema_after_migration = false

  # Only use :id for inspections in production.
  config.active_record.attributes_for_inspect = [ :id ]

  # Host ヘッダを詐称したアクセスを弾く(DNSリバインディング対策)。
  # 値は環境変数で渡す(CLAUDE.md §3-5)。ドメインを取る前は IP、取った後は
  # ドメイン名を入れる。複数書くときはカンマ区切り。
  #
  # 空のときは検査しない。Rails の本番既定がそうなっているので、
  # **これを設定し忘れても今までどおり動く。** 逆に言うと、入れ忘れると
  # 対策が効かないままになるので .env.production.example に既定値を置く。
  # reject(&:blank?) は末尾のカンマ対策。"a.example.jp," と書かれると
  # 空文字が1つ混ざり、Host ヘッダが空のリクエストが通るようになる
  config.hosts += ENV.fetch("ALLOWED_HOSTS", "").split(",").map(&:strip).reject(&:blank?)

  # 死活監視は Host ヘッダを付けずに叩かれることがある(cron から curl するなど)。
  # ここを除外しないと、アプリが正常でも監視だけが落ちる
  config.host_authorization = { exclude: ->(request) { request.path == "/healthz" } }
end
