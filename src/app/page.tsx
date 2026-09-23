import { Navbar } from "@/components/marketing/navbar";
import { Hero } from "@/components/marketing/hero";
import { Stats } from "@/components/marketing/stats";
import { Features } from "@/components/marketing/features";
import { DashboardPreview } from "@/components/marketing/dashboard-preview";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Comparison } from "@/components/marketing/comparison";
import { Pricing } from "@/components/marketing/pricing";
import { Testimonials } from "@/components/marketing/testimonials";
import { Support } from "@/components/marketing/support";
import { Faq } from "@/components/marketing/faq";
import { Cta } from "@/components/marketing/cta";
import { Footer } from "@/components/marketing/footer";
import { StructuredData } from "@/components/marketing/structured-data";
import { WhatsappFloatButton } from "@/components/marketing/whatsapp-float-button";

export default function LandingPage() {
  return (
    <>
      <StructuredData />
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Stats />
        <Features />
        <DashboardPreview />
        <HowItWorks />
        <Comparison />
        <Pricing />
        <Testimonials />
        <Support />
        <Faq />
        <Cta />
      </main>
      <Footer />
      <WhatsappFloatButton />
    </>
  );
}
