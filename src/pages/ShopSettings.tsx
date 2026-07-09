import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import PageTransition from '@/components/PageTransition'
import { Settings, Save, Loader2, Upload, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/providers/AuthProvider'
import { uploadLogoPhoto, deletePhoto } from '@/lib/storage'

function ShopSettings() {
  const { shop, refreshShop } = useAuth()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (shop) {
      setName(shop.name ?? '')
      setPhone(shop.phone ?? '')
      setAddress(shop.address ?? '')
      setLogoUrl(shop.logo_url ?? '')
      setLoading(false)
    }
  }, [shop])

  async function save() {
    if (!shop || !name.trim()) return
    setSaving(true)

    const { error } = await supabase
      .from('shops')
      .update({
        name: name.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        logo_url: logoUrl.trim() || null,
      })
      .eq('id', shop.id)

    if (error) {
      toast.error('Erro ao salvar configurações da barbearia')
    } else {
      toast.success('Configurações salvas com sucesso!')
      await refreshShop()
    }

    setSaving(false)
  }

  return (
    <PageTransition>
      <div className="p-4 sm:p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg shadow-indigo-500/20">
              <Settings className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Configurações</h1>
              <p className="text-sm text-muted-foreground">Informações da sua barbearia</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-8 animate-spin text-indigo-500" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-indigo-500/10">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <Settings className="size-4" />
                  </div>
                  <div>
                    <CardTitle>Dados da Barbearia</CardTitle>
                    <CardDescription>Nome, telefone e endereço visíveis no sistema</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome da Barbearia</label>
                  <Input
                    placeholder="Ex: Studio Lima"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="border-indigo-500/20 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Telefone / WhatsApp da Loja</label>
                  <Input
                    placeholder="Ex: 5511999999999"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="border-indigo-500/20 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-muted-foreground">Código do país + DDD + número. Ex: 5511999999999</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Endereço</label>
                  <Input
                    placeholder="Ex: Rua das Flores, 123 — São Paulo/SP"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="border-indigo-500/20 focus:ring-indigo-500"
                  />
                </div>
                <Button
                  onClick={save}
                  disabled={saving || !name.trim()}
                  className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md hover:from-indigo-500 hover:to-blue-500"
                >
                  {saving ? (
                    <><Loader2 className="mr-2 size-4 animate-spin" /> Salvando...</>
                  ) : (
                    <><Save className="mr-2 size-4" /> Salvar configurações</>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-indigo-500/10">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <Upload className="size-4" />
                  </div>
                  <div>
                    <CardTitle>Logo da Barbearia</CardTitle>
                    <CardDescription>Imagem exibida no painel administrativo</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {logoUrl ? (
                  <div className="relative overflow-hidden rounded-2xl border border-indigo-500/10">
                    <img
                      src={logoUrl}
                      alt="Logo"
                      className="h-40 w-full object-contain bg-card/50 p-4"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-2 bg-black/50 text-white hover:bg-black/70"
                      onClick={async () => {
                        if (logoUrl.includes('/storage/')) {
                          await deletePhoto(logoUrl)
                        }
                        setLogoUrl('')
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-indigo-500/20 bg-indigo-500/5 text-sm text-muted-foreground">
                    Nenhum logo configurado
                  </div>
                )}

                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3 text-sm text-muted-foreground hover:bg-indigo-500/10 transition">
                  <Upload className="size-4 text-indigo-500" />
                  {logoUrl ? 'Trocar logo' : 'Fazer upload do logo'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file || !shop) return
                      const url = await uploadLogoPhoto(shop.id, file)
                      if (url) {
                        setLogoUrl(url)
                        toast.success('Logo atualizado!')
                      } else {
                        toast.error('Erro ao fazer upload. Verifique o bucket "gallery" no Supabase.')
                      }
                    }}
                  />
                </label>

                <div className="rounded-xl border border-dashed border-indigo-500/10 bg-indigo-500/5 p-3 text-xs text-muted-foreground">
                  Formatos aceitos: JPG, PNG, WebP, SVG. Tamanho máximo: 5MB.
                </div>

                {logoUrl && (
                  <Button
                    onClick={save}
                    disabled={saving}
                    className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md hover:from-indigo-500 hover:to-blue-500"
                  >
                    {saving ? (
                      <><Loader2 className="mr-2 size-4 animate-spin" /> Salvando...</>
                    ) : (
                      <><Save className="mr-2 size-4" /> Salvar logo</>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>

            {shop && (
              <Card className="lg:col-span-2 border-indigo-500/10">
                <CardContent className="pt-6">
                  <div className="grid gap-4 sm:grid-cols-3">
                    {[
                      { label: 'ID da Loja', value: shop.id.slice(0, 8) + '…' },
                      { label: 'Slug Público', value: shop.public_slug ?? 'Não configurado' },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl border border-indigo-500/10 bg-indigo-500/5 p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
                        <p className="mt-1 font-mono text-sm font-medium">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </PageTransition>
  )
}

export default ShopSettings
