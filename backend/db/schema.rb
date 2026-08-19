# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.2].define(version: 2026_08_19_073938) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "event_participations", force: :cascade do |t|
    t.bigint "event_id", null: false
    t.bigint "user_id"
    t.datetime "cancelled_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["event_id", "user_id"], name: "index_event_participations_active", unique: true, where: "(cancelled_at IS NULL)"
    t.index ["event_id"], name: "index_event_participations_on_event_id"
    t.index ["user_id"], name: "index_event_participations_on_user_id"
  end

  create_table "event_tags", force: :cascade do |t|
    t.bigint "event_id", null: false
    t.bigint "tag_id", null: false
    t.index ["event_id", "tag_id"], name: "index_event_tags_on_event_id_and_tag_id", unique: true
    t.index ["event_id"], name: "index_event_tags_on_event_id"
    t.index ["tag_id"], name: "index_event_tags_on_tag_id"
  end

  create_table "events", force: :cascade do |t|
    t.string "title", null: false
    t.text "description", null: false
    t.string "location", null: false
    t.datetime "starts_at", null: false
    t.integer "capacity"
    t.string "external_url"
    t.integer "status", default: 0, null: false
    t.integer "visibility", default: 0, null: false
    t.bigint "owner_id"
    t.integer "spotlight_score", default: 0, null: false
    t.boolean "pinned", default: false, null: false
    t.integer "recurrence_type", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["owner_id"], name: "index_events_on_owner_id"
    t.index ["pinned"], name: "index_events_single_pinned", unique: true, where: "(pinned = true)"
    t.index ["starts_at"], name: "index_events_on_starts_at"
    t.index ["status", "visibility"], name: "index_events_on_status_and_visibility"
  end

  create_table "project_participations", force: :cascade do |t|
    t.bigint "project_id"
    t.bigint "user_id"
    t.integer "status", default: 0, null: false
    t.datetime "approved_at", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["project_id", "user_id"], name: "index_project_participations_on_project_id_and_user_id", unique: true
    t.index ["project_id"], name: "index_project_participations_on_project_id"
    t.index ["user_id"], name: "index_project_participations_on_user_id"
  end

  create_table "project_tags", force: :cascade do |t|
    t.bigint "project_id", null: false
    t.bigint "tag_id", null: false
    t.index ["project_id", "tag_id"], name: "index_project_tags_on_project_id_and_tag_id", unique: true
    t.index ["project_id"], name: "index_project_tags_on_project_id"
    t.index ["tag_id"], name: "index_project_tags_on_tag_id"
  end

  create_table "projects", force: :cascade do |t|
    t.string "title", null: false
    t.text "description", null: false
    t.string "activity_schedule"
    t.string "meeting_schedule"
    t.integer "capacity"
    t.integer "status", default: 0, null: false
    t.integer "visibility", default: 0, null: false
    t.bigint "owner_id"
    t.boolean "requires_approval", default: false, null: false
    t.boolean "allow_multiple", default: true, null: false
    t.integer "recurrence_type", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["owner_id"], name: "index_projects_on_owner_id"
  end

  create_table "signage_tokens", force: :cascade do |t|
    t.string "token", null: false
    t.string "name", null: false
    t.datetime "revoked_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["token"], name: "index_signage_tokens_on_token", unique: true
  end

  create_table "tags", force: :cascade do |t|
    t.string "name", null: false
    t.integer "category", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_tags_on_name", unique: true
  end

  create_table "users", force: :cascade do |t|
    t.string "name", null: false
    t.string "email", null: false
    t.string "password_digest", null: false
    t.integer "role", default: 1, null: false
    t.integer "enrollment_year", null: false
    t.integer "graduation_year", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
  end

  add_foreign_key "event_participations", "events", on_delete: :cascade
  add_foreign_key "event_participations", "users", on_delete: :nullify
  add_foreign_key "event_tags", "events", on_delete: :cascade
  add_foreign_key "event_tags", "tags", on_delete: :cascade
  add_foreign_key "events", "users", column: "owner_id", on_delete: :nullify
  add_foreign_key "project_participations", "projects", on_delete: :nullify
  add_foreign_key "project_participations", "users", on_delete: :nullify
  add_foreign_key "project_tags", "projects", on_delete: :cascade
  add_foreign_key "project_tags", "tags", on_delete: :cascade
  add_foreign_key "projects", "users", column: "owner_id", on_delete: :nullify
end
