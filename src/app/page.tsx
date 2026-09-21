import { Navbar } from "@/components/marketing/navbar";
import { Hero } from "@/components/marketing/hero";
import { Features } from "@/components/marketing/features";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Pricing } from "@/components/marketing/pricing";
import { Cta } from "@/components/marketing/cta";
import { Footer } from "@/components/marketing/footer";

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Features />
        <HowItWorks />
        <Pricing />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
