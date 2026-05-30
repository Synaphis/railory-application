const fs = require('fs');
const path = require('path');

const dir = './components/landing';
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const files = {
  'Hero.tsx': `
import Link from "next/link";
import { Sparkles, ArrowRight, Wand2 } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden border-b border-white/5">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-background to-background z-0"></div>
      
      <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col lg:flex-row items-center gap-16">
        <div className="flex-1 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono tracking-widest uppercase text-white/70 mb-8 backdrop-blur-md">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span>StyleAI Engine v2.0</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-display tracking-tight text-balance leading-[1.1] mb-6 text-white">
            The AI Styling Layer for Modern Commerce
          </h1>
          
          <p className="text-lg md:text-xl text-white/60 text-balance max-w-xl mb-10 leading-relaxed font-light">
            An AI-native styling platform that understands taste, combines products intelligently, and transforms inspiration into commerce.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/signup" className="group inline-flex items-center justify-center gap-2 bg-white text-black px-8 py-4 rounded-full text-sm font-medium hover:bg-white/90 transition-all">
              Start Styling
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="#vision" className="inline-flex items-center justify-center px-8 py-4 rounded-full text-sm font-medium text-white/80 hover:text-white border border-white/10 hover:bg-white/5 transition-colors">
              Explore the Vision
            </Link>
          </div>
        </div>
        
        <div className="flex-1 relative w-full max-w-lg lg:max-w-none">
          <div className="relative aspect-square md:aspect-[4/3] w-full rounded-2xl bg-white/5 border border-white/10 backdrop-blur-3xl overflow-hidden shadow-2xl flex flex-col">
            <div className="h-12 border-b border-white/10 flex items-center px-4 gap-2">
              <div className="w-3 h-3 rounded-full bg-white/20"></div>
              <div className="w-3 h-3 rounded-full bg-white/20"></div>
              <div className="w-3 h-3 rounded-full bg-white/20"></div>
            </div>
            
            <div className="p-6 pb-0">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-start gap-3">
                <Wand2 className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" />
                <p className="text-sm text-white/80 font-mono leading-relaxed">
                  "Going to an art gallery opening in East London. Want to look creative but effortless. Budget around £200."
                </p>
              </div>
            </div>
            
            <div className="flex-1 p-6 grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 p-4 flex flex-col justify-end relative overflow-hidden group">
                <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="w-full h-24 bg-white/5 rounded-lg mb-3"></div>
                <div className="w-1/2 h-2 bg-white/20 rounded mb-2"></div>
                <div className="w-1/3 h-2 bg-white/10 rounded"></div>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 p-4 flex flex-col justify-end mt-8 relative overflow-hidden group">
                <div className="absolute inset-0 bg-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="w-full h-24 bg-white/5 rounded-lg mb-3"></div>
                <div className="w-1/2 h-2 bg-white/20 rounded mb-2"></div>
                <div className="w-1/3 h-2 bg-white/10 rounded"></div>
              </div>
            </div>
          </div>
          
          <div className="absolute -top-12 -right-12 w-64 h-64 bg-indigo-500/20 blur-[100px] rounded-full pointer-events-none"></div>
          <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-purple-500/20 blur-[100px] rounded-full pointer-events-none"></div>
        </div>
      </div>
    </section>
  );
}
\`,
  'SocialProof.tsx': \`
export default function SocialProof() {
  return (
    <section className="py-12 border-b border-white/5 bg-white/[0.02]">
      <div className="max-w-7xl mx-auto px-6 text-center flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
        <p className="text-xs font-mono tracking-widest uppercase text-white/40">
          Built on modern AI infrastructure
        </p>
        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12 opacity-50 grayscale">
          <span className="font-display text-xl tracking-tight text-white font-semibold">Anthropic</span>
          <span className="font-display text-xl tracking-tight text-white font-semibold">OpenAI</span>
          <span className="font-display text-xl tracking-tight text-white font-semibold">Supabase</span>
          <span className="font-display text-xl tracking-tight text-white font-semibold">Vercel</span>
          <span className="font-display text-xl tracking-tight text-white font-semibold">Stripe</span>
        </div>
      </div>
    </section>
  );
}
\`,
  'ProblemStatement.tsx': \`
export default function ProblemStatement() {
  return (
    <section className="py-32 md:py-48 max-w-7xl mx-auto px-6 relative">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div>
          <h2 className="text-4xl md:text-6xl font-display tracking-tight leading-[1.1] mb-8 text-white">
            Fashion Was Never Designed for Search
          </h2>
          <div className="space-y-6 text-lg md:text-xl text-white/60 font-light leading-relaxed">
            <p>Today's fashion experience is fragmented. Retailers show products — not complete visions.</p>
            <p>You either scroll endlessly through disconnected items, accept a brand's pre-styled outfit, or abandon the purchase entirely.</p>
            <p>Most people know how they want to feel. They just can't translate that feeling into a coherent look.</p>
            <p className="text-white font-medium">
              Fashion discovery hasn't evolved with the way humans think. <span className="text-indigo-400">Until now.</span>
            </p>
          </div>
        </div>
        
        <div className="relative aspect-square w-full rounded-2xl bg-white/[0.02] border border-white/5 p-8 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 flex">
            <div className="w-1/2 h-full border-r border-white/10 flex flex-col gap-4 p-8 opacity-20">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="w-full h-12 bg-white/20 rounded" />
              ))}
            </div>
            <div className="w-1/2 h-full p-8 flex items-center justify-center">
              <div className="w-48 h-64 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-xl flex items-center justify-center shadow-[0_0_50px_rgba(99,102,241,0.2)]">
                <div className="w-8 h-8 rounded-full bg-indigo-400/50 blur-sm"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
\`,
  'ProductPreview.tsx': \`
import { Search, Brain, Layers, RefreshCw } from "lucide-react";

export default function ProductPreview() {
  return (
    <section className="py-32 bg-black border-y border-white/5 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-24">
          <h2 className="text-4xl md:text-5xl font-display tracking-tight text-white mb-6">From Prompt to Outfit</h2>
          <p className="text-lg text-white/50 max-w-2xl mx-auto">
            A cinematic, intelligent pipeline that transforms aesthetic intent into real inventory.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
          <div className="hidden md:block absolute top-12 left-12 right-12 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent z-0"></div>

          <div className="relative z-10 flex flex-col items-center text-center group">
            <div className="w-24 h-24 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-8 group-hover:bg-white/10 transition-colors shadow-2xl backdrop-blur-sm">
              <Search className="w-8 h-8 text-white/70" />
            </div>
            <h3 className="text-sm font-mono tracking-widest uppercase text-white/80 mb-4">01. The Prompt</h3>
            <p className="text-sm text-white/50 leading-relaxed bg-white/5 p-4 rounded-xl border border-white/5 text-left">
              "Date in East London. Creative but effortless. £200 budget."
            </p>
          </div>

          <div className="relative z-10 flex flex-col items-center text-center group mt-12 md:mt-0">
            <div className="w-24 h-24 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-8 group-hover:bg-white/10 transition-colors shadow-2xl backdrop-blur-sm">
              <Brain className="w-8 h-8 text-white/70" />
            </div>
            <h3 className="text-sm font-mono tracking-widest uppercase text-white/80 mb-4">02. Understanding</h3>
            <div className="flex flex-wrap gap-2 justify-center">
              <span className="text-xs text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded border border-indigo-500/20">East London</span>
              <span className="text-xs text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded border border-indigo-500/20">artsy</span>
              <span className="text-xs text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded border border-indigo-500/20">minimal</span>
            </div>
          </div>

          <div className="relative z-10 flex flex-col items-center text-center group mt-12 md:mt-0">
            <div className="w-24 h-24 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-8 group-hover:bg-white/10 transition-colors shadow-2xl backdrop-blur-sm">
              <Layers className="w-8 h-8 text-white/70" />
            </div>
            <h3 className="text-sm font-mono tracking-widest uppercase text-white/80 mb-4">03. Generation</h3>
            <div className="w-full bg-white/5 p-3 rounded-xl border border-white/5 flex gap-2">
              <div className="w-1/2 h-16 bg-white/10 rounded-lg"></div>
              <div className="w-1/2 h-16 bg-white/10 rounded-lg"></div>
            </div>
          </div>

          <div className="relative z-10 flex flex-col items-center text-center group mt-12 md:mt-0">
            <div className="w-24 h-24 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-8 group-hover:bg-white/10 transition-colors shadow-2xl backdrop-blur-sm">
              <RefreshCw className="w-8 h-8 text-white/70" />
            </div>
            <h3 className="text-sm font-mono tracking-widest uppercase text-white/80 mb-4">04. Refinement</h3>
            <p className="text-sm text-white/50 leading-relaxed bg-white/5 p-4 rounded-xl border border-white/5 text-left italic">
              "Make it more elevated."
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
\`,
  'HowItWorks.tsx': \`
export default function HowItWorks() {
  return (
    <section className="py-32 max-w-7xl mx-auto px-6">
      <div className="mb-20">
        <h2 className="text-4xl md:text-5xl font-display tracking-tight text-white mb-6">AI-Native Fashion Discovery</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white/[0.03] border border-white/5 p-10 rounded-3xl">
          <h3 className="font-mono text-sm tracking-widest uppercase text-indigo-400 mb-6">1. Describe the Vibe</h3>
          <p className="text-white/60 leading-relaxed">Use natural language. Not filters. Try "Quiet luxury in Copenhagen."</p>
        </div>
        <div className="bg-white/[0.03] border border-white/5 p-10 rounded-3xl">
          <h3 className="font-mono text-sm tracking-widest uppercase text-purple-400 mb-6">2. Context Engine</h3>
          <p className="text-white/60 leading-relaxed">The AI interprets aesthetics, occasion, price, and color harmony automatically.</p>
        </div>
        <div className="bg-white/[0.03] border border-white/5 p-10 rounded-3xl">
          <h3 className="font-mono text-sm tracking-widest uppercase text-pink-400 mb-6">3. Shop the Look</h3>
          <p className="text-white/60 leading-relaxed">Complete outfits built from real inventory. Shoppable via direct checkout.</p>
        </div>
      </div>
    </section>
  );
}
\`,
  'CrossBrand.tsx': \`
import { Network } from "lucide-react";

export default function CrossBrand() {
  return (
    <section className="py-32 border-y border-white/5 relative overflow-hidden bg-black">
      <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col lg:flex-row items-center gap-16">
        <div className="flex-1">
          <Network className="w-12 h-12 text-indigo-500 mb-8" />
          <h2 className="text-4xl md:text-5xl font-display tracking-tight text-white mb-8">One Styling Layer Across Every Brand</h2>
          <div className="space-y-6 text-lg text-white/60 font-light leading-relaxed">
            <p>Fashion brands only understand their own inventory. StyleAI understands style itself.</p>
            <p>Instead of shopping one catalog at a time, StyleAI searches across brands semantically.</p>
            <p className="text-white">Not keywords. Not categories. <span className="font-medium italic">Taste.</span></p>
          </div>
        </div>
        <div className="flex-1 w-full h-[400px] bg-white/[0.02] border border-white/5 rounded-3xl relative flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent"></div>
          <div className="absolute top-1/4 left-1/4 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full text-xs font-mono text-white/70 border border-white/10">Zara</div>
          <div className="absolute bottom-1/4 left-1/3 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full text-xs font-mono text-white/70 border border-white/10">COS</div>
          <div className="absolute top-1/3 right-1/4 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full text-xs font-mono text-white/70 border border-white/10">ASOS</div>
          <div className="absolute bottom-1/3 right-1/3 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full text-xs font-mono text-white/70 border border-white/10">Uniqlo</div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 p-4 bg-indigo-500/20 backdrop-blur-lg rounded-2xl border border-indigo-500/30 text-white font-display">StyleAI</div>
        </div>
      </div>
    </section>
  );
}
\`,
  'Technology.tsx': \`
export default function Technology() {
  return (
    <section className="py-32 max-w-7xl mx-auto px-6">
      <div className="mb-20 max-w-3xl">
        <h2 className="text-4xl md:text-5xl font-display tracking-tight text-white mb-6">Built on a Fashion Intelligence Engine</h2>
        <p className="text-xl text-white/50 leading-relaxed font-light">StyleAI combines vector embeddings, large language models, and semantic retrieval.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          { title: "Semantic Search", desc: "Understand style beyond keywords." },
          { title: "Vector-Based Discovery", desc: "Match products by meaning and aesthetic similarity." },
          { title: "Outfit Composition AI", desc: "Generate coherent combinations across brands." },
          { title: "Personalization Memory", desc: "Learn evolving user taste over time." },
          { title: "Commerce Infrastructure", desc: "Transform inspiration directly into conversion." }
        ].map((card, i) => (
          <div key={i} className="p-8 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/[0.04] transition-colors">
            <h3 className="text-lg text-white font-medium mb-3">{card.title}</h3>
            <p className="text-sm text-white/50 leading-relaxed">{card.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
\`,
  'FutureVision.tsx': \`
export default function FutureVision() {
  return (
    <section className="py-32 bg-zinc-950 border-y border-white/5" id="vision">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-24">
          <h2 className="text-4xl md:text-6xl font-display tracking-tight text-white mb-6">More Than Styling</h2>
          <p className="text-xl text-white/60 max-w-3xl mx-auto font-light leading-relaxed">StyleAI is building the intelligence layer for the future of fashion commerce.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10 border border-white/10 rounded-3xl overflow-hidden">
          {[
            { title: "AI Personal Stylists", desc: "Persistent fashion agents trained on your taste." },
            { title: "Creator Commerce", desc: "Influencers generate monetized shoppable collections." },
            { title: "Fashion Graph", desc: "A semantic understanding of aesthetics, brands, trends, and culture." },
            { title: "Personalized Discovery", desc: "Every feed adapts to your evolving identity." },
            { title: "Visual Try-On", desc: "See complete looks on realistic AI-generated models." },
            { title: "Commerce APIs", desc: "AI-native discovery infrastructure for retailers and platforms." }
          ].map((item, i) => (
            <div key={i} className="bg-zinc-950 p-12">
              <h3 className="text-xl text-white font-medium mb-4">{item.title}</h3>
              <p className="text-white/50 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
\`,
  'Ecosystem.tsx': \`
export default function Ecosystem() {
  return (
    <section className="py-32 max-w-7xl mx-auto px-6">
      <div className="mb-20">
        <h2 className="text-4xl md:text-5xl font-display tracking-tight text-white">Built for the Entire Fashion Ecosystem</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-8 border border-white/10 rounded-2xl"><h3 className="text-2xl font-display text-white mb-4">Consumers</h3><p className="text-white/60">Find your style faster.</p></div>
        <div className="p-8 border border-white/10 rounded-2xl"><h3 className="text-2xl font-display text-white mb-4">Creators</h3><p className="text-white/60">Turn aesthetics into revenue.</p></div>
        <div className="p-8 border border-white/10 rounded-2xl"><h3 className="text-2xl font-display text-white mb-4">Brands</h3><p className="text-white/60">Increase product discovery and conversion.</p></div>
        <div className="p-8 border border-white/10 rounded-2xl bg-white/5"><h3 className="text-2xl font-display text-white mb-4">Retailers</h3><p className="text-white/60">Unlock AI-native commerce experiences.</p></div>
      </div>
    </section>
  );
}
\`,
  'Editorial.tsx': \`
export default function Editorial() {
  return (
    <section className="py-32 border-y border-white/5 bg-black">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row gap-16">
        <div className="flex-1">
          <h2 className="text-4xl md:text-6xl font-display tracking-tight leading-[1.1] text-white mb-8">Inspired by Culture, Not Just Commerce</h2>
          <div className="space-y-6 text-lg text-white/60 font-light leading-relaxed">
            <p>StyleAI doesn't just organize products. It understands aesthetics.</p>
            <p>The platform learns from silhouettes, styling relationships, fashion language, trends, and visual identity.</p>
          </div>
        </div>
        <div className="flex-1 grid grid-cols-2 gap-4">
          <div className="p-6 border border-white/10 rounded-xl text-sm font-mono uppercase tracking-widest text-white/40 flex items-end h-32">Quiet Luxury</div>
          <div className="p-6 border border-white/10 rounded-xl text-sm font-mono uppercase tracking-widest text-white/40 flex items-end h-32">Scandi Minimal</div>
          <div className="p-6 border border-white/10 rounded-xl text-sm font-mono uppercase tracking-widest text-white/40 flex items-end h-32">East London</div>
          <div className="p-6 border border-white/10 rounded-xl text-sm font-mono uppercase tracking-widest text-white/40 flex items-end h-32">Tokyo Street</div>
        </div>
      </div>
    </section>
  );
}
\`,
  'Testimonials.tsx': \`
export default function Testimonials() {
  return (
    <section className="py-32 max-w-7xl mx-auto px-6">
      <h2 className="text-3xl md:text-4xl font-display tracking-tight text-white text-center mb-20">Early Users Are Already Styling Differently</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="p-10 bg-white/5 rounded-3xl border border-white/10"><p className="text-lg text-white/80 leading-relaxed font-serif italic">"It feels like talking to a stylist instead of searching a store."</p></div>
        <div className="p-10 bg-white/5 rounded-3xl border border-white/10"><p className="text-lg text-white/80 leading-relaxed font-serif italic">"For the first time, I can actually visualize outfits before buying."</p></div>
        <div className="p-10 bg-white/5 rounded-3xl border border-white/10"><p className="text-lg text-white/80 leading-relaxed font-serif italic">"It understands taste surprisingly well."</p></div>
      </div>
    </section>
  );
}
\`,
  'FinalCta.tsx': \`
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function FinalCta() {
  return (
    <section className="py-40 relative overflow-hidden text-center border-y border-white/5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_var(--tw-gradient-stops))] from-indigo-900/20 via-black to-black z-0"></div>
      <div className="relative z-10 max-w-4xl mx-auto px-6">
        <h2 className="text-5xl md:text-7xl font-display tracking-tight text-white mb-8">AI Is Changing Commerce. <br className="hidden md:block"/>Fashion Is Next.</h2>
        <p className="text-xl text-white/60 font-light mb-12">Join the next generation of AI-native fashion discovery.</p>
        <div className="flex justify-center">
          <Link href="/signup" className="group inline-flex items-center justify-center gap-2 bg-white text-black px-10 py-5 rounded-full text-base font-medium hover:bg-white/90 transition-all shadow-[0_0_40px_rgba(255,255,255,0.2)]">
            Start Styling
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  );
}
\`,
  'Footer.tsx': \`
import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function Footer() {
  return (
    <footer className="py-20 bg-black">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-12 mb-20">
          <div className="col-span-2">
            <Link href="/" className="inline-flex items-center gap-2 font-display text-xl text-white mb-6">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              StyleAI
            </Link>
            <p className="text-white/40 text-sm max-w-xs leading-relaxed">An AI-native fashion intelligence platform.</p>
          </div>
          <div>
            <h4 className="font-mono text-xs uppercase tracking-widest text-white/80 mb-6">Product</h4>
            <ul className="space-y-4 text-sm text-white/50">
              <li><Link href="#" className="hover:text-white transition-colors">Outfit Generation</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">Personalization</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">Creator Tools</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-mono text-xs uppercase tracking-widest text-white/80 mb-6">Technology</h4>
            <ul className="space-y-4 text-sm text-white/50">
              <li><Link href="#" className="hover:text-white transition-colors">AI Engine</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">Fashion Graph</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">Semantic Search</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-mono text-xs uppercase tracking-widest text-white/80 mb-6">Discover</h4>
            <ul className="space-y-4 text-sm text-white/50">
              <li><Link href="#" className="hover:text-white transition-colors">Editorial</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">Lookbooks</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">Trends</Link></li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-white/10 text-xs text-white/40">
          <p>© 2026 StyleAI. All rights reserved.</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <Link href="#" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-white transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
\`
};

for (const [filename, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(dir, filename), content.trim());
}
console.log('Successfully generated ' + Object.keys(files).length + ' components.');
