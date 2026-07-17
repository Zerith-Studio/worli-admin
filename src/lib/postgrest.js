// ============================================
// FILE: lib/postgrest.js
// Helpers for the two PostgREST sharp edges this dashboard keeps hitting.
// ============================================

import { supabase } from "./supabase"
import { withTimeout } from "./query"

/**
 * Ceiling on how many customers a name/phone search resolves to before it feeds
 * an `in.(…)` list. Far above any realistic match count, and keeps the request
 * URL sane. Past this, the search belongs in a database-side view.
 */
export const USER_MATCH_LIMIT = 1000

/**
 * Quote a value for use inside a PostgREST `or()` logic tree.
 *
 * Unquoted values break the tree on `,` `.` `(` `)` — all of which a user can
 * type into a search box. The failure is not graceful: PostgREST rejects the
 * WHOLE filter with `failed to parse logic tree`, so one stray comma breaks
 * search entirely rather than just returning nothing.
 */
export const orLiteral = (v) => `"${String(v).replace(/["\\]/g, (c) => "\\" + c)}"`

/** An `or()` clause matching a customer by name or phone. */
export const userSearchClause = (search) =>
  `full_name.ilike.${orLiteral(`%${search}%`)},phone_number.ilike.${orLiteral(`%${search}%`)}`

/**
 * Resolve a free-text customer search to user ids.
 *
 * PostgREST cannot OR a column of the queried table against a column of an
 * EMBEDDED one (e.g. `users.full_name` when selecting orders) inside a single
 * logic tree — it rejects the entire filter. So any table that wants to be
 * searchable by customer name has to resolve the customer half to ids first and
 * filter on its own `user_id`.
 *
 * Returns an array of ids (possibly empty — meaning "nothing can match").
 */
export async function resolveUserIdsMatching(search) {
  const { data, error } = await withTimeout(
    supabase
      .from("users")
      .select("id")
      .or(userSearchClause(search))
      .limit(USER_MATCH_LIMIT)
  )
  if (error) throw error
  return (data ?? []).map((u) => u.id)
}
