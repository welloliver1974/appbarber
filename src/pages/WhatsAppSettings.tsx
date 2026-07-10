import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import PageTransition from '@/components/PageTransition'
import { MessageSquare, Check, X, Loader2, Save, Zap, ShieldCheck, Wifi, AlertTriangle, Globe, Copy, Plus, Trash2, Upload, Store } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/providers/AuthProvider'
import { buildPublicSiteUrl } from '@/lib/site'
import { ensureGalleryBucket, uploadHeroPhoto, uploadGalleryPhoto, deletePhoto } from '@/lib/storage'
import type { WhatsAppConfig } from '@/types/database'

const DAY_CONFIG = [
  { key: 'segunda', label: 'Segunda-feira' },
  { key: 'terca', label: 'Terça-feira' },
  { key: 'quarta', label: 'Quarta-feira' },
  { key: 'quinta', label: 'Quinta-feira' },
  { key: 'sexta', label: 'Sexta-feira' },
  { key: 'sabado', label: 'Sábado' },
  { key: 'domingo', label: 'Domingo' },
]

interface ShopOption { id: string; name: string }

function WhatsAppSettings() {
  const { shop, loading: shopLoading, isAdmin } = useAuth()
  const [config, setConfig] = useState<WhatsAppConfig | null>(null)
  const [allShops, setAllShops] = useState<ShopOption[]>([])
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testNumber, setTestNumber] = useState('')
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const [serverUrl, setServerUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [instanceName, setInstanceName] = useState('')
  const [reengageIntervalDays, setReengageIntervalDays] = useState('22')

  const [siteInstagram, setSiteInstagram] = useState('')
  const [siteHeroPhoto, setSiteHeroPhoto] = useState('')
  const [siteGalleryPhotos, setSiteGalleryPhotos] = useState<string[]>([])
  const [siteWorkingHours, setSiteWorkingHours] = useState<Record<string, { start: string; end: string }>>({})
  const [savingSite, setSavingSite] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [sitePublicSlug, setSitePublicSlug] = useState<string | null>(null)

  const targetShopId = selectedShopId || shop?.id

  // Admin without a shop: load all shops for selection
  useEffect(() => {
    if (!isAdmin || shop) return
    supabase.rpc('admin_get_all_shops').then(({ data }) => {
      if (data) setAllShops(data as ShopOption[])
    })
  }, [isAdmin, shop])

  useEffect(() => {
    load()
  }, [targetShopId, shopLoading])

  async function load() {
    try {
      if (shopLoading) return
      if (!targetShopId) {
        setConfig(null)
        setLoading(false)
        return
      }
      const [whatsRes, shopRes] = await Promise.all([
        supabase
          .from('whatsapp_configs')
          .select('*')
          .eq('active', true)
          .eq('shop_id', targetShopId)
          .maybeSingle(),
        supabase
          .from('shops')
          .select('instagram, hero_photo, gallery_photos, working_hours, public_slug')
          .eq('id', targetShopId)
          .single(),
      ])

      if (whatsRes.data) {
        const c = whatsRes.data as WhatsAppConfig & { reengage_interval_days?: number | null }
        setConfig(c)
        setServerUrl(c.server_url)
        setApiKey(c.api_key)
        setInstanceName(c.instance_name)
        setReengageIntervalDays(String(c.reengage_interval_days ?? 22))
      }

      if (shopRes.data) {
        const s = shopRes.data as { instagram: string | null; hero_photo: string | null; gallery_photos: string[] | null; working_hours: Record<string, string> | null; public_slug: string | null }
        setSitePublicSlug(s.public_slug)
        setSiteInstagram(s.instagram ?? '')
        setSiteHeroPhoto(s.hero_photo ?? '')
        setSiteGalleryPhotos(Array.isArray(s.gallery_photos) ? s.gallery_photos : [])

        const wh: Record<string, { start: string; end: string }> = {}
        if (s.working_hours) {
          for (const [day, range] of Object.entries(s.working_hours)) {
            const [start = '', end = ''] = range.split('-')
            wh[day] = { start, end }
          }
        }
        setSiteWorkingHours(wh)
      }
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    if (!serverUrl.trim() || !apiKey.trim() || !instanceName.trim()) return
    if (!targetShopId) {
      toast.error('Selecione uma barbearia')
      return
    }
    setSaving(true)

    const payload = {
      shop_id: targetShopId,
      server_url: serverUrl.replace(/\/$/, ''),
      instance_name: instanceName.trim(),
      api_key: apiKey.trim(),
      webhook_secret: '',
      active: true,
      reengage_interval_days: parseInt(reengageIntervalDays, 10) || 22,
    }

    let opError = null
    if (config) {
      const { data: upd, error } = await supabase.from('whatsapp_configs').update(payload).eq('id', config.id).select('id')
      if (upd && upd.length === 0) opError = { message: 'Sem permissão para alterar. Contate o administrador.' }
      else opError = error
    } else {
      const { error } = await supabase.from('whatsapp_configs').insert(payload)
      opError = error
    }

    if (opError) {
      toast.error('Erro ao salvar: ' + opError.message)
      setSaving(false)
      return
    }

    await load()
    setSaving(false)
    toast.success('Configuração salva!')
  }

  async function testConnection() {
    if (!serverUrl.trim() || !apiKey.trim() || !instanceName.trim() || !testNumber.trim()) return
    setTesting(true)
    setTestStatus('idle')

    try {
      const response = await fetch(
        `${serverUrl.replace(/\/$/, '')}/message/sendText/${instanceName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: apiKey,
          },
          body: JSON.stringify({
            number: testNumber.replace(/\D/g, ''),
            text: '🔧 Teste de conexão — AppBarber',
            delay: 1000,
          }),
        },
      )

      if (response.ok) {
        setTestStatus('success')
        toast.success('Mensagem de teste enviada!')
      } else {
        setTestStatus('error')
        toast.error('Falha ao enviar. Verifique as credenciais.')
      }
    } catch {
      setTestStatus('error')
      toast.error('Servidor não encontrado. Verifique a URL.')
    } finally {
      setTesting(false)
    }
  }

  async function saveSiteSettings() {
    if (!targetShopId) return
    setSavingSite(true)

    const workingHours: Record<string, string> = {}
    for (const [day, times] of Object.entries(siteWorkingHours)) {
      if (times.start && times.end) {
        workingHours[day] = `${times.start}-${times.end}`
      }
    }

    const { data: updated, error } = await supabase
      .from('shops')
      .update({
        instagram: siteInstagram.trim() || null,
        hero_photo: siteHeroPhoto.trim() || null,
        gallery_photos: siteGalleryPhotos.filter((u) => u.trim()).length > 0 ? siteGalleryPhotos.filter((u) => u.trim()) : null,
        working_hours: Object.keys(workingHours).length > 0 ? workingHours : null,
      })
      .eq('id', targetShopId)
      .select('id')

    if (error) {
      toast.error('Erro ao salvar configurações do site: ' + error.message)
    } else if (!updated || updated.length === 0) {
      toast.error('Sem permissão para alterar esta barbearia. Contate o administrador.')
    } else {
      toast.success('Configurações do site salvas!')
    }

    setSavingSite(false)
  }

  const connectionState = useMemo(() => {
    if (!config) return { label: 'Não configurado', tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', icon: AlertTriangle }
    return { label: 'Configuração ativa', tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', icon: ShieldCheck }
  }, [config])

  const ConnectionIcon = connectionState.icon

  return (
    <PageTransition>
      <div className="p-4 sm:p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg shadow-indigo-500/20">
              <MessageSquare className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">WhatsApp</h1>
              <p className="text-sm text-muted-foreground">Notificações automáticas via Evolution API</p>
            </div>
          </div>
          <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${connectionState.tone}`}>
            <ConnectionIcon className="size-3.5" />
            {connectionState.label}
          </div>
        </div>

        {/* Admin shop selector */}
        {isAdmin && !shop && allShops.length > 0 && !targetShopId && (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-indigo-500/10 bg-indigo-500/5 p-4">
            <Store className="size-5 text-indigo-500" />
            <select
              className="flex-1 rounded-xl border border-indigo-500/20 bg-card px-3 py-2 text-sm focus:ring-indigo-500"
              value=""
              onChange={(e) => setSelectedShopId(e.target.value)}
            >
              <option value="">Selecione uma barbearia...</option>
              {allShops.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {loading ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="h-96 animate-pulse rounded-2xl border border-indigo-500/10 bg-card/70" />
            <div className="h-96 animate-pulse rounded-2xl border border-indigo-500/10 bg-card/70" />
            <div className="h-96 animate-pulse rounded-2xl border border-indigo-500/10 bg-card/70" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-indigo-500/10">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <Zap className="size-4" />
                  </div>
                  <div>
                    <CardTitle>Configuração</CardTitle>
                    <CardDescription>Dados da instância Evolution API usada pelo AppBarber</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-indigo-500/10 bg-indigo-500/5 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Instância</p>
                    <p className="mt-1 font-medium">{instanceName || 'Não informada'}</p>
                  </div>
                  <div className="rounded-xl border border-indigo-500/10 bg-indigo-500/5 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Servidor</p>
                    <p className="mt-1 truncate font-medium">{serverUrl || 'Não informado'}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">URL do Servidor</label>
                  <Input
                    placeholder="https://seu-servidor.com:8080"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    className="border-indigo-500/20 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome da Instância</label>
                  <Input
                    placeholder="minha-barbearia"
                    value={instanceName}
                    onChange={(e) => setInstanceName(e.target.value)}
                    className="border-indigo-500/20 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">API Key</label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="border-indigo-500/20 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Intervalo de Re-engajamento (Dias)</label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="22"
                    value={reengageIntervalDays}
                    onChange={(e) => setReengageIntervalDays(e.target.value)}
                    className="border-indigo-500/20 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-muted-foreground">
                    Número de dias sem visitas para disparar a notificação de re-engajamento.
                  </p>
                </div>
                <Button onClick={save} className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md hover:from-indigo-500 hover:to-blue-500" disabled={saving}>
                  {saving ? 'Salvando...' : <><Save className="mr-2 size-4" /> Salvar configuração</>}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-indigo-500/10">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <Wifi className="size-4" />
                  </div>
                  <div>
                    <CardTitle>Teste de conexão</CardTitle>
                    <CardDescription>Valide a integração com uma mensagem real</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-dashed border-indigo-500/15 bg-indigo-500/5 p-4 text-sm text-muted-foreground">
                  Esse teste confirma se o servidor, a instância e a API Key estão alinhados para disparos automáticos.
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Número de teste</label>
                  <Input
                    placeholder="5511999999999"
                    value={testNumber}
                    onChange={(e) => setTestNumber(e.target.value)}
                    className="border-indigo-500/20 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-muted-foreground">
                    Código do país + DDD + número. Ex: 5511999999999
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={testConnection}
                  disabled={testing || !testNumber}
                  className="w-full"
                >
                  {testing ? (
                    <><Loader2 className="mr-2 size-4 animate-spin" /> Enviando...</>
                  ) : (
                    'Enviar mensagem de teste'
                  )}
                </Button>

                {testStatus === 'success' && (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
                    <Check className="size-4" /> Mensagem enviada. Verifique seu WhatsApp.
                  </div>
                )}
                {testStatus === 'error' && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-destructive">
                    <X className="size-4" /> Falha na conexão. Verifique os dados.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-indigo-500/10">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <Globe className="size-4" />
                  </div>
                  <div>
                    <CardTitle>Site Público</CardTitle>
                    <CardDescription>Personalize o site público da sua barbearia</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Instagram</label>
                  <Input
                    placeholder="@studio_lima"
                    value={siteInstagram}
                    onChange={(e) => setSiteInstagram(e.target.value)}
                    className="border-indigo-500/20 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Foto Principal (Hero)</label>
                  {siteHeroPhoto ? (
                    <div className="relative mb-2 overflow-hidden rounded-xl border border-white/10">
                      <img src={siteHeroPhoto} alt="Hero" className="h-32 w-full object-cover" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-2 bg-black/50 text-white hover:bg-black/70"
                        onClick={async () => {
                          if (siteHeroPhoto.startsWith(supabase.storage.from('gallery').getPublicUrl('').data?.publicUrl ?? '')) {
                            await deletePhoto(siteHeroPhoto)
                          }
                          setSiteHeroPhoto('')
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="mb-2 flex h-24 items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] text-sm text-white/40">
                      Nenhuma foto
                    </div>
                  )}
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm text-white/60 hover:bg-white/[0.06] transition">
                    <Upload className="size-4" />
                    {siteHeroPhoto ? 'Trocar foto' : 'Fazer upload'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file || !targetShopId) return
                        await ensureGalleryBucket()
                        const url = await uploadHeroPhoto(targetShopId, file)
                        if (url) {
                          setSiteHeroPhoto(url)
                          toast.success('Hero atualizado!')
                        } else {
                          toast.error('Erro ao fazer upload. Verifique bucket e permissões no Supabase.')
                        }
                      }}
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Fotos da Galeria</label>
                    <label className="flex cursor-pointer items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 transition">
                      <Plus className="size-3.5" /> Adicionar
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        multiple
                        onChange={async (e) => {
                          const files = Array.from(e.target.files ?? [])
                          if (!files.length || !targetShopId) return
                          await ensureGalleryBucket()
                          const urls: string[] = []
                          for (const file of files) {
                            const url = await uploadGalleryPhoto(targetShopId, file)
                            if (url) urls.push(url)
                          }
                          if (urls.length) {
                            setSiteGalleryPhotos([...siteGalleryPhotos, ...urls])
                            toast.success(`${urls.length} foto(s) adicionada(s)!`)
                          } else {
                            toast.error('Erro ao fazer upload. Verifique bucket e permissões no Supabase.')
                          }
                        }}
                      />
                    </label>
                  </div>
                  {siteGalleryPhotos.length === 0 ? (
                    <p className="text-sm text-white/40">Nenhuma foto adicionada.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {siteGalleryPhotos.map((url, idx) => (
                        <div key={idx} className="group relative overflow-hidden rounded-xl border border-white/10">
                          <img src={url} alt={`Foto ${idx + 1}`} className="aspect-square w-full object-cover" />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1 size-7 bg-black/50 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/70"
                            onClick={async () => {
                              if (url.startsWith(supabase.storage.from('gallery').getPublicUrl('').data?.publicUrl ?? '')) {
                                await deletePhoto(url)
                              }
                              setSiteGalleryPhotos(siteGalleryPhotos.filter((_, i) => i !== idx))
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Horários de Funcionamento</label>
                  <div className="space-y-2">
                    {DAY_CONFIG.map(({ key, label }) => {
                      const wh = siteWorkingHours[key] ?? { start: '', end: '' }
                      return (
                        <div key={key} className="grid grid-cols-[100px_1fr_1fr] items-center gap-2">
                          <span className="text-sm text-muted-foreground">{label}</span>
                          <Input
                            type="time"
                            value={wh.start}
                            onChange={(e) => setSiteWorkingHours({ ...siteWorkingHours, [key]: { ...wh, start: e.target.value } })}
                            className="border-indigo-500/20 focus:ring-indigo-500"
                          />
                          <Input
                            type="time"
                            value={wh.end}
                            onChange={(e) => setSiteWorkingHours({ ...siteWorkingHours, [key]: { ...wh, end: e.target.value } })}
                            className="border-indigo-500/20 focus:ring-indigo-500"
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={saveSiteSettings}
                    className="flex-1 bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md hover:from-indigo-500 hover:to-blue-500"
                    disabled={savingSite || !targetShopId}
                  >
                    {savingSite ? (
                      <><Loader2 className="mr-2 size-4 animate-spin" /> Salvando...</>
                    ) : (
                      <><Save className="mr-2 size-4" /> Salvar configurações do site</>
                    )}
                  </Button>
                  {sitePublicSlug ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const url = buildPublicSiteUrl(sitePublicSlug)
                        navigator.clipboard.writeText(url)
                        setCopiedLink(true)
                        toast.success('Link copiado!')
                        setTimeout(() => setCopiedLink(false), 3000)
                      }}
                      className="flex-1"
                    >
                      {copiedLink ? (
                        <><Check className="mr-2 size-4" /> Copiado!</>
                      ) : (
                        <><Copy className="mr-2 size-4" /> Copiar link do site</>
                      )}
                    </Button>
                  ) : null}
                </div>

                  {sitePublicSlug ? (
                  <div className="rounded-xl border border-indigo-500/10 bg-indigo-500/5 p-3 text-sm text-muted-foreground">
                    <p>Link público: <span className="font-mono text-indigo-300">{buildPublicSiteUrl(sitePublicSlug)}</span></p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PageTransition>
  )
}

export default WhatsAppSettings
