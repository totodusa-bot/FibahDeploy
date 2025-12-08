// SERVER COMPONENT
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import MapInterfaceClient from "../../../components/map/MapInterfaceClient";


export default async function MapPage() {
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/')


return (
<div className="flex flex-col md:flex-row min-h-screen bg-slate-50">
<Sidebar />
<main className="flex-1 w-full p-4 sm:p-6">
<div className="mx-auto max-w-[1400px]">
<div className="mb-4">
<h1 className="text-2xl font-bold text-slate-900">Map Interface</h1>
<p className="text-slate-600">Place markers and create field notes</p>
</div>
{/* Client-side map + forms */}
<div className="h-[60vh] sm:h-[calc(100vh-180px)]">
<MapInterfaceClient />
</div>
</div>
</main>
</div>
)
}