import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 animate-in fade-in duration-300 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48 mb-2 bg-[#0f1413]/30" />
          <Skeleton className="h-4 w-64 bg-[#0f1413]/20" />
        </div>
        <Skeleton className="h-10 w-32 bg-[#0f1413]/30 rounded-md" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="border border-white/5 rounded-xl p-6 bg-[#0f1413]/20">
            <div className="flex justify-between items-center mb-4">
              <Skeleton className="h-6 w-3/4 bg-[#0f1413]/30" />
              <Skeleton className="h-2 w-2 rounded-full bg-[#0f1413]/20" />
            </div>
            <Skeleton className="h-4 w-1/2 mb-6 bg-[#0f1413]/30" />
            <Skeleton className="h-4 w-1/4 bg-[#0f1413]/20" />
          </div>
        ))}
      </div>
    </div>
  )
}
