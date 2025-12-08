import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import NotesClient from '@/components/notes/NotesClient'

export default async function NotesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/')

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Field Notes</h1>
          <p className="text-slate-600 mb-6">Browse, search, and edit notes.</p>
          <NotesClient /> {/* client-side list + modal */}
        </div>
      </main>
    </div>
  )
}
