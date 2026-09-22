"use client";

import { useEffect, useRef, useState } from "react";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

const faqs = [
  {
    q: "What is Chow45?",
    a: "Chow45 is a campus-focused food ordering and delivery platform being built for students, staff, vendors and residents around OOU Sagamu campus.",
  },
  {
    q: "Who can use Chow45?",
    a: "Students, staff, campus residents and food vendors around OOU Sagamu campus will all be welcome.",
  },
  {
    q: "When is Chow45 launching?",
    a: "We're still finalising this and we'll share the details when we're ready. Join the waitlist to hear first.",
  },
  {
    q: "Can I join if I'm a vendor?",
    a: "Absolutely. Choose \u201cVendor\u201d in the waitlist form and we'll keep you in the loop as we build the vendor experience.",
  },
  {
    q: "Will Chow45 deliver around OOU Sagamu campus?",
    a: "That's the plan. We're still finalising the details and will share delivery coverage when we're ready.",
  },
  {
    q: "How much will delivery cost?",
    a: "We're still finalising this and we'll share the details when we're ready.",
  },
  {
    q: "How do I get notified?",
    a: "Join the waitlist with your email and phone number. We'll send launch updates when Chow45 is ready to serve your side of campus.",
  },
];

function useReveal() {
  const ref = useRef<HTMLDivElement | HTMLElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function Reveal({
  children,
  delay,
  className = "",
}: {
  children: React.ReactNode;
  delay?: boolean;
  className?: string;
}) {
  const ref = useReveal();
  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className={`reveal ${delay ? "[transition-delay:0.15s]" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export default function MarketingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const openWaitlist = () => {
    setSubmitted(false);
    setModalOpen(true);
  };

  const closeWaitlist = () => setModalOpen(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <>
      {/* HEADER */}
      <header className="fixed inset-x-0 top-[18px] z-50 pointer-events-none">
        <nav
          aria-label="Main navigation"
          className="mx-auto flex w-[min(1200px,calc(100%-48px))] items-center justify-between gap-3"
        >
          <div className="pointer-events-auto flex items-center gap-2.5">
            <a
              href="#top"
              aria-label="Chow45 home"
              className="inline-flex items-center gap-2 rounded-full bg-brand-green px-[18px] py-2.5 text-white shadow-[0_6px_20px_rgba(12,81,63,0.22)] transition hover:-translate-y-0.5 hover:bg-brand-green-dark"
            >
              <span className="flex items-center text-brand-yellow">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                </svg>
              </span>
              <span className="font-display text-[19px] font-extrabold tracking-[-0.03em]">
                Chow<span className="text-brand-yellow">45</span>
              </span>
            </a>
            <div className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-brand-green/[0.14] bg-white px-3.5 py-2 text-[13px] font-bold text-brand-ink shadow-[0_4px_14px_rgba(0,0,0,0.05)]">
              <span className="text-sm leading-none">🇳🇬</span>
              <span className="font-extrabold">NG</span>
              <span className="ml-0.5 rounded-full bg-brand-green-light px-1.5 py-0.5 text-[10px] font-extrabold text-brand-green">
                OOU Sagamu
              </span>
              <svg className="ml-0.5 hidden text-brand-muted min-[481px]:block" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
          </div>

          <div className="pointer-events-auto hidden items-center gap-7 rounded-full border-[1.5px] border-brand-green/[0.14] bg-white px-7 py-2.5 shadow-[0_8px_25px_rgba(0,0,0,0.06)] min-[1025px]:flex">
            <a href="#how-it-works" className="text-sm font-semibold text-brand-ink transition hover:text-brand-green">How it works</a>
            <a href="#vendors" className="text-sm font-semibold text-brand-ink transition hover:text-brand-green">For vendors</a>
            <a href="#faq" className="text-sm font-semibold text-brand-ink transition hover:text-brand-green">FAQ</a>
            <a href={`${APP_URL}/app`} className="text-sm font-extrabold text-brand-green">Open App ↗</a>
          </div>

          <div className="pointer-events-auto flex items-center gap-2.5">
            <a
              href="#waitlist"
              onClick={(e) => { e.preventDefault(); openWaitlist(); }}
              className="hidden items-center justify-center gap-2.5 rounded-full bg-brand-ink px-6 py-[13px] text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#252522] hover:shadow-[0_8px_20px_rgba(0,0,0,0.15)] min-[769px]:inline-flex"
            >
              Join waitlist <span>↗</span>
            </a>
            <a
              href={`${APP_URL}/app`}
              aria-label="Cart & order preview"
              title="Open Chow45 Marketplace"
              className="flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-brand-green/[0.14] bg-white text-brand-green shadow-[0_4px_14px_rgba(0,0,0,0.05)] transition hover:-translate-y-0.5 hover:bg-brand-green-light"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" />
                <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
              </svg>
            </a>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              className="flex h-[42px] w-[42px] flex-col items-center justify-center gap-[5px] rounded-full border-[1.5px] border-brand-green/[0.14] bg-white shadow-[0_4px_14px_rgba(0,0,0,0.06)] min-[769px]:hidden"
            >
              <span className="block h-0.5 w-[18px] rounded bg-brand-ink" />
              <span className="block h-0.5 w-[18px] rounded bg-brand-ink" />
            </button>
          </div>
        </nav>

        {menuOpen && (
          <div className="pointer-events-auto absolute inset-x-5 top-[76px] flex flex-col gap-[18px] rounded-3xl border-2 border-brand-green bg-white p-6 shadow-[0_16px_40px_rgba(0,0,0,0.12)]">
            <a href="#how-it-works" className="text-base font-bold text-brand-ink" onClick={() => setMenuOpen(false)}>How it works</a>
            <a href="#vendors" className="text-base font-bold text-brand-ink" onClick={() => setMenuOpen(false)}>For vendors</a>
            <a href="#faq" className="text-base font-bold text-brand-ink" onClick={() => setMenuOpen(false)}>FAQ</a>
            <a href={`${APP_URL}/app`} className="text-base font-extrabold text-brand-green" onClick={() => setMenuOpen(false)}>Launch Marketplace App ↗</a>
            <a
              href="#waitlist"
              onClick={(e) => { e.preventDefault(); setMenuOpen(false); openWaitlist(); }}
              className="mt-1.5 inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-brand-green px-6 py-[13px] text-sm font-bold text-white"
            >
              Join waitlist <span>↗</span>
            </a>
          </div>
        )}
      </header>

      <main id="top">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-b-[28px] border-b-2 border-brand-green bg-brand-cream pt-[115px] min-[769px]:pt-[150px] min-[769px]:rounded-b-[34px]">
          <div className="relative z-[2] mx-auto grid w-[min(1200px,calc(100%-48px))] grid-cols-1 items-center gap-7 pb-6 min-[1025px]:grid-cols-[1.05fr_0.95fr]">
            <Reveal className="max-w-[560px] text-center min-[1025px]:text-left min-[1025px]:mx-0 mx-auto">
              <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-green/[0.08] px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-green">
                <span className="h-[7px] w-[7px] animate-[pulse-dot_2s_infinite_ease-in-out] rounded-full bg-brand-orange" />
                Coming soon to OOU Sagamu campus
              </p>
              <h1 className="font-display text-[34px] font-extrabold leading-[1.05] tracking-[-0.035em] text-brand-ink min-[481px]:text-[54px] min-[769px]:leading-[0.96] min-[1025px]:text-[84px] min-[1025px]:tracking-[-0.055em]">
                Your next meal is{" "}
                <em className="not-italic text-brand-green underline decoration-brand-yellow decoration-[6px] underline-offset-4">
                  closer
                </em>{" "}
                than you think.
              </h1>
              <p className="my-6 text-[15px] leading-[1.5] text-brand-ink-soft min-[769px]:text-[17px] min-[769px]:leading-[1.55]">
                Chow45 is bringing fast, affordable food ordering straight to OOU Sagamu campus. Find your favourite campus spots, order in a few taps, and get on with your day.
              </p>

              <button
                onClick={openWaitlist}
                className="mx-auto flex w-full max-w-[520px] items-center gap-3 rounded-full border-[1.5px] border-brand-green/[0.14] bg-white py-1.5 pl-5 pr-1.5 text-left shadow-[0_12px_36px_rgba(12,81,63,0.09)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_42px_rgba(12,81,63,0.14)] min-[1025px]:mx-0"
              >
                <span className="flex items-center text-brand-green">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </span>
                <span className="flex-1 text-[14px] font-medium text-[#71716A] min-[769px]:text-[15px]">Enter a delivery address</span>
                <span className="inline-flex items-center justify-center rounded-full bg-brand-green px-[18px] py-3 text-[13px] font-bold text-white min-[769px]:text-sm">
                  Order now
                </span>
              </button>

              <div className="mt-2.5 flex flex-col items-center gap-3 min-[481px]:flex-row min-[481px]:justify-center min-[1025px]:justify-start">
                <button
                  onClick={openWaitlist}
                  className="inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-brand-green px-6 py-[13px] text-sm font-bold text-white shadow-[0_6px_18px_rgba(12,81,63,0.2)] transition hover:-translate-y-0.5 hover:bg-brand-green-dark min-[481px]:w-auto"
                >
                  Join the waitlist <span>↗</span>
                </button>
                <a href="#how-it-works" className="inline-flex items-center gap-1.5 border-b-[1.5px] border-brand-ink pb-0.5 text-sm font-bold text-brand-ink transition hover:border-brand-green hover:text-brand-green">
                  See how it works <span>↓</span>
                </a>
              </div>
              <p className="mt-6 text-xs font-semibold text-brand-muted">
                <span className="text-base text-brand-orange">✦</span> Built for students, staff &amp; campus life
              </p>
            </Reveal>

            <Reveal
              delay
              className="relative isolate mx-auto h-[280px] w-full max-w-full origin-top scale-[0.56] drop-shadow-[0_15px_25px_rgba(12,81,63,0.1)] min-[481px]:h-[350px] min-[481px]:scale-[0.68] min-[769px]:h-[450px] min-[769px]:scale-[0.85] min-[1025px]:h-[520px] min-[1025px]:scale-100"
            >
              <div className="absolute -z-10 right-10 top-[30px] h-[440px] w-[440px] rounded-full bg-brand-yellow after:absolute after:inset-[22px] after:rounded-full after:border-2 after:border-dashed after:border-brand-ink/20" />
              <span className="absolute right-[25px] top-[50px] z-[4] rotate-6 rounded-xl border-2 border-brand-ink bg-white px-3 py-2 font-display text-xs font-extrabold uppercase leading-[1.1] shadow-[4px_4px_0_#111111]">
                made for<br /><strong className="text-[15px] text-brand-orange">your side</strong>
              </span>
              <span className="absolute bottom-[65px] left-2.5 z-[4] -rotate-6 rounded-xl border-2 border-brand-ink bg-white px-3 py-2 font-display text-xs font-extrabold uppercase leading-[1.1] shadow-[4px_4px_0_#111111]">
                OOU Sagamu<br /><strong className="text-[15px] text-brand-orange">food run</strong>
              </span>
              <div className="absolute left-5 top-[130px] z-[4] text-3xl text-brand-green">✦</div>
              <div className="absolute bottom-[110px] right-[30px] z-[4] text-3xl text-brand-orange">✷</div>
              <div className="absolute bottom-20 left-[35px] z-[3] h-[115px] w-[155px] -rotate-[10deg] rounded-[16px_16px_75px_75px] border-[3px] border-brand-ink bg-brand-orange shadow-[8px_12px_0_rgba(12,81,63,0.15)]">
                <div className="absolute -left-1 -top-2.5 h-[30px] w-[158px] rounded-full border-[5px] border-brand-green bg-brand-cream" />
                <div className="absolute -top-[34px] left-[35px] z-[1] rotate-6 text-[64px]">🍛</div>
              </div>
              <div className="absolute bottom-[85px] right-[35px] z-[3] h-[150px] w-[150px] rotate-6">
                <div className="mt-6 flex h-[120px] items-center justify-center rounded-[8px_8px_28px_28px] border-[3px] border-brand-ink bg-brand-green font-display text-[65px] font-extrabold text-brand-yellow shadow-[8px_10px_0_rgba(17,17,17,0.15)]">
                  <span>45</span>
                </div>
                <div className="absolute left-[-6px] top-3 z-[1] h-[26px] w-[162px] rounded-lg border-[3px] border-brand-ink bg-brand-green-bright" />
                <i className="absolute left-10 top-[-18px] h-9 w-[70px] rounded-t-full border-[6px] border-b-0 border-brand-green not-italic" />
              </div>
              <div className="absolute left-[200px] top-10 z-[4] h-[360px] w-[180px] rotate-6 rounded-[32px] border-[6px] border-[#222] bg-brand-ink shadow-[14px_18px_0_rgba(12,81,63,0.2)]">
                <div className="absolute left-[60px] top-2.5 h-1.5 w-12 rounded bg-[#555]" />
                <div className="absolute inset-x-2 bottom-2 top-[26px] rounded-3xl bg-brand-cream px-3.5 py-6">
                  <span className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-full bg-brand-orange text-xl text-white">⌖</span>
                  <small className="mt-3.5 block text-[9px] uppercase leading-[1.4] tracking-[0.06em]">
                    YOUR CHOW<br /><strong className="block text-[15px] tracking-[-0.02em]">is on the way</strong>
                  </small>
                  <div className="my-3.5 ml-3.5 flex h-[42px] flex-col justify-between border-l-[2.5px] border-dotted border-brand-green pl-3">
                    <b className="block h-2.5 w-2.5 rounded-full bg-brand-green" />
                    <i className="block h-2.5 w-2.5 rounded-full bg-brand-orange not-italic" />
                  </div>
                  <span className="absolute bottom-6 left-9 text-5xl">🍔</span>
                </div>
              </div>
              <div className="absolute right-[100px] top-[250px] z-[5] h-[165px] w-[120px]">
                <div className="absolute left-[35px] top-0 h-11 w-11 rounded-full border-[8px] border-brand-ink bg-[#6F4030]" />
                <div className="absolute left-[30px] top-[42px] h-[82px] w-[60px] rounded-[24px_24px_10px_10px] border-[3px] border-brand-ink bg-brand-orange before:absolute before:-left-1.5 before:top-[26px] before:h-3 before:w-[68px] before:bg-brand-green" />
                <div className="absolute bottom-0.5 left-2 h-8 w-8 rounded-full border-[6px] border-brand-ink bg-white" />
                <div className="absolute bottom-0.5 right-0 h-8 w-8 rounded-full border-[6px] border-brand-ink bg-white" />
                <div className="absolute right-[-12px] top-[54px] rotate-[12deg] rounded-md border-[3px] border-brand-ink bg-brand-yellow px-2 py-2.5 font-display text-base font-extrabold text-brand-green">45</div>
              </div>
            </Reveal>
          </div>

          <div className="hero-skyline relative z-[1] -mb-2 h-[105px] w-full min-[481px]:h-[140px] min-[769px]:h-[180px] min-[769px]:-mt-[60px] min-[1025px]:h-[230px] min-[1025px]:-mt-[110px]" aria-hidden="true" />
        </section>

        {/* TICKER */}
        <section aria-label="Chow45 highlights" className="overflow-hidden border-y-2 border-brand-green bg-brand-green py-[18px] font-display text-sm font-extrabold tracking-[0.1em] text-brand-cream">
          <div className="flex w-max animate-[ticker-scroll_30s_linear_infinite] gap-8 whitespace-nowrap">
            {[0, 1].map((i) => (
              <span key={i} className="flex gap-8">
                <span>GOOD FOOD, LESS STRESS</span><b className="text-brand-yellow">✦</b>
                <span>MADE FOR OOU SAGAMU CAMPUS</span><b className="text-brand-yellow">✦</b>
                <span>YOUR CAMPUS, YOUR CHOW</span><b className="text-brand-yellow">✦</b>
              </span>
            ))}
          </div>
        </section>

        {/* PROBLEM */}
        <section className="border-b-2 border-brand-green bg-brand-yellow-pastel px-0 py-16 min-[769px]:py-[100px]">
          <div className="mx-auto w-[min(1200px,calc(100%-48px))]">
            <Reveal className="mb-9 min-[769px]:mb-[50px]">
              <p className="mb-4 inline-block rounded-full bg-brand-green/[0.08] px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-green">02 / The campus food problem</p>
              <h2 className="font-display text-[32px] font-extrabold leading-[1.08] tracking-[-0.05em] text-brand-ink min-[769px]:text-[68px]">
                Campus food shouldn&rsquo;t<br />be this <em className="not-italic text-brand-green">stressful.</em>
              </h2>
            </Reveal>
            <div className="grid grid-cols-1 gap-4 min-[481px]:grid-cols-2 min-[1025px]:grid-cols-4">
              {[
                { bg: "bg-[#FFDDD6]", n: "01", icon: "⌁", title: "Too much walking", text: "Find and order food without crossing campus just to get lunch.", delay: false },
                { bg: "bg-[#FFF6C7]", n: "02", icon: "?", title: "Too many options, no easy way to choose", text: "Discover food spots around you from one simple platform.", delay: true },
                { bg: "bg-brand-mint", n: "03", icon: "◷", title: "Long waits", text: "Know what you're ordering and spend less time figuring out your next meal.", delay: false },
                { bg: "bg-white", n: "04", icon: "...", title: "Food decisions at 2PM", text: "Because \u201cwhat are we eating?\u201d shouldn't be the hardest question of the day.", delay: true },
              ].map((c) => (
                <Reveal key={c.n} delay={c.delay}>
                  <article className={`flex min-h-[260px] flex-col rounded-[28px] border-2 border-brand-green p-6 shadow-[0_6px_0_#0c513f] transition hover:-translate-y-1.5 hover:shadow-[0_12px_0_#0c513f] min-[769px]:min-h-[340px] min-[769px]:p-7 ${c.bg}`}>
                    <span className="self-start rounded-full bg-brand-green/10 px-2.5 py-1 font-display text-[13px] font-extrabold text-brand-green">{c.n}</span>
                    <div className="my-5 font-accent text-[44px] leading-none text-brand-ink min-[769px]:my-9 min-[769px]:text-[70px]">{c.icon}</div>
                    <h3 className="mb-2.5 font-display text-lg font-extrabold leading-[1.15] tracking-[-0.035em] text-brand-ink">{c.title}</h3>
                    <p className="text-sm leading-[1.5] text-brand-ink-soft">{c.text}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* OFFER */}
        <section className="bg-brand-paper px-0 py-16 min-[769px]:py-[100px]">
          <div className="mx-auto w-[min(1200px,calc(100%-48px))]">
            <Reveal className="mb-9 text-center min-[769px]:mb-[50px]">
              <p className="mb-4 inline-block rounded-full bg-brand-green/[0.08] px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-green">03 / One place, plenty of chow</p>
              <h2 className="font-display text-[32px] font-extrabold leading-[1.08] tracking-[-0.05em] text-brand-ink min-[769px]:text-[68px]">
                Everything you need<br />for your next <em className="not-italic text-brand-green">chow.</em>
              </h2>
            </Reveal>
            <div className="grid grid-cols-1 gap-4 min-[481px]:grid-cols-2 min-[1025px]:grid-cols-4">
              {[
                { bg: "bg-brand-mint", n: "01", title: "Campus meals", text: "Affordable meals from food spots around OOU Sagamu campus.", visual: <span className="rotate-[-6deg] text-[80px] drop-shadow-[6px_8px_0_rgba(12,81,63,0.12)] min-[769px]:text-[110px]">🍛</span>, delay: false },
                { bg: "bg-brand-blue", n: "02", title: "Campus delivery", text: "Get food brought closer to where you are.", visual: <span className="rotate-[-8deg] text-[80px] drop-shadow-[6px_8px_0_rgba(17,17,17,0.12)] min-[769px]:text-[105px]">🛵</span>, delay: true },
                { bg: "bg-brand-pink", n: "03", title: "Drinks & snacks", text: "Find quick bites when you need them.", visual: <span className="text-6xl drop-shadow-[5px_6px_0_rgba(17,17,17,0.12)] min-[769px]:text-[85px]">🥤🍟</span>, delay: false },
                { bg: "bg-brand-yellow-pastel", n: "04", title: "Local vendors", text: "Discover food businesses serving the OOU Sagamu campus community.", visual: <span className="text-[80px] drop-shadow-[6px_8px_0_rgba(17,17,17,0.12)] min-[769px]:text-[110px]">🏪</span>, delay: true },
              ].map((c) => (
                <Reveal key={c.n} delay={c.delay}>
                  <article className={`relative flex min-h-[320px] flex-col rounded-[34px] border-2 border-brand-green p-6 pb-9 shadow-[0_8px_0_#0c513f] transition hover:-translate-y-1.5 hover:shadow-[0_14px_0_#0c513f] min-[769px]:min-h-[420px] min-[769px]:p-[30px] ${c.bg}`}>
                    <span className="self-start rounded-full bg-brand-green/[0.12] px-2.5 py-1 font-display text-[13px] font-extrabold text-brand-green">{c.n}</span>
                    <div className="flex h-[150px] items-center justify-center min-[769px]:h-[190px]">{c.visual}</div>
                    <h3 className="mb-2 font-display text-xl font-extrabold tracking-[-0.04em] text-brand-ink min-[769px]:text-2xl">{c.title}</h3>
                    <p className="max-w-[210px] text-sm leading-[1.5] text-brand-ink-soft">{c.text}</p>
                    <a
                      href="#waitlist"
                      onClick={(e) => { e.preventDefault(); openWaitlist(); }}
                      aria-label={`Join waitlist for ${c.title}`}
                      className="absolute bottom-5 right-5 flex h-11 w-11 items-center justify-center rounded-full border-2 border-brand-green bg-white text-xl font-extrabold text-brand-green shadow-[2px_2px_0_#0c513f] transition hover:-translate-y-0.5 hover:bg-brand-green-light"
                    >
                      ↗
                    </a>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* STEPS */}
        <section id="how-it-works" className="border-y-2 border-brand-green bg-brand-green px-0 py-16 text-white min-[769px]:py-[100px]">
          <div className="mx-auto w-[min(1200px,calc(100%-48px))]">
            <div className="mb-8 flex flex-col items-start gap-4 min-[769px]:mb-[50px] min-[769px]:flex-row min-[769px]:items-end min-[769px]:justify-between">
              <Reveal>
                <p className="mb-4 inline-block rounded-full bg-white/[0.15] px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-yellow">04 / No long story</p>
                <h2 className="font-display text-[32px] font-extrabold leading-[1.02] tracking-[-0.05em] text-white min-[769px]:text-[68px]">
                  Food in <em className="not-italic text-brand-yellow">3</em><br />simple moves.
                </h2>
              </Reveal>
              <Reveal className="max-w-[280px] text-[15px] leading-[1.6] text-[#D4EDDF]">
                From craving to chow, keep it moving. We&rsquo;re making your campus food run feel less like a mission.
              </Reveal>
            </div>
            <div className="grid grid-cols-1 gap-6 min-[769px]:grid-cols-3">
              {[
                { n: "01", icon: "⌕", sub: "🍔", title: "Find your food", text: "Browse meals, snacks, drinks and food vendors around campus.", delay: false },
                { n: "02", icon: "☑", sub: "✦", title: "Place your order", text: "Choose what you want and confirm your order in a few taps.", delay: true },
                { n: "03", icon: "↗", sub: "🍛", title: "Chow time", text: "Your food gets prepared and delivered to your selected location.", delay: false },
              ].map((s) => (
                <Reveal key={s.n} delay={s.delay}>
                  <article className="rounded-[28px] border-[1.5px] border-white/20 bg-white/[0.08] p-7 transition hover:-translate-y-1.5 hover:bg-white/[0.12] min-[769px]:p-8">
                    <span className="inline-block rounded-full bg-brand-yellow/[0.15] px-3 py-1 font-display text-sm font-extrabold text-brand-yellow">{s.n}</span>
                    <div className="relative flex h-[100px] items-center justify-center font-accent text-6xl text-brand-yellow min-[769px]:h-[140px] min-[769px]:text-[80px]">
                      {s.icon}
                      <i className="absolute right-[26%] top-8 not-italic text-3xl drop-shadow-[4px_4px_0_rgba(0,0,0,0.2)]">{s.sub}</i>
                    </div>
                    <h3 className="mb-2.5 font-display text-xl font-extrabold tracking-[-0.035em] text-white min-[769px]:text-2xl">{s.title}</h3>
                    <p className="text-[15px] leading-[1.55] text-[#D4EDDF]">{s.text}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* CAMPUS LIFE / APP DOWNLOAD */}
        <section className="bg-brand-dark-bg px-0 py-16 text-white min-[769px]:py-[100px]">
          <div className="mx-auto grid w-[min(1200px,calc(100%-48px))] grid-cols-1 gap-6 min-[1025px]:grid-cols-[1.1fr_0.9fr]">
            <Reveal className="flex flex-col justify-between rounded-[34px] border border-white/[0.15] bg-brand-green p-8 shadow-[0_20px_50px_rgba(0,0,0,0.4)] min-[769px]:p-14">
              <div>
                <p className="mb-4 inline-block rounded-full bg-white/[0.15] px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-yellow-pastel">05 / Very much on purpose</p>
                <h2 className="my-4 font-display text-[28px] font-extrabold leading-[1.05] tracking-[-0.045em] text-white min-[769px]:text-[56px]">
                  Built around your <em className="not-italic text-brand-yellow">campus life.</em>
                </h2>
                <p className="mb-9 max-w-[440px] text-base leading-[1.6] text-[#D4EDDF]">
                  From lectures to late-night study sessions, Chow45 is designed around the way OOU Sagamu campus students actually move, eat, study and hang out.
                </p>
              </div>
              <div>
                <div className="mb-7 flex max-w-[320px] flex-col gap-3.5">
                  <button onClick={openWaitlist} className="flex items-center gap-3 rounded-full bg-white px-[22px] py-3.5 font-display text-sm font-bold text-brand-ink shadow-[0_6px_20px_rgba(0,0,0,0.15)] transition hover:-translate-y-1 hover:bg-[#F4F4F0]">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" fill="currentColor" /></svg>
                    <span>Download on Google Play</span>
                  </button>
                  <button onClick={openWaitlist} className="flex items-center gap-3 rounded-full bg-white px-[22px] py-3.5 font-display text-sm font-bold text-brand-ink shadow-[0_6px_20px_rgba(0,0,0,0.15)] transition hover:-translate-y-1 hover:bg-[#F4F4F0]">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.86c.66-.82 1.11-1.96.99-3.1-.96.04-2.12.64-2.8 1.44-.6.69-1.13 1.83-1 2.94 1.07.08 2.16-.46 2.81-1.28z" /></svg>
                    <span>Download on App Store</span>
                  </button>
                </div>
                <a href="#waitlist" onClick={(e) => { e.preventDefault(); openWaitlist(); }} className="inline-flex items-center gap-1.5 border-b-[1.5px] border-brand-yellow-pastel pb-0.5 text-sm font-bold text-brand-yellow-pastel transition hover:border-white hover:text-white">
                  Get early access <span>↗</span>
                </a>
              </div>
            </Reveal>

            <Reveal delay className="flex flex-col justify-between gap-6 rounded-[34px] border border-white/[0.12] bg-brand-dark-card p-6 min-[769px]:p-9">
              <div className="border-b border-white/10 pb-5">
                <div className="flex items-center gap-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg">←</span>
                  <div className="flex items-center gap-2.5">
                    <strong className="font-display text-[26px] font-extrabold text-white">4.3</strong>
                    <span className="tracking-[2px] text-brand-yellow">★★★★★</span>
                    <small className="text-xs text-[#999]">(629 reviews)</small>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                {[
                  { bg: "bg-brand-pink", icon: "✎", title: "Between lectures", sub: "quick bite energy" },
                  { bg: "bg-brand-yellow-pastel", icon: "☾", title: "Hostel evenings", sub: "no shoes required" },
                  { bg: "bg-brand-mint", icon: "⌁", title: "Study sessions", sub: "fuel the focus" },
                  { bg: "bg-brand-blue", icon: "✷", title: "Weekend cravings", sub: "make it a good one" },
                ].map((m) => (
                  <div key={m.title} className={`flex flex-col rounded-[20px] border-2 border-brand-ink p-4 shadow-[4px_4px_0_rgba(0,0,0,0.3)] transition hover:-translate-y-1 min-[769px]:p-[22px] ${m.bg}`}>
                    <span className="mb-2 text-2xl min-[769px]:mb-3 min-[769px]:text-[32px]">{m.icon}</span>
                    <strong className="font-display text-base font-extrabold leading-[1.05] tracking-[-0.04em] text-brand-ink min-[769px]:text-xl">{m.title.split(" ")[0]}<br />{m.title.split(" ").slice(1).join(" ")}</strong>
                    <small className="mt-2 text-[11px] font-bold uppercase tracking-[0.06em] text-brand-ink-soft">{m.sub}</small>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* VENDORS */}
        <section id="vendors" className="border-y-2 border-brand-green bg-brand-yellow-pastel px-0 py-16 text-brand-ink min-[769px]:py-[100px]">
          <div className="mx-auto grid w-[min(1200px,calc(100%-48px))] grid-cols-1 items-center gap-9 min-[1025px]:grid-cols-[1.1fr_0.9fr] min-[1025px]:gap-[50px]">
            <Reveal>
              <p className="mb-4 inline-block rounded-full bg-brand-green/[0.08] px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-green">06 / For the people who make the food</p>
              <h2 className="font-display text-[32px] font-extrabold leading-[1.02] tracking-[-0.05em] text-brand-ink min-[769px]:text-[64px]">
                Got food to sell?<br />Let&rsquo;s put it <em className="not-italic text-brand-green">on campus.</em>
              </h2>
              <p className="my-6 max-w-[480px] text-base leading-[1.6]">Chow45 helps food businesses around OOU Sagamu campus reach more hungry customers without relying only on walk-ins.</p>
              <button onClick={openWaitlist} className="inline-flex items-center gap-2.5 rounded-full bg-brand-ink px-6 py-[13px] text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#252522]">
                Join as a vendor <span>↗</span>
              </button>
            </Reveal>
            <Reveal delay className="rounded-[34px] border-2 border-brand-green bg-white p-6 shadow-[0_8px_0_#0c513f] min-[769px]:p-9">
              {[
                { n: "01", label: "Reach more customers" },
                { n: "02", label: "Receive digital orders" },
                { n: "03", label: "Grow your campus customer base" },
                { n: "04", label: "Simple ordering experience" },
              ].map((v, idx, arr) => (
                <div key={v.n} className={`flex items-center gap-5 py-4 font-display text-base font-extrabold tracking-[-0.02em] min-[769px]:text-lg ${idx !== arr.length - 1 ? "border-b-[1.5px] border-brand-green/[0.12]" : ""}`}>
                  <b className="rounded-full bg-brand-green-light px-2.5 py-1 text-xs text-brand-green">{v.n}</b>
                  <span>{v.label}</span>
                </div>
              ))}
            </Reveal>
          </div>
        </section>

        {/* COMMUNITY */}
        <section className="bg-brand-paper px-0 py-16 min-[769px]:py-[100px]">
          <div className="mx-auto w-[min(1200px,calc(100%-48px))]">
            <Reveal className="relative min-h-fit overflow-hidden rounded-[34px] border-2 border-brand-green bg-brand-mint p-8 shadow-[0_10px_0_#0c513f] min-[769px]:flex min-[769px]:min-h-[440px] min-[769px]:items-center min-[769px]:p-[64px_70px]">
              <div className="absolute left-7 top-7 hidden text-3xl text-brand-green min-[769px]:block">✦</div>
              <div className="relative z-[2] max-w-[480px]">
                <p className="mb-4 inline-block rounded-full bg-brand-green/[0.08] px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-green">07 / You&rsquo;re invited</p>
                <h2 className="font-display text-[28px] font-extrabold leading-[1.02] tracking-[-0.05em] text-brand-ink min-[769px]:text-[60px]">
                  Be part of the first<br /><em className="not-italic text-brand-green">Chow45 crowd.</em>
                </h2>
                <p className="my-6 text-base leading-[1.6]">We&rsquo;re building Chow45 with the OOU Sagamu campus community. Get early access, launch updates and first looks at what&rsquo;s coming.</p>
                <button onClick={openWaitlist} className="inline-flex items-center gap-2.5 rounded-full bg-brand-ink px-6 py-[13px] text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#252522]">
                  Join the waitlist <span>↗</span>
                </button>
              </div>
              <div className="relative mt-10 hidden h-[340px] w-[260px] min-[769px]:absolute min-[769px]:right-20 min-[769px]:top-[50px] min-[769px]:mt-0 min-[769px]:block">
                <div className="absolute left-[15px] top-[15px] w-[190px] rounded-2xl border-[3px] border-brand-ink bg-brand-cream p-4 font-display text-base font-extrabold leading-none shadow-[6px_6px_0_#111111] -rotate-[10deg]">
                  first chow<br /><strong className="mt-1.5 block text-[28px]">club</strong>
                </div>
                <div className="absolute right-0 top-[85px] w-[190px] rotate-[8deg] rounded-2xl border-[3px] border-brand-ink bg-brand-orange p-4 font-display text-base font-extrabold leading-none text-white shadow-[6px_6px_0_#111111]">
                  OOU Sagamu<br /><strong className="mt-1.5 block text-[28px]">45</strong>
                </div>
                <div className="absolute bottom-2.5 left-2.5 w-[190px] -rotate-[4deg] rounded-2xl border-[3px] border-brand-ink bg-brand-green p-4 font-display text-base font-extrabold leading-none text-white shadow-[6px_6px_0_#111111]">
                  see you<br /><strong className="mt-1.5 block text-[28px]">soon ✦</strong>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="bg-brand-paper px-0 py-16 min-[769px]:py-[100px]">
          <div className="mx-auto grid w-[min(1200px,calc(100%-48px))] grid-cols-1 gap-9 min-[1025px]:grid-cols-[0.85fr_1.15fr] min-[1025px]:gap-[70px]">
            <Reveal>
              <p className="mb-4 inline-block rounded-full bg-brand-green/[0.08] px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-green">08 / Good questions</p>
              <h2 className="font-display text-[32px] font-extrabold leading-[1.08] tracking-[-0.05em] text-brand-ink min-[769px]:text-[68px]">
                Let&rsquo;s clear<br />that <em className="not-italic text-brand-green">up.</em>
              </h2>
            </Reveal>
            <Reveal delay>
              {faqs.map((item, idx) => (
                <details key={item.q} open={idx === 0} className="group mb-3.5 rounded-[20px] border-[1.5px] border-brand-green/[0.14] bg-white p-5 transition open:border-brand-green open:bg-brand-green-light">
                  <summary className="flex cursor-pointer list-none items-center justify-between font-display text-base font-extrabold tracking-[-0.02em] text-brand-ink marker:content-none [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span className="text-2xl font-normal text-brand-green transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3.5 text-[15px] leading-[1.6] text-brand-ink-soft">{item.a}</p>
                </details>
              ))}
            </Reveal>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="relative overflow-hidden border-t-2 border-brand-green bg-brand-green px-0 py-20 text-center text-white min-[769px]:py-[120px]">
          <div className="absolute left-[12%] top-[20%] hidden text-[50px] text-brand-yellow min-[769px]:block">✦</div>
          <div className="absolute bottom-[25%] right-[14%] hidden rotate-[-12deg] text-8xl text-brand-yellow min-[769px]:block">🍟</div>
          <Reveal className="relative z-[2] mx-auto max-w-[650px] w-[min(1200px,calc(100%-48px))]">
            <p className="mb-4 inline-block rounded-full bg-white/[0.15] px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-yellow">One last thing</p>
            <h2 className="my-4 font-display text-[36px] font-extrabold leading-[1.02] tracking-[-0.05em] text-white min-[769px]:text-[76px] min-[769px]:leading-[0.98]">
              Your next chow<br /><em className="not-italic text-brand-yellow">starts here.</em>
            </h2>
            <p className="mx-auto mb-9 max-w-[440px] text-base leading-[1.6] text-[#D4EDDF]">
              Join the Chow45 waitlist and be among the first people to experience easier food ordering around OOU Sagamu campus.
            </p>
            <button onClick={openWaitlist} className="inline-flex items-center gap-2.5 rounded-full bg-white px-8 py-4 text-base font-bold text-brand-green transition hover:bg-brand-yellow hover:text-brand-ink">
              Join the waitlist <span>↗</span>
            </button>
          </Reveal>
          <div className="pointer-events-none absolute inset-x-0 bottom-[-10px] text-4xl tracking-[8px] opacity-25 min-[769px]:bottom-[-20px] min-[769px]:text-[90px] min-[769px]:tracking-[50px]">
            🍔 <span>🥤</span> 🍛
          </div>
        </section>
      </main>

      {/* WAITLIST MODAL */}
      {modalOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="waitlist-title" className="fixed inset-0 z-[60] flex items-center justify-center p-5">
          <div onClick={closeWaitlist} className="absolute inset-0 bg-[#0A0F0D]/65 backdrop-blur-sm" />
          <div className="relative z-[2] max-h-[94vh] w-[min(600px,100%)] animate-[modal-in_0.25s_ease] overflow-y-auto">
            <div className="relative rounded-[34px] border-2 border-brand-green bg-white p-6 shadow-[0_24px_60px_rgba(0,0,0,0.25)] min-[481px]:p-11">
              <button onClick={closeWaitlist} aria-label="Close waitlist form" className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-brand-green-light text-[22px] leading-none text-brand-green transition hover:bg-brand-green hover:text-white">×</button>

              {!submitted ? (
                <>
                  <div className="mb-6 flex items-center gap-5 border-b-[1.5px] border-brand-green/[0.14] pb-6">
                    <span className="flex h-14 w-14 -rotate-[10deg] items-center justify-center rounded-full border-2 border-brand-green bg-brand-green-light text-center font-display text-[10px] font-extrabold leading-[1.1] text-brand-green">CHOW45<br />OOU SAGAMU</span>
                    <div>
                      <p className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-green">Save your spot</p>
                      <h3 id="waitlist-title" className="font-display text-2xl font-extrabold tracking-[-0.04em] text-brand-ink">Let&rsquo;s get you fed.</h3>
                    </div>
                  </div>
                  <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 gap-4 min-[481px]:grid-cols-2">
                      <label className="mb-4 block text-[11px] font-extrabold uppercase tracking-[0.08em] text-brand-ink-soft">
                        Full name
                        <input name="name" type="text" placeholder="e.g. Teni Ade" required className="mt-2.5 block w-full border-0 border-b-2 border-[#D5D5CE] bg-transparent py-2 text-base font-medium text-brand-ink outline-none focus:border-brand-green" />
                      </label>
                      <label className="mb-4 block text-[11px] font-extrabold uppercase tracking-[0.08em] text-brand-ink-soft">
                        Email address
                        <input name="email" type="email" placeholder="you@email.com" required className="mt-2.5 block w-full border-0 border-b-2 border-[#D5D5CE] bg-transparent py-2 text-base font-medium text-brand-ink outline-none focus:border-brand-green" />
                      </label>
                    </div>
                    <div className="grid grid-cols-1 gap-4 min-[481px]:grid-cols-2">
                      <label className="mb-4 block text-[11px] font-extrabold uppercase tracking-[0.08em] text-brand-ink-soft">
                        Phone number
                        <input name="phone" type="tel" placeholder="080 0000 0000" required className="mt-2.5 block w-full border-0 border-b-2 border-[#D5D5CE] bg-transparent py-2 text-base font-medium text-brand-ink outline-none focus:border-brand-green" />
                      </label>
                      <label className="mb-4 block text-[11px] font-extrabold uppercase tracking-[0.08em] text-brand-ink-soft">
                        Are you a?
                        <select name="user_type" required defaultValue="" className="mt-2.5 block w-full border-0 border-b-2 border-[#D5D5CE] bg-transparent py-2 text-base font-medium text-brand-ink outline-none focus:border-brand-green">
                          <option value="" disabled>Choose one</option>
                          <option>Student</option>
                          <option>Staff</option>
                          <option>Vendor</option>
                          <option>Other</option>
                        </select>
                      </label>
                    </div>
                    <label className="mb-4 block text-[11px] font-extrabold uppercase tracking-[0.08em] text-brand-ink-soft">
                      Department / Faculty <span className="font-normal normal-case text-brand-muted">optional</span>
                      <input name="department" type="text" placeholder="Where do you spend most of your day?" className="mt-2.5 block w-full border-0 border-b-2 border-[#D5D5CE] bg-transparent py-2 text-base font-medium text-brand-ink outline-none focus:border-brand-green" />
                    </label>
                    <div className="mt-4 flex flex-col gap-3">
                      <button type="button" onClick={closeWaitlist} className="order-1 w-full rounded-full border-2 border-brand-green/20 bg-white px-6 py-3.5 text-center text-[15px] font-bold text-brand-ink transition hover:-translate-y-0.5 hover:border-brand-orange hover:bg-[#FFF5F2] hover:text-brand-orange">
                        Cancel
                      </button>
                      <button type="submit" className="order-2 flex w-full items-center justify-between rounded-full bg-brand-green px-6 py-4 text-[15px] font-bold text-white shadow-[0_6px_18px_rgba(12,81,63,0.2)] transition hover:-translate-y-0.5 hover:bg-brand-green-dark">
                        <span>Join the Chow45 waitlist</span>
                        <span>↗</span>
                      </button>
                    </div>
                    <p className="mt-4 text-center text-xs text-brand-muted">No spam. Just good news when Chow45 is ready.</p>
                  </form>
                </>
              ) : (
                <div aria-live="polite" className="p-5 text-center">
                  <div className="mx-auto mb-5 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-brand-green-bright text-3xl text-white">✓</div>
                  <p className="mb-2.5 inline-block rounded-full bg-brand-green/[0.08] px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-green">You&rsquo;re on the list 🎉</p>
                  <h3 className="mb-2.5 font-display text-[28px] font-extrabold tracking-[-0.04em] text-brand-green">See you around campus.</h3>
                  <p className="text-brand-ink-soft">Thanks for joining Chow45. We&rsquo;ll keep you posted when we&rsquo;re ready to serve your side of campus.</p>
                  <button onClick={closeWaitlist} className="mt-5 inline-flex items-center gap-2.5 rounded-full bg-brand-green px-7 py-3.5 text-sm font-bold text-white transition hover:bg-brand-green-dark">
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="border-t-2 border-brand-green bg-brand-green-dark px-0 py-16 text-brand-cream min-[769px]:py-20">
        <div className="mx-auto flex w-[min(1200px,calc(100%-48px))] flex-col justify-between gap-9 pb-14 min-[769px]:flex-row">
          <div>
            <a href="#top" className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-green px-[18px] py-2.5 text-white">
              <span className="flex items-center text-brand-yellow">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" /></svg>
              </span>
              <span className="font-display text-[19px] font-extrabold tracking-[-0.03em]">Chow<span className="text-brand-yellow">45</span></span>
            </a>
            <p className="text-[15px] leading-[1.5] text-[#B2D8C6]">Food ordering,<br />built for campus life.</p>
          </div>
          <div className="grid grid-cols-2 gap-8 min-[769px]:flex min-[769px]:gap-[90px]">
            <div className="flex flex-col gap-3">
              <b className="mb-1.5 text-[11px] uppercase tracking-[0.12em] text-brand-yellow">Company</b>
              <a href="#top" className="text-sm text-[#D4EDDF] transition hover:text-brand-yellow">About Chow45</a>
              <a href="mailto:hello@chow45.com" className="text-sm text-[#D4EDDF] transition hover:text-brand-yellow">Contact</a>
            </div>
            <div className="flex flex-col gap-3">
              <b className="mb-1.5 text-[11px] uppercase tracking-[0.12em] text-brand-yellow">Community</b>
              <a href="#waitlist" onClick={(e) => { e.preventDefault(); openWaitlist(); }} className="text-sm text-[#D4EDDF] transition hover:text-brand-yellow">For students</a>
              <a href="#waitlist" onClick={(e) => { e.preventDefault(); openWaitlist(); }} className="text-sm text-[#D4EDDF] transition hover:text-brand-yellow">For vendors</a>
              <a href="#faq" className="text-sm text-[#D4EDDF] transition hover:text-brand-yellow">FAQs</a>
            </div>
            <div className="flex flex-col gap-3">
              <b className="mb-1.5 text-[11px] uppercase tracking-[0.12em] text-brand-yellow">Social</b>
              <a href="#top" className="text-sm text-[#D4EDDF] transition hover:text-brand-yellow">Instagram</a>
              <a href="#top" className="text-sm text-[#D4EDDF] transition hover:text-brand-yellow">TikTok</a>
              <a href="#top" className="text-sm text-[#D4EDDF] transition hover:text-brand-yellow">X</a>
            </div>
          </div>
        </div>
        <div className="mx-auto flex w-[min(1200px,calc(100%-48px))] flex-col items-center justify-between gap-2.5 border-t border-white/[0.15] pt-6 text-xs text-[#92C0AC] min-[769px]:flex-row">
          <span>© 2026 Chow45. Built for the OOU Sagamu campus community.</span>
          <span>Made with care &amp; plenty chow.</span>
        </div>
      </footer>
    </>
  );
}