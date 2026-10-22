// Screen 3: Welcome / landing page.
import { PublicNav } from '@/components/layout/PublicNav';
import { Hero } from './sections/Hero';
import { Problem } from './sections/Problem';
import { HowItWorks } from './sections/HowItWorks';
import { AiAgents } from './sections/AiAgents';
import { Audiences } from './sections/Audiences';
import { Footer } from './sections/Footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg">
      <section className="dots bg-navy text-on">
        <PublicNav />
        <Hero />
      </section>
      <Problem />
      <HowItWorks />
      <AiAgents />
      <Audiences />
      <Footer />
    </div>
  );
}
