"use client";
import { useRouter } from "next/navigation";
import Navigation from "./components/Navigation";
import HeroSection from "./components/HeroSection";
import FlowAnimation from "./components/FlowAnimation";
import HowItWorks from "./components/HowItWorks";
import Features from "./components/Features";
import GetStarted from "./components/GetStarted";
import Footer from "./components/Footer";

export default function LandingPage() {
  const router = useRouter();
  return (
    <div className="relative overflow-x-hidden font-sans text-white antialiased selection:bg-blue-500/40 selection:text-white">
      {/* Animated Background */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-zinc-950">
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: `linear-gradient(to right, #3b82f6 1px, transparent 1px), linear-gradient(to bottom, #3b82f6 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }} />
        <div className="absolute left-1/4 top-0 h-[700px] w-[700px] animate-blob rounded-full bg-blue-500/15 blur-[130px]" />
        <div className="absolute right-1/4 top-1/3 h-[600px] w-[600px] animate-blob rounded-full bg-indigo-500/10 blur-[130px]" style={{ animationDelay: "2s", animationDuration: "22s" }} />
        <div className="absolute bottom-0 left-1/2 h-[650px] w-[650px] animate-blob rounded-full bg-sky-500/10 blur-[130px]" style={{ animationDelay: "4s", animationDuration: "25s" }} />
        <div className="absolute inset-0" style={{
          background: "radial-gradient(circle at center, transparent 0%, rgba(9, 9, 11, 0.55) 100%)",
        }} />
      </div>

      <div className="relative z-10">
        <Navigation />
        
        <main>
          {/* Hero with Flow Animation */}
          <div className="relative">
          <HeroSection />
          <div className="flex justify-center pb-20">
            <FlowAnimation />
          </div>
        </div>
        
        <GetStarted />
        <HowItWorks />
        <Features />
        
        {/* CTA Section */}
        <section className="relative overflow-hidden px-6 py-32">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-blue-500/10 to-transparent" />
          <div className="relative z-10 mx-auto max-w-4xl text-center">
            <h2 className="mb-6 text-4xl font-bold tracking-tight md:text-5xl">Ready to simplify your AI gateway?</h2>
            <p className="mx-auto mb-10 max-w-2xl text-xl text-zinc-400">
              Join developers routing models through Router2k — open source and free to start.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button
                onClick={() => router.push("/dashboard")}
                className="h-12 w-full rounded-md bg-blue-600 px-8 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-500 sm:w-auto"
              >
                Start Free
              </button>
              <button
                onClick={() => window.open("https://github.com/decolua/9router#readme", "_blank")}
                className="h-12 w-full rounded-md border border-zinc-700 bg-transparent px-8 text-base font-semibold text-white transition-colors hover:bg-zinc-900 sm:w-auto"
              >
                Read Documentation
              </button>
            </div>
          </div>
        </section>
        </main>
        
        <Footer />
      </div>
      
      {/* Global styles for keyframes */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes dash {
          to { stroke-dashoffset: -20; }
        }
        @keyframes blob {
          0%, 100% { 
            transform: translate(0, 0) scale(1);
          }
          33% { 
            transform: translate(30px, -50px) scale(1.1);
          }
          66% { 
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
        .animate-blob {
          animation: blob 20s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

