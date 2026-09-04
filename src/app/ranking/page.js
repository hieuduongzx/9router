import Navigation from "@/app/landing/components/Navigation";
import Footer from "@/app/landing/components/Footer";
import RankingBoard from "./RankingBoard";

export const metadata = {
  title: "Model Ranking | Router2k",
  description:
    "Public leaderboard of the most-used AI models routed through Router2k, ranked by requests and tokens across hourly, daily, weekly, monthly, and all-time windows.",
};

export default function PublicRankingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background font-sans text-foreground antialiased selection:bg-foreground/10 selection:text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[720px] overflow-hidden">
        <div className="landing-grid absolute inset-0" />
      </div>

      <div className="relative z-10">
        <Navigation />
        <main>
          <RankingBoard />
        </main>
        <Footer />
      </div>
    </div>
  );
}
