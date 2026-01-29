"use client";
import Image from "next/image";
import { useState } from "react";

export default function ScreenerPage() {
  // Carousel state
  const explainerImages = [
    { src: "/mf-explainer-1.png", alt: "What is a Mutual Fund?" },
    { src: "/mf-explainer-2.png", alt: "How Mutual Funds Work" },
    { src: "/mf-explainer-3.png", alt: "Benefits of Mutual Funds" },
  ];
  const [current, setCurrent] = useState(0);
  const goTo = (idx: number) => setCurrent(idx);
  return (
    <div className="min-h-screen font-sans bg-white text-black dark:bg-black dark:text-white">
      <main className="flex flex-col items-center justify-center px-4 py-16 w-full">
        {/* Mutual Fund Basics Section */}
        <section className="mb-12 w-full flex flex-col items-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Mutual Fund Basics</h1>
          <p className="max-w-2xl text-center text-lg mb-6">A mutual fund pools money from many investors to invest in a diversified basket of stocks, bonds, or other assets. It’s managed by professionals and lets you invest in markets easily, even with small amounts.</p>
        </section>

        {/* Explainer Image Carousel */}
        <section className="mb-12 w-full flex flex-col items-center">
          <div className="relative w-full max-w-2xl flex flex-col items-center">
            <div className="w-full h-64 flex items-center justify-center bg-zinc-100 rounded-2xl overflow-hidden mb-4">
              <Image src={explainerImages[current].src} alt={explainerImages[current].alt} width={480} height={256} className="object-contain max-h-64" />
            </div>
            <div className="flex gap-2 mt-2">
              {explainerImages.map((img, idx) => (
                <button
                  key={img.src}
                  className={`w-3 h-3 rounded-full border-2 ${current === idx ? 'bg-[#0f766e] border-[#0f766e]' : 'bg-white border-zinc-400'} transition`}
                  aria-label={`Show slide ${idx + 1}`}
                  onClick={() => goTo(idx)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Passive & Active Cards */}
        <section className="mb-20 w-full flex flex-col md:flex-row gap-8 items-center justify-center">
          {/* Passive Card */}
          <div className="flex flex-col items-center text-center max-w-md w-full rounded-2xl p-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow">
            <Image src="/passive.png" alt="Passive Investing" width={120} height={120} className="mb-4" />
            <h2 className="text-2xl font-bold mb-2" style={{ color: '#0f766e' }}>Passive Investing</h2>
            <p className="mb-4">Invest in index funds and ETFs that track the market. Simple, low-cost, and effective for most investors.</p>
            <a href="/passive" className="rounded-full bg-[#0f766e] px-6 py-3 text-white font-semibold shadow hover:bg-[#115e59] transition">Explore Passive</a>
          </div>
          {/* Active Card */}
          <div className="flex flex-col items-center text-center max-w-md w-full rounded-2xl p-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow">
            <Image src="/active.png" alt="Active Investing" width={120} height={120} className="mb-4" />
            <h2 className="text-2xl font-bold mb-2" style={{ color: '#0f766e' }}>Active Investing</h2>
            <p className="mb-4">Choose funds managed by experts aiming to outperform the market. More research, more potential reward—and risk.</p>
            <a href="/active" className="rounded-full bg-[#0f766e] px-6 py-3 text-white font-semibold shadow hover:bg-[#115e59] transition">Explore Active</a>
          </div>
        </section>
      </main>
    </div>
  );
}
