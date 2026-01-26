import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen font-sans bg-white text-black dark:bg-black dark:text-white">
      {/* Sticky Glass Navigation */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-8 py-4 shadow-md bg-white/90 dark:bg-black/90">
        <div className="flex items-center">
          <Image src="/logo.png" alt="Nivesify Logo" width={120} height={64} priority />
        </div>
        <nav className="flex items-center gap-8">
          <a href="#" className="hover:text-[#0f766e] font-medium transition">Dashboard</a>
          <a href="#" className="hover:text-[#0f766e] font-medium transition">Goals</a>
          <a href="#" className="hover:text-[#0f766e] font-medium transition">Insights</a>
          <a href="#" className="hover:text-[#0f766e] font-medium transition">Settings</a>
          <button className="rounded-full bg-[#0f766e] px-5 py-2 text-white font-semibold transition hover:bg-[#115e59] ml-2">Sign Up</button>
        </nav>
      </header>

      <main className="flex flex-col items-center justify-center px-4 py-16 w-full">
        {/* Hero Section */}
        <section className="mb-20 text-center flex flex-col items-center">
          <h1 className="text-6xl md:text-7xl font-serif italic font-normal mb-2" style={{ fontFamily: 'var(--font-instrument-serif), serif' }}>
            Thoughtful Money.<br />
            <span className="font-sans font-bold not-italic" style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>Better Life.</span>
          </h1>
          <div className="mt-6 max-w-2xl text-lg md:text-xl">
            A calm, engineering-first wealth platform for Indian investors<br />
            who believe understanding beats prediction.
          </div>
        </section>

        {/* The Big Idea Section */}
        {/* Removed duplicate 'Why mutual fund investing works — quietly.' section */}

        {/* Core Platform Offerings (The Lab) */}
        <section className="mb-20 w-full flex flex-col items-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: '#0f766e' }}>
            The Lab — where theory meets reality.
          </h2>
          <div className="mb-6 max-w-2xl text-center">
            Use these tools to understand <b>your</b> numbers, not generic examples.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl items-stretch">
            {/* Tool 1: Portfolio Reality Check */}
            <div className="rounded-2xl p-6 flex flex-col items-center text-center h-full justify-between bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <Image src="/tool-cas.png" alt="Portfolio Reality Check" width={80} height={80} className="mb-4" />
              <h4 className="text-lg font-bold mb-2 text-zinc-900 dark:text-white" style={{ color: '#0f766e' }}>Portfolio Reality Check</h4>
              <p className="mb-2 text-zinc-900 dark:text-zinc-200">Upload your CAMS/KFintech statement. See overlaps, concentration, style drift. Free basic clarity. ₹49 for advanced diagnostics.</p>
              <div className="text-xs mb-2 text-zinc-700 dark:text-zinc-300">This tool doesn’t tell you what to buy. It tells you what you already own — clearly.</div>
              <div className="flex-1" />
              <a href="#" className="mt-6 w-full rounded-full bg-[#0f766e] px-4 py-2 text-white font-semibold shadow hover:bg-[#115e59] transition">Try Now</a>
            </div>
            {/* Tool 2: Mutual Fund Screener */}
            <div className="rounded-2xl p-6 flex flex-col items-center text-center h-full justify-between bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <Image src="/tool-screener.png" alt="Mutual Fund Screener" width={80} height={80} className="mb-4" />
              <h4 className="text-lg font-bold mb-2 text-zinc-900 dark:text-white" style={{ color: '#0f766e' }}>Mutual Fund Screener</h4>
              <p className="mb-2 text-zinc-900 dark:text-zinc-200">Expose fund behavior, not rankings. Focus on consistency, cost, drawdowns, and mandate discipline. ₹9/day unlock for full metrics.</p>
              <div className="text-xs mb-2 text-zinc-700 dark:text-zinc-300">A screener for thinking investors, not chasers.</div>
              <div className="flex-1" />
              <a href="#" className="mt-6 w-full rounded-full bg-[#0f766e] px-4 py-2 text-white font-semibold shadow hover:bg-[#115e59] transition">Try Now</a>
            </div>
            {/* Tool 3: Financial Planning Calculators */}
            <div className="rounded-2xl p-6 flex flex-col items-center text-center h-full justify-between bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <Image src="/tool-calc.png" alt="Financial Planning Calculators" width={80} height={80} className="mb-4" />
              <h4 className="text-lg font-bold mb-2 text-zinc-900 dark:text-white" style={{ color: '#0f766e' }}>Financial Planning Calculators</h4>
              <p className="mb-2 text-zinc-900 dark:text-zinc-200">Retirement, goals, SIP, SWP, stress testing. Designed for realism, not optimism. Most tools free, advanced layers ₹9/day.</p>
              <div className="text-xs mb-2 text-zinc-700 dark:text-zinc-300">Planning is not prediction. It’s preparation.</div>
              <div className="flex-1" />
              <a href="#" className="mt-6 w-full rounded-full bg-[#0f766e] px-4 py-2 text-white font-semibold shadow hover:bg-[#115e59] transition">Try Now</a>
            </div>
          </div>
        </section>

        {/* Passive Investing Pillar (Condensed) */}
        <section className="mb-20 w-full flex flex-col items-center">
          <div className="rounded-2xl p-8 flex flex-col items-center text-center max-w-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-2xl md:text-3xl font-bold mb-2 text-zinc-900 dark:text-white" style={{ color: '#0f766e' }}>
              Passive investing, explained without shortcuts.
            </h2>
            <div className="mb-2 text-zinc-900 dark:text-white">
              Not just “cheap funds.” It’s about tracking the market, not beating it, and letting time do the heavy lifting. Learn how indices like Nifty, Sensex, and factor indices work for Indian investors.
            </div>
            <div className="mb-2 text-zinc-900 dark:text-white">
              Nivesify maintains a growing, data-driven deep dive into Indian passive funds — risks included, hype excluded.
            </div>
            <a href="#" className="mt-2 inline-block rounded-full bg-[#0f766e] px-6 py-3 text-white font-semibold shadow hover:bg-[#115e59] transition">Explore Passive Investing</a>
          </div>
        </section>
        {/* Removed 'Why mutual fund investing works' section */}

        {/* How Nivesify Helps You Section */}
        <section className="mb-20 w-full flex flex-col items-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-zinc-900 dark:text-white" style={{ color: '#0f766e' }}>
            How Nivesify Helps You
          </h2>
          <div className="flex flex-col md:flex-row gap-8 w-full max-w-5xl justify-center items-stretch">
            {/* Card 1 */}
            <div className="flex flex-col items-center text-center max-w-xs w-full h-full rounded-2xl p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-center w-28 h-28 mb-4 bg-zinc-100 rounded-xl overflow-hidden">
                <img src="/investment.png" alt="Investment Opportunities" width={96} height={96} className="object-contain" onError="this.style.display='none'" />
              </div>
              <div className="text-zinc-900 dark:text-white">See your portfolio clearly, spot overlaps, and understand your real exposure.</div>
            </div>
            {/* Card 2 */}
            <div className="flex flex-col items-center text-center max-w-xs w-full h-full rounded-2xl p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-center w-28 h-28 mb-4 bg-zinc-100 rounded-xl overflow-hidden">
                <img src="/goal.png" alt="Set & Monitor Goals" width={96} height={96} className="object-contain" onError="this.style.display='none'" />
              </div>
              <div className="text-zinc-900 dark:text-white">Define your financial goals and track your progress with realistic, data-driven tools.</div>
            </div>
            {/* Card 3 */}
            <div className="flex flex-col items-center text-center max-w-xs w-full h-full rounded-2xl p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-center w-28 h-28 mb-4 bg-zinc-100 rounded-xl overflow-hidden">
                <img src="/insights.png" alt="Get Insights" width={96} height={96} className="object-contain" onError="this.style.display='none'" />
              </div>
              <div className="text-zinc-900 dark:text-white">Receive clear, unbiased insights to make smarter, calmer investment decisions.</div>
            </div>
          </div>
          {/* Premium Footer */}
          <footer className="w-full border-t border-zinc-200 dark:border-zinc-800 py-12 mt-20 bg-white dark:bg-black text-black dark:text-white">
            <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center md:items-start gap-10">
              <div className="flex flex-col items-center md:items-start gap-3">
                <Image src="/logo.png" alt="Nivesify Logo" width={120} height={64} className="mb-2" />
                <div className="text-sm max-w-xs text-center md:text-left">Thoughtful Money. Better Life.<br/>A calm, engineering-first wealth platform for Indian investors.</div>
              </div>
              <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
                <div className="flex flex-col gap-2">
                  <span className="font-semibold mb-1">Explore</span>
                  <a href="#" className="hover:text-[#0f766e] transition">Philosophy</a>
                  <a href="#" className="hover:text-[#0f766e] transition">The Lab</a>
                  <a href="#" className="hover:text-[#0f766e] transition">Passive Investing</a>
                  <a href="#" className="hover:text-[#0f766e] transition">Command Center</a>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="font-semibold mb-1">Resources</span>
                  <a href="#" className="hover:text-[#0f766e] transition">Blog</a>
                  <a href="#" className="hover:text-[#0f766e] transition">FAQ</a>
                  <a href="#" className="hover:text-[#0f766e] transition">Pricing</a>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="font-semibold mb-1">Contact</span>
                  <a href="mailto:hello@nivesify.com" className="hover:text-[#0f766e] transition">hello@nivesify.com</a>
                  <a href="#" className="hover:text-[#0f766e] transition">Twitter</a>
                  <a href="#" className="hover:text-[#0f766e] transition">LinkedIn</a>
                </div>
              </div>
            </div>
            <div className="mt-10 text-center text-xs">© {new Date().getFullYear()} Nivesify. All rights reserved.</div>
          </footer>
        </section>
      </main>
    </div>
  );
}
