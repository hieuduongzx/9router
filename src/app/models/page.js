import Navigation from "@/app/landing/components/Navigation";
import Footer from "@/app/landing/components/Footer";
import ModelsCatalog from "./ModelsCatalog";

export const metadata = {
  title: "AI Models and Pricing | Router2k",
  description: "Browse AI models, providers, token pricing, and capabilities available through the Router2k gateway.",
};

export default function PublicModelsPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-white font-sans text-zinc-950 antialiased selection:bg-zinc-950/10 selection:text-zinc-950">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[720px] overflow-hidden">
        <div className="landing-grid absolute inset-0" />
      </div>

      <div className="relative z-10">
        <Navigation />
        <main>
          <ModelsCatalog />
        </main>
        <Footer />
      </div>
    </div>
  );
}
