"use client";
import Link from "next/link";
import Navigation from "./components/Navigation";
import HeroSection from "./components/HeroSection";
import FlowAnimation from "./components/FlowAnimation";
import ModelsShowcase from "./components/ModelsShowcase";
import HowItWorks from "./components/HowItWorks";
import Features from "./components/Features";
import Footer from "./components/Footer";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f8fbff] font-sans text-zinc-950 antialiased selection:bg-blue-600/20 selection:text-blue-950">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[760px] bg-[radial-gradient(circle_at_50%_-12%,rgba(37,99,235,0.22),rgba(219,234,254,0.55)_30%,rgba(248,251,255,0)_70%)]" />
        <div
          className="absolute inset-0 opacity-[0.32]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(37, 99, 235, 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(37, 99, 235, 0.08) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        <div className="absolute left-1/2 top-40 h-[460px] w-[920px] -translate-x-1/2 rounded-full bg-white/70 blur-3xl" />
      </div>

      <div className="relative z-10">
        <Navigation />

        <main>
          <HeroSection />
          <FlowAnimation />
          <ModelsShowcase />
          <HowItWorks />
          <Features />

          <section className="px-6 py-24 sm:py-32">
            <div className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-blue-200/80 bg-zinc-950 p-8 text-center text-white shadow-2xl shadow-blue-950/20 sm:p-12">
              <p className="text-sm font-semibold text-blue-200">Smarter, safer, cost-efficient.</p>
              <h2 className="mx-auto mt-4 max-w-3xl text-balance text-4xl font-black tracking-[-0.035em] md:text-6xl">
                One endpoint for routing, observability, guardrails, and governance.
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-zinc-300 md:text-lg">
                Route each request to the right model, fail over before users notice, and keep cost visible without changing the SDKs your team already uses.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/login?mode=register"
                  className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-white px-7 text-sm font-bold text-zinc-950 shadow-lg shadow-white/10 transition hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-300/50 sm:w-auto"
                >
                  Get your API key →
                </Link>
                <a
                  href="#models"
                  className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-white/15 bg-white/5 px-7 text-sm font-bold text-white transition hover:bg-white/10 focus:outline-none focus:ring-4 focus:ring-blue-300/40 sm:w-auto"
                >
                  Browse models
                </a>
              </div>
            </div>
          </section>
        </main>

        <Footer />
      </div>

      <style jsx global>{`
        @keyframes landing-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .landing-marquee-track {
          animation: landing-marquee 34s linear infinite;
        }
        .landing-marquee:hover .landing-marquee-track {
          animation-play-state: paused;
        }
        @keyframes landing-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .landing-float {
          animation: landing-float 7s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .landing-marquee-track,
          .landing-float,
          .animate-pulse {
            animation: none !important;
          }
          * {
            scroll-behavior: auto !important;
          }
        }
      `}</style>
    </div>
  );
}
