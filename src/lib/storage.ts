import { supabase } from './supabase'

const GALLERY_BUCKET = 'gallery'

export async function ensureGalleryBucket(): Promise<boolean> {
  return true
}

export async function uploadHeroPhoto(shopId: string, file: File): Promise<string | null> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${shopId}/hero.${ext}`

  const { error } = await supabase.storage
    .from(GALLERY_BUCKET)
    .upload(path, file, { upsert: true })

  if (error) {
    console.error('[Storage] Erro ao upload hero:', error.message)
    return null
  }

  const { data: urlData } = supabase.storage
    .from(GALLERY_BUCKET)
    .getPublicUrl(path)

  return urlData?.publicUrl ?? null
}

export async function uploadGalleryPhoto(shopId: string, file: File): Promise<string | null> {
  const ext = file.name.split('.').pop() || 'jpg'
  const timestamp = Date.now()
  const path = `${shopId}/gallery/${timestamp}.${ext}`

  const { error } = await supabase.storage
    .from(GALLERY_BUCKET)
    .upload(path, file, { upsert: true })

  if (error) {
    console.error('[Storage] Erro ao upload galeria:', error.message)
    return null
  }

  const { data: urlData } = supabase.storage
    .from(GALLERY_BUCKET)
    .getPublicUrl(path)

  return urlData?.publicUrl ?? null
}

export async function deletePhoto(publicUrl: string): Promise<boolean> {
  const url = new URL(publicUrl)
  const path = url.pathname.split('/').slice(6).join('/')

  const { error } = await supabase.storage
    .from(GALLERY_BUCKET)
    .remove([path])

  if (error) {
    console.error('[Storage] Erro ao deletar:', error.message)
    return false
  }

  return true
}

export async function uploadLogoPhoto(shopId: string, file: File): Promise<string | null> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${shopId}/logo.${ext}`

  const { error } = await supabase.storage
    .from(GALLERY_BUCKET)
    .upload(path, file, { upsert: true })

  if (error) {
    console.error('[Storage] Erro ao upload logo:', error.message)
    return null
  }

  const { data: urlData } = supabase.storage
    .from(GALLERY_BUCKET)
    .getPublicUrl(path)

  return urlData?.publicUrl ?? null
}
