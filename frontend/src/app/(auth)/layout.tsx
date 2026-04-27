export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative min-h-screen bg-bg-primary flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Subtle Purple Glow */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none" 
        style={{ background: 'radial-gradient(ellipse at top, rgba(124,92,252,0.08) 0%, transparent 60%)' }} 
      />
      
      {/* Centered Logo */}
      <div className="relative z-10 mb-8 flex items-center justify-center gap-2">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="6" fill="url(#paint0_linear_auth)"/>
          <path d="M6 8L8.5 16L12 10.5L15.5 16L18 8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          <defs>
            <linearGradient id="paint0_linear_auth" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
              <stop stopColor="#7C5CFC"/>
              <stop offset="1" stopColor="#9F7FFD"/>
            </linearGradient>
          </defs>
        </svg>
        <span className="font-semibold text-xl font-sans text-text-primary tracking-tight">Wraft</span>
      </div>

      {/* Auth Box Wrapper */}
      <div className="relative z-10 w-full max-w-sm bg-bg-secondary border border-border-default rounded-xl p-8 shadow-elevated">
        {children}
      </div>
    </div>
  )
}
