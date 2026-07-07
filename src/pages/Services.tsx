import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ListSkeleton } from '@/components/Skeleton'
import PageTransition from '@/components/PageTransition'
import { Plus, Pencil, Trash2, Scissors } from 'lucide-react'
import { toast } from 'sonner'
import type { Service } from '@/types/database'

function Services() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [duration, setDuration] = useState('30')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('services').select('*').order('name')
    if (data) setServices(data as Service[])
    setLoading(false)
  }

  function reset() {
    setName('')
    setPrice('')
    setDuration('30')
    setEditing(null)
  }

  async function save() {
    if (!name.trim() || !price) return
    const payload = {
      name: name.trim(),
      price: parseFloat(price),
      duration_minutes: parseInt(duration),
      shop_id: '00000000-0000-0000-0000-000000000000',
    }
    if (editing) {
      await supabase.from('services').update(payload).eq('id', editing.id)
      toast.success('Serviço atualizado')
    } else {
      await supabase.from('services').insert(payload)
      toast.success('Serviço cadastrado')
    }
    reset()
    setOpen(false)
    load()
  }

  async function remove(id: string) {
    await supabase.from('services').delete().eq('id', id)
    toast.success('Serviço removido')
    load()
  }

  function edit(service: Service) {
    setEditing(service)
    setName(service.name)
    setPrice(String(service.price))
    setDuration(String(service.duration_minutes))
    setOpen(true)
  }

  return (
    <PageTransition>
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Serviços</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
          <DialogTrigger><Button><Plus className="mr-2 size-4" /> Novo Serviço</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Serviço' : 'Novo Serviço'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Nome do serviço" value={name} onChange={(e) => setName(e.target.value)} />
              <Input placeholder="Preço (R$)" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
              <Input placeholder="Duração (min)" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
              <Button onClick={save} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <ListSkeleton count={4} />
      ) : services.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Scissors className="mb-4 size-12" />
          <p className="mb-1 font-medium">Nenhum serviço ainda</p>
          <p className="text-sm">Clique em "Novo Serviço" para começar</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service, i) => (
            <Card key={service.id} className="animate-fade-in transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg" style={{ animationDelay: `${i * 60}ms` }}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{service.name}</p>
                  <p className="text-sm text-muted-foreground">
                    <span>R$ {Number(service.price).toFixed(2)}</span>
                    <span className="mx-2">·</span>
                    <span>{service.duration_minutes} min</span>
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => edit(service)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(service.id)}>
                    <Trash2 className="size-4" />
                  </Button>
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

export default Services
