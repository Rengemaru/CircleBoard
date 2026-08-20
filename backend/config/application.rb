require_relative "boot"

require "rails"
# Pick the frameworks you want:
require "active_model/railtie"
require "active_job/railtie"
require "active_record/railtie"
require "active_storage/engine"
require "action_controller/railtie"
require "action_mailer/railtie"
require "action_mailbox/engine"
require "action_text/engine"
require "action_view/railtie"
require "action_cable/engine"
# require "rails/test_unit/railtie"

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

module App
  class Application < Rails::Application
    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 7.2

    # Please, add to the `ignore` list any other `lib` subdirectories that do
    # not contain `.rb` files, or that should not be reloaded or eager loaded.
    # Common ones are `templates`, `generators`, or `middleware`, for example.
    config.autoload_lib(ignore: %w[assets tasks])

    # Configuration for the application, engines, and railties goes here.
    #
    # These settings can be overridden in specific environments using the files
    # in config/environments, which are processed later.
    #
    # config.time_zone = "Central Time (US & Canada)"
    # config.eager_load_paths << Rails.root.join("extras")

    # Only loads a smaller set of middleware suitable for API only apps.
    # Middleware like session, flash, cookies can be added back manually.
    # Skip views, helpers and assets when generating a new resource.
    config.api_only = true

    # APIモードは session / cookie ミドルウェアを読み込まないので手で戻す。
    # 認証はサーバー側セッション + HttpOnly Cookie で行う(docs/api-spec.md §0)。
    # トークンをJSから触れる場所に置かないため、この方式を選んでいる。
    config.middleware.use ActionDispatch::Cookies
    config.session_store :cookie_store,
                         key: "_circleboard_session",
                         httponly: true,      # JSから読めない = XSSで盗まれない
                         same_site: :lax
    config.middleware.use config.session_store, config.session_options

    # コンテナのログを docker compose logs で読めるようにする。
    # development の既定は log/development.log への出力で、コンテナ外から見えない。
    if ENV["RAILS_LOG_TO_STDOUT"].present?
      config.logger = ActiveSupport::Logger.new($stdout)
      config.logger.formatter = config.log_formatter
    end
  end
end
