import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Shop } from '@/types/database'
import { buildPublicSlug } from '@/lib/site'

const ADMIN_EMAILS = ['welloliver@gmail.com']

export async function resolveActiveShop(user: User | null, isAdmin = false): Promise<Shop | null> {
  if (!user) return null

  const { data: shop, error } = await supabase
    .from('shops')
    .select('*')
    .eq('owner_user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[resolveActiveShop]', error)
    return null
  }

  if (!shop) {
    if (isAdmin) {
      const { data: firstShop } = await supabase
        .from('shops')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (firstShop) return firstShop as Shop
    }
    return null
  }

  const typed = shop as Shop
  if (!typed.public_slug) {
    try {
      const public_slug = buildPublicSlug(typed.name, typed.id)
      const { data: updated } = await supabase
        .from('shops')
        .update({ public_slug })
        .eq('id', typed.id)
        .select('*')
        .single()

      if (updated) return updated as Shop
    } catch {
      // column may not exist yet
    }
  }

  return typed
}
