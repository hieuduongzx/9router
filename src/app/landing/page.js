/*
THESIS: Router2k sells simple access to many AI models through one API key, with no infrastructure lesson in the way.
OWN-WORLD: White bench surface, one black API panel, zinc hairlines, and monospace only where data or code needs it.
STORY: Understand the service, compare available models and pricing, create an account, and start calling the API.
FIRST VIEWPORT: A short promise and one primary action sit beside a compact API access panel.
FORM: A simple three-part product page—overview, models, endpoint—with every secondary system deferred to the dashboard.
*/
import Navigation from "./components/Navigation";
import HeroSection from "./components/HeroSection";
import ModelCatalogPreview from "./components/ModelCatalogPreview";
import EndpointSection from "./components/EndpointSection";
import Footer from "./components/Footer";

export const metadata = {
  title: "Router2k — One API key for every AI model",
  description:
    "Access leading AI models through one OpenAI-compatible API. Compare model pricing, create an API key, and track usage from one account.",
};

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-white font-sans text-zinc-950 antialiased selection:bg-zinc-950/10 selection:text-zinc-950">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[760px] overflow-hidden">
        <div className="landing-grid absolute inset-0" />
      </div>

      <div className="relative z-10">
        <Navigation />

        <main>
          <HeroSection />
          <ModelCatalogPreview />
          <EndpointSection />
        </main>

        <Footer />
      </div>
    </div>
  );
}
