import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'

export default async function NotesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            Coming Soon
          </h1>
          <p className="text-slate-600 mb-8">Coming Soon</p>

          <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
            <div className="text-slate-400 mb-4">
              <svg
                className="w-16 h-16 mx-auto"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Coming Soon
            </h3>
            <p className="text-slate-600">
              We’re building this page right now. Check back soon.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
