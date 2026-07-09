import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Shop } from '@/types/database'
import { buildPublicSlug } from '@/lib/site'

export async function resolveActiveShop(user: User | null): Promise<Shop | null> {
  if (user) {
    const { data: existing, error: readError } = await supabase
      .from('shops')
      .select('*')
      .eq('owner_user_id', user.id)
      .maybeSingle()

    if (readError) {
      if (readError.code === '42703') {
        const { data: fallback } = await supabase
          .from('shops')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()

        if (fallback) return fallback as Shop
        return null
      }
      console.error('[resolveActiveShop] Error reading shops:', readError)
      return null
    }

    if (existing) {
      const typedExisting = existing as Shop
      if (!typedExisting.public_slug) {
        try {
          const public_slug = buildPublicSlug(typedExisting.name, typedExisting.id)
          const { data: updated, error: updateError } = await supabase
            .from('shops')
            .update({ public_slug })
            .eq('id', typedExisting.id)
            .select('*')
            .single()

          if (!updateError && updated) return updated as Shop
        } catch {
          // column may not exist yet
        }
      }

      return typedExisting
    }

    const { data: unownedShop, error: fallbackError } = await supabase
      .from('shops')
      .select('*')
      .is('owner_user_id', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (fallbackError) {
      console.error('[resolveActiveShop] Error reading unowned shops:', fallbackError)
    }

    if (unownedShop) {
      try {
        const public_slug = unownedShop.public_slug ?? buildPublicSlug(unownedShop.name, unownedShop.id)
        const { data: claimed, error: claimError } = await supabase
          .from('shops')
          .update({ owner_user_id: user.id, public_slug })
          .eq('id', unownedShop.id)
          .select('*')
          .single()

        if (!claimError && claimed) return claimed as Shop
      } catch {
        // column may not exist yet
      }
      return unownedShop as Shop
    }

    return null
  }

  const { data: firstShop, error } = await supabase
    .from('shops')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[resolveActiveShop] Error reading first shop:', error)
    return null
  }
  return (firstShop as Shop | null) ?? null
}

export async function createShop(userId: string, name: string): Promise<Shop> {
  const { data: created, error: createError } = await supabase
    .from('shops')
    .insert({
      owner_user_id: userId,
      name: name.trim(),
    })
    .select('*')
    .single()

  if (createError) {
    console.error('[createShop] Error:', createError)
    throw new Error(`Erro ao criar barbearia: ${createError.message}`)
  }

  return created as Shop
}
