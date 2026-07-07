import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import PageTransition from '@/components/PageTransition'
import { MessageSquare, Check, X, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import type { WhatsAppConfig } from '@/types/database'

function WhatsAppSettings() {
  const [config, setConfig] = useState<WhatsAppConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testNumber, setTestNumber] = useState('')
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const [serverUrl, setServerUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [instanceName, setInstanceName] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('whatsapp_configs')
      .select('*')
      .eq('active', true)
      .maybeSingle()

    if (data) {
      const c = data as WhatsAppConfig
      setConfig(c)
      setServerUrl(c.server_url)
      setApiKey(c.api_key)
      setInstanceName(c.instance_name)
    }
    setLoading(false)
  }

  async function save() {
    if (!serverUrl || !apiKey || !instanceName) return
    setSaving(true)

    const payload = {
      shop_id: '00000000-0000-0000-0000-000000000000',
      server_url: serverUrl.replace(/\/$/, ''),
      instance_name: instanceName,
      api_key: apiKey,
      webhook_secret: '',
      active: true,
    }

    if (config) {
      await supabase.from('whatsapp_configs').update(payload).eq('id', config.id)
    } else {
      await supabase.from('whatsapp_configs').insert(payload)
    }

    await load()
    setSaving(false)
    toast.success('Configuração salva!')
  }

  async function testConnection() {
    if (!serverUrl || !apiKey || !instanceName || !testNumber) return
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
        }
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

  return (
    <PageTransition>
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex items-center gap-3">
        <MessageSquare className="size-6" />
        <h1 className="text-2xl font-bold">WhatsApp</h1>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Configuração da Evolution API</CardTitle>
              <CardDescription>
                Insira os dados da sua instância Evolution API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">URL do Servidor</label>
                <Input
                  placeholder="https://seu-servidor.com:8080"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome da Instância</label>
                <Input
                  placeholder="minha-barbearia"
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">API Key</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
              <Button onClick={save} className="w-full" disabled={saving}>
                {saving ? 'Salvando...' : <><Save className="mr-2 size-4" /> Salvar Configuração</>}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Testar Conexão</CardTitle>
              <CardDescription>
                Envie uma mensagem de teste para seu WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Número de Teste</label>
                <Input
                  placeholder="5511999999999"
                  value={testNumber}
                  onChange={(e) => setTestNumber(e.target.value)}
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
                  'Enviar Mensagem de Teste'
                )}
              </Button>

              {testStatus === 'success' && (
                <div className="flex items-center gap-2 text-sm text-green-500">
                  <Check className="size-4" /> Mensagem enviada! Verifique seu WhatsApp.
                </div>
              )}
              {testStatus === 'error' && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <X className="size-4" /> Falha na conexão. Verifique os dados.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
    </PageTransition>
  )
}

export default WhatsAppSettings
