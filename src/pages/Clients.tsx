import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ListSkeleton } from '@/components/Skeleton'
import PageTransition from '@/components/PageTransition'
import { Plus, Pencil, Trash2, Phone, User } from 'lucide-react'
import { toast } from 'sonner'
import type { Client } from '@/types/database'

function Clients() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('clients').select('*').order('name')
    if (data) setClients(data as Client[])
    setLoading(false)
  }

  function reset() {
    setName('')
    setPhone('')
    setEmail('')
    setNotes('')
    setEditing(null)
  }

  async function save() {
    if (!name.trim() || !phone.trim()) return
    const payload = { name: name.trim(), phone: phone.replace(/\D/g, ''), email: email.trim() || null, notes: notes.trim() || null }
    if (editing) {
      await supabase.from('clients').update(payload).eq('id', editing.id)
      toast.success('Cliente atualizado')
    } else {
      await supabase.from('clients').insert(payload)
      toast.success('Cliente cadastrado')
    }
    reset()
    setOpen(false)
    load()
  }

  async function remove(id: string) {
    await supabase.from('clients').delete().eq('id', id)
    toast.success('Cliente removido')
    load()
  }

  function edit(client: Client) {
    setEditing(client)
    setName(client.name)
    setPhone(client.phone)
    setEmail(client.email ?? '')
    setNotes(client.notes ?? '')
    setOpen(true)
  }

  return (
    <PageTransition>
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
          <DialogTrigger><Button><Plus className="mr-2 size-4" /> Novo Cliente</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
              <Input placeholder="WhatsApp" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <Input placeholder="Email (opcional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input placeholder="Observações (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <Button onClick={save} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <ListSkeleton count={5} />
      ) : clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <User className="mb-4 size-12" />
          <p className="mb-1 font-medium">Nenhum cliente ainda</p>
          <p className="text-sm">Clientes são cadastrados automaticamente nos agendamentos</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client, i) => (
            <Card key={client.id} className="animate-fade-in transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg" style={{ animationDelay: `${i * 50}ms` }}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="font-medium">{client.name}</p>
                    <p className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Phone className="size-3" /> {client.phone}
                    </p>
                    {client.email && <p className="text-xs text-muted-foreground">{client.email}</p>}
                    {client.notes && <p className="text-xs text-muted-foreground italic">{client.notes}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => edit(client)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(client.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
    </PageTransition>
  )
}

export default Clients
