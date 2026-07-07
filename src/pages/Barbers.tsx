import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ListSkeleton } from '@/components/Skeleton'
import PageTransition from '@/components/PageTransition'
import { Plus, Pencil, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import type { Barber } from '@/types/database'

function Barbers() {
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Barber | null>(null)
  const [name, setName] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('barbers').select('*').order('name')
    if (data) setBarbers(data as Barber[])
    setLoading(false)
  }

  async function save() {
    if (!name.trim()) return
    if (editing) {
      await supabase.from('barbers').update({ name: name.trim() }).eq('id', editing.id)
      toast.success('Barbeiro atualizado')
    } else {
      await supabase.from('barbers').insert({ name: name.trim(), shop_id: '00000000-0000-0000-0000-000000000000' })
      toast.success('Barbeiro cadastrado')
    }
    setName('')
    setEditing(null)
    setOpen(false)
    load()
  }

  async function remove(id: string) {
    await supabase.from('barbers').delete().eq('id', id)
    toast.success('Barbeiro removido')
    load()
  }

  function edit(barber: Barber) {
    setEditing(barber)
    setName(barber.name)
    setOpen(true)
  }

  return (
    <PageTransition>
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Barbeiros</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setName('') } }}>
          <DialogTrigger><Button><Plus className="mr-2 size-4" /> Novo Barbeiro</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Barbeiro' : 'Novo Barbeiro'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Nome do barbeiro" value={name} onChange={(e) => setName(e.target.value)} />
              <Button onClick={save} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <ListSkeleton count={4} />
      ) : barbers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Users className="mb-4 size-12" />
          <p className="mb-1 font-medium">Nenhum barbeiro ainda</p>
          <p className="text-sm">Clique em "Novo Barbeiro" para começar</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {barbers.map((barber, i) => (
            <Card key={barber.id} className="animate-fade-in transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg" style={{ animationDelay: `${i * 60}ms` }}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{barber.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {barber.active ? 'Ativo' : 'Inativo'}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => edit(barber)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(barber.id)}>
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

export default Barbers
