"use client";
import Navigation from "./components/Navigation";
import HeroSection from "./components/HeroSection";
import FlowAnimation from "./components/FlowAnimation";
import Footer from "./components/Footer";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-white font-sans text-zinc-950 antialiased selection:bg-zinc-950/10 selection:text-zinc-950">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[900px] overflow-hidden">
        <div className="landing-grid absolute inset-0" />
      </div>

      <div className="relative z-10">
        <Navigation />

        <main>
          <HeroSection />
          <FlowAnimation />
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
        @media (prefers-reduced-motion: reduce) {
          .landing-marquee-track {
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
