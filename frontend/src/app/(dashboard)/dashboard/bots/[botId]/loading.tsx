import { Skeleton } from "@/components/ui/skeleton"

export default function BotLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 animate-in fade-in duration-300 pb-10">
      <div>
        <Skeleton className="h-8 w-64 mb-2 bg-[#0f1413]/30" />
        <Skeleton className="h-4 w-96 bg-[#0f1413]/20" />
      </div>

      <div className="space-y-6">
        <Skeleton className="h-[250px] w-full rounded-xl bg-[#0f1413]/30" />
        <Skeleton className="h-[300px] w-full rounded-xl bg-[#0f1413]/30" />
        <div className="grid md:grid-cols-2 gap-8">
           <Skeleton className="h-[250px] w-full rounded-xl bg-[#0f1413]/30" />
           <Skeleton className="h-[250px] w-full rounded-xl bg-[#0f1413]/30" />
        </div>
      </div>
    </div>
  )
}
