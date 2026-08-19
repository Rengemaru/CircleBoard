# 開発用のシードデータ。
#
# 何度実行しても壊れないよう find_or_create_by! で書く。2回目以降は
# ブロックが実行されないため、レコードは増えない。
#
# 開発環境専用。パスワードは全員 password123（README に明記）。

puts "== users =="
admin = User.find_or_create_by!(email: "admin@example.ac.jp") do |u|
  u.name = "部長 管理"
  u.role = :admin
  u.password = "password123"
  u.enrollment_year = 2024
  u.graduation_year = 2028
end

members = [
  { email: "taro@example.ac.jp",   name: "山田太郎",  enrollment_year: 2026, graduation_year: 2030 },
  { email: "hanako@example.ac.jp", name: "佐藤花子",  enrollment_year: 2025, graduation_year: 2029 },
  { email: "ichiro@example.ac.jp", name: "鈴木一郎",  enrollment_year: 2024, graduation_year: 2028 }
].map do |attrs|
  User.find_or_create_by!(email: attrs[:email]) do |u|
    u.name = attrs[:name]
    u.role = :member
    u.password = "password123"
    u.enrollment_year = attrs[:enrollment_year]
    u.graduation_year = attrs[:graduation_year]
  end
end
taro, hanako, ichiro = members
puts "users: #{User.count}"

puts "== tags =="
TAG_NAMES = [ "Web開発", "ゲーム制作", "機械学習", "ハッカソン", "LT", "競プロ", "交流", "新入生", "初心者歓迎" ].freeze
tags = TAG_NAMES.index_with do |name|
  Tag.find_or_create_by!(name: name) { |t| t.category = :project_event }
end
puts "tags: #{Tag.count}"

puts "== events =="
# starts_at は注目スコア(§3)の動作確認に使うため、意図的に散らしている。
#   3日後  … 開催間近ボーナスが大きく効く
#   8日後  … 中間
#   20日後 … 14日を超えるのでボーナスは0
#   過去   … 表示対象から除外される
events = [
  {
    title: "新歓ハッカソン2026", starts_at: 3.days.from_now, capacity: 20, owner: hanako,
    location: "部室A", tags: [ "ハッカソン", "新入生", "初心者歓迎" ],
    description: "初心者大歓迎！2日間でチーム開発を体験します。"
  },
  {
    title: "LT大会 vol.13", starts_at: 8.days.from_now, capacity: 30, owner: taro,
    location: "情報棟202", tags: [ "LT", "交流" ],
    description: "5分間で好きなことを話す会。テーマ自由。"
  },
  {
    title: "競プロ勉強会", starts_at: 20.days.from_now, capacity: nil, owner: ichiro,
    location: "オンライン", tags: [ "競プロ", "初心者歓迎" ],
    description: "ABC埋めをもくもくやります。人数制限なし。"
  },
  {
    title: "春の新入生歓迎会", starts_at: 10.days.ago, capacity: 40, owner: admin,
    location: "学生会館ホール", tags: [ "新入生", "交流" ],
    description: "終了したイベント。過去分の表示確認用。"
  }
].map do |attrs|
  event = Event.find_or_create_by!(title: attrs[:title]) do |e|
    e.description = attrs[:description]
    e.location = attrs[:location]
    e.starts_at = attrs[:starts_at]
    e.capacity = attrs[:capacity]
    e.owner = attrs[:owner]
    e.status = attrs[:starts_at].past? ? :completed : :recruiting
  end
  event.tags = attrs[:tags].map { |name| tags[name] }
  event
end
hackathon, lt, kyopro, welcome = events
puts "events: #{Event.count}"

puts "== projects =="
[
  {
    title: "Webアプリ開発チーム", status: :recruiting, capacity: 6, owner: hanako,
    activity_schedule: "毎週土曜", meeting_schedule: "毎週水曜 19:00〜",
    tags: [ "Web開発" ], description: "部内で使うツールを作っています。"
  },
  {
    title: "自作ゲーム制作", status: :recruiting, capacity: 4, owner: taro,
    activity_schedule: "隔週日曜", meeting_schedule: "毎週金曜 18:00〜",
    tags: [ "ゲーム制作" ], description: "Unityで2Dアクションを作ります。"
  },
  {
    title: "機械学習輪読会", status: :in_progress, capacity: nil, owner: ichiro,
    activity_schedule: "毎週火曜", meeting_schedule: "毎週火曜 20:00〜",
    tags: [ "機械学習" ], description: "進行中。途中参加も歓迎。"
  }
].each do |attrs|
  project = Project.find_or_create_by!(title: attrs[:title]) do |p|
    p.description = attrs[:description]
    p.activity_schedule = attrs[:activity_schedule]
    p.meeting_schedule = attrs[:meeting_schedule]
    p.capacity = attrs[:capacity]
    p.status = attrs[:status]
    p.owner = attrs[:owner]
  end
  project.tags = attrs[:tags].map { |name| tags[name] }
end
puts "projects: #{Project.count}"

puts "== event_participations =="
# 同一(event, user)の組は1つだけ作る。部分ユニークインデックス
# index_event_participations_active は cancelled_at IS NULL の行のみを
# 対象とするため、参加中の行を2つ作ると衝突する。
[
  { event: hackathon, user: taro,   cancelled_at: nil },
  { event: hackathon, user: ichiro, cancelled_at: nil },
  { event: hackathon, user: admin,  cancelled_at: 2.days.ago },
  { event: lt,        user: hanako, cancelled_at: nil },
  { event: lt,        user: ichiro, cancelled_at: 1.day.ago },
  { event: kyopro,    user: taro,   cancelled_at: nil },
  { event: welcome,   user: hanako, cancelled_at: nil }
].each do |attrs|
  EventParticipation.find_or_create_by!(event: attrs[:event], user: attrs[:user]) do |p|
    p.cancelled_at = attrs[:cancelled_at]
  end
end
puts "event_participations: #{EventParticipation.count}（うちキャンセル済み #{EventParticipation.where.not(cancelled_at: nil).count}）"

puts "== project_participations =="
# approved_at は NOT NULL かつDBのデフォルト値が無いため、必ず明示的に渡す。
# MVPでは即時承認なので created_at と同値でよい(仕様書 §2.6)。
web_app = Project.find_by!(title: "Webアプリ開発チーム")
ml = Project.find_by!(title: "機械学習輪読会")
[
  { project: web_app, user: taro },
  { project: web_app, user: ichiro },
  { project: ml,      user: hanako }
].each do |attrs|
  ProjectParticipation.find_or_create_by!(project: attrs[:project], user: attrs[:user]) do |p|
    p.status = :approved
    p.approved_at = Time.current
  end
end
puts "project_participations: #{ProjectParticipation.count}"

puts "== signage_tokens =="
# token は再実行で作り直さない。既存の端末に配ったURLが無効になるため。
SignageToken.find_or_create_by!(name: "部室メインディスプレイ") do |t|
  t.token = SecureRandom.hex(16)
end
puts "signage_tokens: #{SignageToken.count}"

puts "seed 完了"
