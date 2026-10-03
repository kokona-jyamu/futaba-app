/* lib/apiTypes.ts — API ルートが返す JSON の形（API 側と画面側で共用する）
 *
 * テーブルの列は DB から生成した型（lib/database.types.ts）から取り出す。
 * DB を変えたら npm run gen:types で型を作り直すと、食い違いが型エラーで分かる。
 *
 * API 側：NextResponse.json<型>(...) で返す
 * 画面側：fetchJson<型>(...) で受け取る
 */

import type { Tables } from '@/lib/database.types'
import type { AllergenMap } from '@/lib/allergens'

/** どの API も、失敗したときは error を返す */
export type ApiError = { error: string }

/* ================================================================
   職員向け
   ================================================================ */

/* ---------- /api/admin/attendance：食数と欠席・遅刻 ---------- */

export type AllergenTag = { key: string; label: string; emoji: string }

/** 食数画面に並べる園児 */
export type AttendanceChild = {
  id: string
  name: string
  class_name: string | null
  meal_type_id: string | null
  meal_type_name: string | null
  /** 除去の対象（確認待ちのときは変更前と変更後の両方） */
  allergens: AllergenTag[]
  /** 保護者が変更し、職員がまだ確認していない */
  allergy_pending: boolean
}

type AttendanceRow = Tables<'attendances'>

export type AbsentChild = AttendanceChild &
  Pick<AttendanceRow, 'reason_type' | 'reason' | 'temperature' | 'symptoms' | 'created_at'>

export type LateChild = AttendanceChild &
  Pick<AttendanceRow, 'arrival_time' | 'needs_lunch' | 'reason_type' | 'reason' | 'temperature'>

/** 食事区分ごとの食数。free は除去食の内訳 */
export type MealCount = {
  id: string
  name: string
  is_baby: boolean
  count: number
  free: { keys: string[]; label: string; count: number }[]
}

export type AttendanceSummary = {
  date: string
  mealTypes: Tables<'meal_types'>[]
  counts: MealCount[]
  total: number
  enrolled: number
  absent: AbsentChild[]
  late: LateChild[]
  noReport: AttendanceChild[]
  allergyCounts: (AllergenTag & { count: number })[]
  allergyChildren: AttendanceChild[]
  feverCount: number
  deadline: string
  labelFormat: string
  showInCounts: boolean
  commonFree: AllergenMap
}

/* ---------- /api/admin/children/list：園児一覧 ---------- */

export type ChildListItem = {
  id: string
  login_no: string
  name: string
  class_name: string | null
  has_account: boolean
  last_seen_at: string | null
  allergens: AllergenMap
  /** 職員が最後に確認した内容 */
  allergens_confirmed: AllergenMap
  allergens_updated_at: string | null
  allergens_updated_by_role: 'guardian' | 'staff' | null
}

export type ChildrenListResponse = { children: ChildListItem[] }

/* ---------- /api/admin/children/bulk：名簿からの一括登録 ---------- */

export type BulkChildResult =
  | { ok: true; login_no: string; name: string; class_name: string | null; pin: string }
  | { ok: false; login_no: string; name: string; error: string }

export type ChildrenBulkResponse = {
  results: BulkChildResult[]
  succeeded: number
  failed: number
}

/* ---------- /api/admin/children/allergens：アレルギーの確認待ち ---------- */

export type AllergyPendingChild = {
  id: string
  login_no: string
  name: string
  class_name: string | null
  added: string[]
  removed: string[]
}

export type AllergyPendingResponse = { pending: AllergyPendingChild[] }

/** 編集・確認のあとに返る、その園児のアレルギー情報 */
export type AllergyUpdateResponse = {
  child: Pick<
    ChildListItem,
    'id' | 'allergens' | 'allergens_confirmed' | 'allergens_updated_at' | 'allergens_updated_by_role'
  >
}

/* ---------- /api/admin/classes：クラスと所属 ---------- */

export type ClassChild = Pick<
  Tables<'children'>,
  'id' | 'login_no' | 'name' | 'class_name' | 'is_active' | 'graduated_at'
> & {
  /** 今日時点の所属 */
  class_id: string | null
  /** 所属の履歴（新しい順） */
  history: Tables<'child_classes'>[]
}

export type ClassesResponse = {
  classes: Tables<'classes'>[]
  children: ClassChild[]
}

/* ---------- /api/admin/meal-types：食事区分と割り当て ---------- */

export type MealTypeChild = Pick<Tables<'children'>, 'id' | 'login_no' | 'name' | 'class_name'> & {
  /** 今日時点の区分と、その開始日 */
  meal_type_id: string | null
  start_date: string | null
}

export type MealTypesResponse = {
  mealTypes: Tables<'meal_types'>[]
  children: MealTypeChild[]
  history: Tables<'child_meal_types'>[]
}

/* ---------- /api/admin/settings：園の設定 ---------- */

export type SchoolSettings = Pick<
  Tables<'schools'>,
  'id' | 'name' | 'attendance_deadline' | 'allergy_label_format' | 'show_allergy_in_counts'
> & { common_free_allergens: AllergenMap }

export type EnrolledAllergen = {
  key: string
  count: number
  children: { name: string; class_name: string | null }[]
}

export type SettingsResponse = {
  settings: SchoolSettings
  enrolledAllergens: EnrolledAllergen[]
}

/* ---------- /api/admin/events・/api/admin/menus/list ---------- */

export type FoodEvent = Tables<'food_education_events'>
export type EventsResponse = { events: FoodEvent[] }

export type Menu = Tables<'menus'>
export type MenusResponse = { menus: Menu[] }

/* ---------- /api/admin/replies：保護者からの質問 ---------- */

export type Reply = Pick<Tables<'messages'>, 'id' | 'body' | 'created_at' | 'replied_to'>

export type AdminQuestion = Tables<'messages'> & {
  menus: Pick<Menu, 'title' | 'served_date' | 'school_id'>
  replies: Reply[]
}

export type RepliesResponse = { messages: AdminQuestion[] }

/* ================================================================
   保護者向け
   ================================================================ */

/* ---------- /api/attendance：自分の子の出欠 ---------- */

export type Attendance = Tables<'attendances'>
export type AttendanceListResponse = { attendances: Attendance[]; deadline: string }

/* ---------- /api/questions：自分の質問と返信 ---------- */

export type GuardianQuestion = Pick<Tables<'messages'>, 'id' | 'menu_id' | 'body' | 'created_at'> & {
  menus: Pick<Menu, 'title' | 'served_date'> | null
  replies: (Reply & Pick<Tables<'messages'>, 'sender_name'>)[]
}

export type QuestionsResponse = {
  used: number
  limit: number
  remaining: number
  questions: GuardianQuestion[]
}
