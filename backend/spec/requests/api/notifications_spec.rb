require "rails_helper"

# アプリ内通知(Issue #292)。**自分が判断すべきことだけ**が返ること。
#
# 誰に何を見せるかはAPIで決める(CLAUDE.md §3-2)。画面で絞るのではないので、
# 直接叩いて他人の申請が見えないことをここで確かめる。
RSpec.describe "アプリ内通知", type: :request do
  let(:owner) { create(:user) }
  let(:member) { create(:user) }
  let(:admin) { create(:user, role: :admin) }
  let(:project) { create(:project, owner: owner) }

  # 申請中の参加を1件作る
  def request_withdrawal(project, user)
    participation = create(:project_participation, project: project, user: user)
    participation.request_withdrawal!
    participation
  end

  it "未ログインでは 401 を返す" do
    get "/api/notifications"

    expect(response).to have_http_status(:unauthorized)
  end

  it "何も無いときは空で返す" do
    sign_in(owner)
    get "/api/notifications"

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["items"]).to eq([])
  end

  it "オーナーには自分の企画の脱退申請が返る" do
    participation = request_withdrawal(project, member)

    sign_in(owner)
    get "/api/notifications"

    items = response.parsed_body["items"]
    expect(items.size).to eq(1)
    expect(items.first["type"]).to eq("project_withdrawal")
    expect(items.first["id"]).to eq(participation.id)
    expect(items.first.dig("project", "title")).to eq(project.title)
    expect(items.first.dig("user", "name")).to eq(member.name)
    expect(items.first["requested_at"]).to be_present
  end

  # **ここが漏れると、他人の企画の事情が誰にでも見える**
  it "他人の企画の申請は返らない" do
    request_withdrawal(project, member)
    outsider = create(:user)

    sign_in(outsider)
    get "/api/notifications"

    expect(response.parsed_body["items"]).to eq([])
  end

  it "申請した本人にも返らない（判断するのは owner なので）" do
    request_withdrawal(project, member)

    sign_in(member)
    get "/api/notifications"

    expect(response.parsed_body["items"]).to eq([])
  end

  # オーナーが放置したときに気づけるのは部長だけ(オーナー決定 2026-09-13)
  it "管理者には他人の企画の申請も返る" do
    request_withdrawal(project, member)

    sign_in(admin)
    get "/api/notifications"

    expect(response.parsed_body["items"].size).to eq(1)
  end

  it "承認すると消える" do
    participation = request_withdrawal(project, member)
    participation.approve_withdrawal!

    sign_in(owner)
    get "/api/notifications"

    expect(response.parsed_body["items"]).to eq([])
  end

  it "却下すると消える" do
    participation = request_withdrawal(project, member)
    participation.cancel_withdrawal_request!

    sign_in(owner)
    get "/api/notifications"

    expect(response.parsed_body["items"]).to eq([])
  end

  it "申請していない参加は返らない" do
    create(:project_participation, project: project, user: member)

    sign_in(owner)
    get "/api/notifications"

    expect(response.parsed_body["items"]).to eq([])
  end

  it "ゴミ箱に入れた企画の申請は返らない" do
    request_withdrawal(project, member)
    project.update!(visibility: :trashed)

    sign_in(owner)
    get "/api/notifications"

    expect(response.parsed_body["items"]).to eq([])
  end

  it "古い申請が先に並ぶ" do
    other = create(:project, owner: owner)
    new_one = request_withdrawal(project, member)
    old_one = request_withdrawal(other, create(:user))
    old_one.update!(withdrawal_requested_at: 3.days.ago)

    sign_in(owner)
    get "/api/notifications"

    expect(response.parsed_body["items"].map { _1["id"] }).to eq([ old_one.id, new_one.id ])
  end

  # 件数が増えても発行するクエリを増やさない(CLAUDE.md §3-3)
  it "件数が増えてもクエリ数が変わらない" do
    request_withdrawal(project, member)
    sign_in(owner)

    one = count_queries { get "/api/notifications" }

    3.times { request_withdrawal(create(:project, owner: owner), create(:user)) }
    many = count_queries { get "/api/notifications" }

    expect(many).to eq(one)
  end

  def count_queries(&block)
    count = 0
    counter = ->(_name, _start, _finish, _id, payload) {
      count += 1 unless payload[:name].in?([ "SCHEMA", "TRANSACTION" ])
    }
    ActiveSupport::Notifications.subscribed(counter, "sql.active_record", &block)
    count
  end
end
