import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { DashboardHeader } from "@/components/layout/DashboardHeader"

function PremiumBackground() {
  return (
    <div className="fixed inset-0 -z-10 bg-[#0b0f0e] overflow-hidden pointer-events-none">
      <div className="bg-noise" />
      <div className="absolute top-[20%] left-[-10%] w-[40%] h-[50%] rounded-full bg-emerald-500/5 blur-[150px]" />
      <div className="absolute bottom-[0%] right-[-10%] w-[50%] h-[50%] rounded-full bg-green-500/10 blur-[150px]" />
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <PremiumBackground />
      {/* Absolute floating Sidebar */}
      <AppSidebar />
      <SidebarInset className="bg-transparent flex flex-col items-center">
        {/* Floating Topbar */}
        <div className="w-full max-w-5xl mt-6 px-4 z-50 sticky top-6">
          <DashboardHeader />
        </div>
        <main className="flex-1 w-full max-w-5xl px-4 py-8 relative">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
