import React, { useState } from 'react';
import { 
  Sparkles, 
  FileText, 
  ShieldCheck, 
  Search, 
  CheckCircle2, 
  Cpu, 
  ArrowRight, 
  Layers, 
  Eye, 
  FileCheck, 
  Lock, 
  Database, 
  Zap, 
  Workflow, 
  MessageSquare, 
  SlidersHorizontal,
  ChevronRight,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import MockWorkspacePreview from '../components/landing/MockWorkspacePreview';

export default function LandingPage({ onOpenAuth }) {
  const [activePersona, setActivePersona] = useState('academic');

  const personas = {
    academic: {
      title: 'Academic & Thesis Research',
      role: 'Students, Thesis Writers & Researchers',
      pain: 'Skimming dozens of 40-page PDF research papers, literature reviews, and chapters just to find comparative methodology details.',
      solution: 'Ask thematic questions across multiple papers. Receive instant comparative syntheses with exact page citations ready for your bibliography.',
      sampleQuery: 'How do the experimental methodologies differ between the 2024 and 2025 climate models in these papers?',
      citations: ['Climate_Model_Review_2025.pdf (p. 14)', 'Global_Atmospheric_Study.pdf (p. 22)']
    },
    product: {
      title: 'Product & Market Intelligence',
      role: 'Product Managers & Business Analysts',
      pain: 'Drowning in customer interview transcripts, competitor whitepapers, and market research decks spread across separate folders.',
      solution: 'Synthesize recurring user pain points, feature requests, and market shifts into clear bullet points with direct links to customer quotes.',
      sampleQuery: 'What are the top 3 friction points users reported when onboarding in the Q3 customer interviews?',
      citations: ['Customer_Interviews_Batch_A.docx (p. 7)', 'UX_Audit_Findings.pdf (p. 3)']
    },
    writing: {
      title: 'Non-Fiction & Technical Writing',
      role: 'Journalists, Technical Authors & Creators',
      pain: 'Verifying factual claims, finding forgotten excerpts, and keeping track of quotes across extensive research dossiers.',
      solution: 'Interrogate your research library conversationally. Click citations to view the verbatim excerpt and quote your sources with confidence.',
      sampleQuery: 'What primary arguments did the author present regarding renewable grid storage limitations?',
      citations: ['Energy_Transition_Dossier.pdf (p. 45)', 'CleanTech_Whitepaper.pdf (p. 11)']
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white flex flex-col">
      
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20 shadow-md shadow-indigo-500/10">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
              PageSense
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                v1.0
              </span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-slate-400">
            <a href="#features" className="hover:text-indigo-400 transition">Features</a>
            <a href="#how-it-works" className="hover:text-indigo-400 transition">How It Works</a>
            <a href="#solutions" className="hover:text-indigo-400 transition">Solutions</a>
            <a href="#security" className="hover:text-indigo-400 transition">Security & Trust</a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onOpenAuth(false)}
              className="text-xs font-medium text-slate-300 hover:text-white px-3 py-2 transition"
            >
              Sign In
            </button>
            <button
              onClick={() => onOpenAuth(true)}
              className="text-xs font-semibold px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition flex items-center gap-1.5"
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 md:pt-28 md:pb-24 overflow-hidden">
        {/* Subtle Ambient Background Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-indigo-600/15 blur-[120px] rounded-full pointer-events-none -z-10" />
        <div className="absolute top-1/3 left-1/3 w-[300px] h-[250px] bg-sky-500/10 blur-[100px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs font-medium mb-6 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Conversational Document Analysis</span>
            <span className="text-slate-600">•</span>
            <span className="text-indigo-400 font-semibold">Click-to-Verify Citations</span>
          </div>

          {/* Primary Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.15]">
            Turn Static Documents into an{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-sky-300 to-indigo-200 bg-clip-text text-transparent">
              Authoritative Second Brain
            </span>
          </h1>

          {/* Sub-headline */}
          <p className="mt-6 text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Ingest contracts, financial statements, and research files in seconds. Ask complex questions and receive streaming answers grounded in verifiable, click-to-verify citations.
          </p>

          {/* Dual Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <button
              onClick={() => onOpenAuth(true)}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-semibold shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition"
            >
              <span>Create Free Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="#how-it-works"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition"
            >
              <span>Explore Interactive Architecture</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </a>
          </div>

          {/* Floating Live Workspace Preview */}
          <div className="mt-14 max-w-5xl mx-auto">
            <MockWorkspacePreview onOpenAuth={() => onOpenAuth(true)} />
          </div>
        </div>
      </section>

      {/* Ingestion & Multi-Format Support Bar */}
      <section className="py-8 bg-slate-900/50 border-y border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Universal Ingestion Engine
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatic parsing, OCR extraction, and vectorization without manual configuration.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
              <span className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-center gap-1.5 font-medium">
                <FileText className="w-3.5 h-3.5 text-rose-400" /> PDF Documents
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-center gap-1.5 font-medium">
                <FileText className="w-3.5 h-3.5 text-blue-400" /> Word (.docx)
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-center gap-1.5 font-medium">
                <FileText className="w-3.5 h-3.5 text-emerald-400" /> Notes & Text (.txt, .md)
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-center gap-1.5 font-medium">
                <Cpu className="w-3.5 h-3.5 text-amber-400" /> Scanned Images & Photos
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Core Capabilities (Feature Grid) */}
      <section id="features" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
            Engineered For Accuracy
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-white mt-2">
            Why Knowledge Workers Trust PageSense
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-3 leading-relaxed">
            Generic chatbots often answer without accountability. PageSense grounds every response directly in your uploaded source passages with transparent, click-to-verify references.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1 */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 transition group">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 transition">
              <Eye className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white">Clickable Citations</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Every answer includes numbered inline citations (`[1]`, `[2]`). Click any citation to inspect the verbatim snippet, exact page number, and confidence score.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 transition group">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center mb-4 group-hover:scale-110 transition">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white">Full-Document Comprehension</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Instead of reading sentences in isolation, PageSense understands the overall purpose of your files so crucial context is never lost during your search.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 transition group">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white">Multi-Turn Context</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Ask natural follow-up questions like "What about the second clause?" without repeating yourself. PageSense maintains dialogue context throughout your session.
            </p>
          </div>

          {/* Card 4 */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 transition group">
            <div className="w-10 h-10 rounded-2xl bg-violet-500/10 text-violet-400 flex items-center justify-center mb-4 group-hover:scale-110 transition">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white">Strict Workspace Privacy</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Every workspace is completely private to your account. Your uploaded documents and chat histories remain strictly confidential and isolated.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works (3-Step Pipeline) */}
      <section id="how-it-works" className="py-20 bg-slate-900/30 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
              Simple & Effortless
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-white mt-2">
              From Upload to Actionable Answers in 3 Steps
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
              No manual setup, tagging, or prompt training required.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Step 1 */}
            <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 relative">
              <div className="text-4xl font-extrabold text-indigo-500/20 mb-3 font-mono">01</div>
              <h4 className="text-base font-semibold text-white mb-2">Drop in Your Documents</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Upload PDFs, Word docs, contracts, or even scanned invoice photos. We automatically extract and organize all text and tables for you.
              </p>
              <div className="mt-4 pt-4 border-t border-slate-900 flex items-center gap-2 text-[11px] text-slate-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>PDFs, DOCX, Scans & Text</span>
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 relative">
              <div className="text-4xl font-extrabold text-indigo-500/20 mb-3 font-mono">02</div>
              <h4 className="text-base font-semibold text-white mb-2">AI Analyzes the Whole Context</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                PageSense grasps the big picture before answering, connecting facts across pages so crucial details are never missed or taken out of context.
              </p>
              <div className="mt-4 pt-4 border-t border-slate-900 flex items-center gap-2 text-[11px] text-slate-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Deep Multi-Page Comprehension</span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 relative">
              <div className="text-4xl font-extrabold text-indigo-500/20 mb-3 font-mono">03</div>
              <h4 className="text-base font-semibold text-white mb-2">Get Verified, Sourced Answers</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Ask questions in plain English. Get instant, comprehensive summaries with clickable citations that link you straight to the exact source page.
              </p>
              <div className="mt-4 pt-4 border-t border-slate-900 flex items-center gap-2 text-[11px] text-slate-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Direct Page-Level Verification</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Solutions / Persona Switcher */}
      <section id="solutions" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
            Tailored For High-Stakes Teams
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-white mt-2">
            Built for Roles Where Accuracy Is Non-Negotiable
          </h2>
        </div>

        {/* Persona Tabs */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex p-1 rounded-2xl bg-slate-900 border border-slate-800">
            <button
              onClick={() => setActivePersona('academic')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                activePersona === 'academic'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Academic & Students
            </button>
            <button
              onClick={() => setActivePersona('product')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                activePersona === 'product'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Product & Strategy
            </button>
            <button
              onClick={() => setActivePersona('writing')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                activePersona === 'writing'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Writers & Researchers
            </button>
          </div>
        </div>

        {/* Active Persona Showcase Card */}
        <div className="max-w-4xl mx-auto rounded-3xl bg-slate-900/90 border border-slate-800 p-8 shadow-2xl backdrop-blur-xl">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            <div className="md:col-span-6 space-y-4 text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                {personas[activePersona].role}
              </span>
              <h3 className="text-xl font-bold text-white">
                {personas[activePersona].title}
              </h3>
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  The Frustration:
                </span>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {personas[activePersona].pain}
                </p>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider block mb-1">
                  The PageSense Solution:
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {personas[activePersona].solution}
                </p>
              </div>
            </div>

            <div className="md:col-span-6 rounded-2xl bg-slate-950 border border-slate-800/90 p-5 space-y-3.5 text-left">
              <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between pb-2 border-b border-slate-800">
                <span>Sample Conversational Query</span>
                <span className="text-indigo-400">Grounded Search</span>
              </div>
              <p className="text-xs font-medium text-white italic">
                "{personas[activePersona].sampleQuery}"
              </p>
              <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">
                  Grounding Citations Retrieved:
                </span>
                {personas[activePersona].citations.map((cite, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-indigo-300 bg-indigo-950/40 border border-indigo-800/40 px-2.5 py-1.5 rounded-lg">
                    <FileCheck className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{cite}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security & Data Privacy Section */}
      <section id="security" className="py-20 bg-slate-900/40 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-2xl mx-auto mb-12">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
              Enterprise Grade Privacy
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-white mt-2">
              Your Data Stays Yours. Always.
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
              We treat your corporate documents with institutional rigor.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto text-left">
            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800">
              <Lock className="w-6 h-6 text-indigo-400 mb-3" />
              <h4 className="text-sm font-semibold text-white">Private & Isolated Workspaces</h4>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Your workspaces and conversations are strictly isolated to your account. No other user can access or search your files.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800">
              <ShieldCheck className="w-6 h-6 text-sky-400 mb-3" />
              <h4 className="text-sm font-semibold text-white">Encrypted Data in Transit</h4>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                All communications and document transfers are encrypted using industry-standard TLS protocols to keep your information secure.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800">
              <Zap className="w-6 h-6 text-emerald-400 mb-3" />
              <h4 className="text-sm font-semibold text-white">Secure Temporary File Access</h4>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Uploaded files remain private. Previews and downloads use expiring, secure links generated only when you request to view them.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* High-Conversion Bottom CTA Banner */}
      <section className="py-20 relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="rounded-3xl bg-gradient-to-b from-indigo-900/30 to-slate-900 border border-indigo-500/20 p-10 sm:p-14 shadow-2xl relative">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Ready to interrogate your documents with zero friction?
            </h2>
            <p className="mt-4 text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
              Create a free workspace, upload your first document, and experience verifiable AI synthesis today.
            </p>
            <div className="mt-8 flex justify-center">
              <button
                onClick={() => onOpenAuth(true)}
                className="px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xl shadow-indigo-600/30 flex items-center gap-2 transition"
              >
                <span>Get Started Now</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Global Footer */}
      <footer className="mt-auto border-t border-slate-800/80 bg-slate-950 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold text-slate-300">PageSense</span>
            <span>• Document Intelligence & Conversational RAG</span>
          </div>

          <div className="text-xs text-slate-500">
            <span>© {new Date().getFullYear()} PageSense. All rights reserved.</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
