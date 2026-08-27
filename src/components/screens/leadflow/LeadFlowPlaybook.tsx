import { useState } from 'react';
import type { CSSProperties } from 'react';

type Block =
  | { type: 'heading'; text: string }
  | { type: 'para'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'callout'; text: string }
  | { type: 'entry'; title: string; text: string }
  | { type: 'pain'; emotional: string[]; financial: string[] }
  | { type: 'script'; lines: { label: string; text: string }[] };

interface Section {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  content: Block[];
}

const sections: Section[] = [
  {
    id: 'mindset',
    title: 'The Mindset',
    subtitle: 'How to think before you ever open your mouth',
    emoji: '🧠',
    content: [
      { type: 'heading', text: "Who You're Talking To" },
      { type: 'para', text: "The person on the other end of that door, phone, or conversation isn't a businessperson who decided to open a restaurant, a barbershop, or a plumbing company. They're a chef. A barber. A plumber. Someone who got so good at what they do that they bet their livelihood on it." },
      { type: 'para', text: "That's important — because it means the business side of things was never their focus. Not because they're not smart. Because their passion pulled them in a different direction. That blind spot is real, and it costs them money every single day." },
      { type: 'quote', text: "\"Most of the people I work with — chefs, plumbers, gym owners — they're the best at what they do. That's exactly why the business side gets left behind. That's not a knock, that's just how it goes. My job is to handle the side they never signed up for.\"" },
      { type: 'heading', text: 'The Wall' },
      { type: 'para', text: "The moment someone realizes you're a salesperson, a wall goes up. It's not personal — it's instinct. Your entire job in the first 60 seconds is to not look like a salesperson. The best way to do that? Show up like a customer, a neighbor, or someone who just noticed something. Ask questions. Let them give you the information. They'll tell you exactly what you need to pitch them — without realizing they're doing it." },
      { type: 'heading', text: 'The Soft Customer Angle' },
      { type: 'para', text: "Lead with curiosity, not product. The restaurant opener that works isn't 'I sell digital marketing.' It's 'I was trying to find your menu online and almost went somewhere else.' Now they're engaged. Now they're not defensive. Now they want to hear what you found." },
      { type: 'heading', text: 'FOMO + The Competitor Name Drop' },
      { type: 'para', text: "Nothing moves a business owner faster than hearing a specific competitor is ahead of them. Not a generic 'your competition' — a real name. Do 60 seconds of Google before every call or visit. Find who's ranking #1 in their space and city. Drop the name naturally." },
      { type: 'quote', text: "\"I'm not a barber — but I looked at what's happening in your area and Pete's Barbershop is running basically on autopilot. They've got everything set up so the business runs itself while they just focus on cuts. That's what I do.\"" },
      { type: 'heading', text: 'Sales is a Transfer of Energy' },
      { type: 'para', text: "When you knock on that door or pick up that phone, your energy is everything. If you walk in thinking you're asking for something, they feel it. If you walk in knowing you have something valuable — that confidence transfers. That certainty is what makes them lean in instead of cross their arms." },
      { type: 'callout', text: 'THE CORE BELIEF: "The service I offer is so valuable that the only reason this business owner isn\'t already on their knees asking me for help is because they don\'t have the information yet. My job isn\'t to convince them — it\'s to inform them. Once they see it, the sale takes care of itself."' },
    ],
  },
  {
    id: 'restaurants',
    title: 'Restaurants',
    subtitle: 'Pain points, pitch angles, and the close',
    emoji: '🍽️',
    content: [
      { type: 'heading', text: 'Who They Are' },
      { type: 'para', text: "Mostly passionate people — cooks, family recipe keepers, immigrants who built something from nothing. They work 70-hour weeks, take enormous pride in their food, and often have no idea why the tables are half-empty on a Tuesday. The ones who've been open 5+ years are exhausted and proud at the same time. They feel every slow night personally." },
      { type: 'pain', emotional: ["They poured everything into the food — and it still might not be enough.", "They watch a chain down the street stay packed and KNOW their food is better.", "Foot traffic is down and they don't know why — they question the food, staff, themselves. The real problem? Nobody can find them.", "Working 70+ hours a week and the bank account doesn't show it."], financial: ["Operating costs now average 92–101% of total revenue. Many are at a loss before taxes.", "DoorDash/UberEats take 15–30% per order. On a $25 order, that's $6+ gone before food and labor — often zero profit.", "No system to retain customers. Acquiring a new one costs 5–25x more than keeping one.", "Invisible in local search at the exact moments people are ready to spend — 'best tacos near me,' 'lunch open now.'"] },
      { type: 'heading', text: 'Entry Points' },
      { type: 'entry', title: 'ENTRY POINT 1 — The Empty Table Problem', text: "They feel the empty tables (symptom) but don't know it's a search visibility problem (cause). That gap is where you walk in." },
      { type: 'entry', title: 'ENTRY POINT 2 — The DoorDash Math', text: "If they're on DoorDash, they're likely giving away 25–30% per order and don't fully realize it. A direct ordering system keeps that money in their pocket. Frame it as math, not marketing." },
      { type: 'heading', text: 'How to Open' },
      { type: 'script', lines: [
        { label: 'In person', text: "\"Hey — I'll be straight with you, I'm not a customer. I help restaurants with their online presence and I was in the area. I looked you guys up before I walked in and noticed a few things that I thought might actually be worth mentioning. Is the owner around or is that you?\"" },
        { label: 'On the phone', text: "\"Hey, is this [Owner]? I'll be honest — I work with restaurants on their Google presence and online ordering setup, and I looked your place up before calling. I noticed a couple things I thought were worth a quick conversation. Is now a bad time or do you have two minutes?\"" },
        { label: 'What you noticed', text: "\"I searched [cuisine] in [city] and you're not really showing up. [Competitor] a few blocks over is coming up first with a lot more reviews. I don't know if that's something you've thought about, but that's the difference between someone finding them or finding you when they're hungry tonight.\"" },
      ] },
      { type: 'heading', text: "When They Say 'We're Doing Fine'" },
      { type: 'quote', text: "\"That's good to hear, honestly. I just know that when I searched [cuisine] near here, you weren't coming up — so whoever is doing fine is also leaving people on the table who can't find them. Might not matter to you, totally fair. Just figured it was worth saying.\"" },
      { type: 'heading', text: 'The Close' },
      { type: 'quote', text: "\"Basically what I'd do is get your Google listing cleaned up so you're showing up when people search nearby, help set up direct ordering so you're keeping more of what you make instead of handing 30% to DoorDash, and make sure your reviews are actually working for you. Nothing complicated. Would it be worth 20 minutes sometime this week to show you specifically what I'm seeing for your place?\"" },
    ],
  },
  {
    id: 'plumbers',
    title: 'Plumbers',
    subtitle: 'Pain points, pitch angles, and the close',
    emoji: '🔧',
    content: [
      { type: 'heading', text: 'Who They Are' },
      { type: 'para', text: "Plumbers became business owners the same way most tradespeople do — they got really good at a skill, took a leap, and suddenly found themselves running payroll, managing reviews, and wondering why the phone isn't ringing on a Tuesday in March. They're not lazy — they're just better at pipes than they are at Google." },
      { type: 'pain', emotional: ["They're proud of their reputation — and watching someone with less experience rank above them stings.", "Emergency calls are their lifeblood. Losing one because they didn't show up on Google first is money they never even knew they lost.", "Every slow week feels personal. They start wondering if the work is slipping when the real problem is the business is invisible."], financial: ["72% of homeowners search online before hiring a plumber. If they're not ranking, they're invisible to most of their market.", "A single emergency job — burst pipe, water heater failure — runs $400–$1,200+. Missing 2–3 calls a week is $50k+ a year walking out the door.", "No review system means their Google profile looks dead. Competitors with 200+ reviews win every time, even against better plumbers.", "No follow-up system means one-time customers never become repeat customers or referral sources."] },
      { type: 'entry', title: 'ENTRY POINT 1 — The Emergency Call They\'re Not Getting', text: "Ask them directly: when someone's pipe bursts at 9pm and searches 'emergency plumber near me,' is their number coming up? Then show them who is. That's FOMO and a reality check in one move." },
      { type: 'entry', title: 'ENTRY POINT 2 — The Review Gap', text: "Pull up their Google profile and a competitor's side by side. If the competitor has 3x the reviews, the customer doesn't even consider them — they're not comparing quality, they're comparing perceived trust." },
      { type: 'script', lines: [
        { label: 'Opener', text: "\"Hey, is this [Owner]? My name's [Name] — I'll be straight with you, I help plumbing companies with their Google presence and I'm calling because I looked you up before dialing. You're not showing up when people search for emergency plumbers in [city]. [Competitor] is sitting at the top. I don't know if that's something on your radar or not, but I figured it was worth a call.\"" },
        { label: 'If they say referrals are their thing', text: "\"That's honestly a good sign — means people trust you. I get it. I just know that when a pipe bursts at 9pm, that person isn't calling their neighbor for a recommendation. They're Googling and calling the first number they see. That customer would probably love your work — they just can't find you.\"" },
        { label: 'The close', text: "\"What I'd actually do is pretty straightforward — get your Google listing showing up properly so you're in the mix for those searches, set up a way to collect reviews automatically from the jobs you're already doing, and make sure your past customers hear from you before they need to call someone else. Would it be worth 20 minutes to show you what I'm seeing for your area?\"" },
      ] },
    ],
  },
  {
    id: 'electricians',
    title: 'Electricians',
    subtitle: 'Pain points, pitch angles, and the close',
    emoji: '⚡',
    content: [
      { type: 'heading', text: 'Who They Are' },
      { type: 'para', text: "Electricians are meticulous people. They have to be — their work has real stakes. They earned their license, they take the craft seriously, and most of them have been running on reputation and word of mouth for years. What they haven't been running on is visibility." },
      { type: 'pain', emotional: ["They take pride in safety and quality work — and it bothers them that a less-careful operator is getting the jobs because they have a slicker online presence.", "Panel upgrades, EV charger installs, and rewire jobs are high-ticket — and they're losing them to competitors who just showed up first on Google.", "Residential work is inconsistent. Feast or famine."], financial: ["EV charger installations average $1,000–$2,500 per job and demand is surging — but homeowners search online first and call whoever ranks.", "Panel upgrades run $2,000–$6,000. Missing 2 per month to a competitor who ranks higher is $50k+ per year.", "No review engine means their quality work stays invisible. A competitor with 300 reviews beats a better electrician with 40 — every time."] },
      { type: 'entry', title: 'ENTRY POINT 1 — The High-Ticket Job They\'re Losing', text: "EV charger installs and panel upgrades are the highest-ticket residential jobs in their market right now. If they're not ranking for those specific searches, they're handing those jobs to competitors. Make it concrete — search it in front of them." },
      { type: 'script', lines: [
        { label: 'Opener', text: "\"Hey, is this [Owner]? I'll be upfront — I help electrical companies with their Google presence and I looked you up before calling. I searched EV charger installs in [city] and [Competitor] is coming up first with a lot more reviews. I don't know if you've thought about that, but those are decent-sized jobs going to someone else just because of how the search results shake out.\"" },
        { label: 'If they mention word of mouth', text: "\"Yeah, and that's real — referrals are great leads. I'm just talking about the homeowner who just moved in and doesn't know anyone to ask yet. They search, they pick whoever shows up first and looks legit. That's a $2,000 job you weren't even in the running for.\"" },
        { label: 'The close', text: "\"What I'd do is get your Google profile showing up properly for the searches that matter in your area, make it easy to collect reviews from the jobs you're already finishing, and keep your past customers in the loop so you're their first call next time. Pretty simple stuff. Would 20 minutes this week be worth it to walk through what I'm seeing?\"" },
      ] },
    ],
  },
  {
    id: 'hvac',
    title: 'HVAC',
    subtitle: 'Pain points, pitch angles, and the close',
    emoji: '❄️',
    content: [
      { type: 'heading', text: 'Who They Are' },
      { type: 'para', text: "HVAC owners are tradespeople who became business owners by accident. They learned the craft, got good at it, and one day decided to go out on their own. Most are proud, hardworking, and genuinely skilled. What they are not is marketers. They grew on referrals and word of mouth, which worked — until it stopped being enough. Now they're riding a feast-or-famine cycle every single year and they know it, but they don't know how to get off it." },
      { type: 'pain', emotional: ["The feast-or-famine cycle is exhausting. Summer is chaos — overtime, back-to-back calls, record revenue. Then September hits and the shop goes quiet.", "They built their reputation on quality work and word of mouth — and they're proud of that. But word of mouth means someone else controls their growth."], financial: ["No maintenance plan means no recurring revenue — they start from zero every spring. Only 30% of homeowners schedule preventative HVAC maintenance.", "Companies with maintenance agreements earn 20–35% higher gross margins in slow seasons.", "Their existing customer list is a goldmine they're ignoring. Marketing to past customers returns $8–$12 per dollar spent. New customer acquisition returns just $3–$4."] },
      { type: 'heading', text: 'The Residual Play — Solar Panel Analogy' },
      { type: 'quote', text: "\"Most HVAC guys have a great summer and a really stressful winter. What I help set up is basically a system that earns you money in the slow months without you doing anything extra — through your existing customers, automated follow-ups, and a maintenance plan that runs on its own. Think of it like putting solar panels on your business. You set it up once, and it just keeps paying you back. You stop starting from zero every spring.\"" },
      { type: 'script', lines: [
        { label: 'Opener', text: "\"Hey, is this [Owner]? I'll be straight with you — I help HVAC companies with their online presence and I looked you up before calling. I searched emergency AC repair in [city] and [Competitor] is showing up first with a lot more reviews. I don't know if that's something you think about, but I figured it was worth a call.\"" },
        { label: 'The winter question', text: "\"Can I ask — how do your winters usually go? Because that's the thing I hear from almost every HVAC company. Summer's great, then it gets quiet and it's stressful. What I help set up is pretty much a way to smooth that out — your past customers get reminders before every season, you're showing up online year-round, not just when you're panicking in November.\"" },
        { label: 'The close', text: "\"What I'd actually do is get your Google listing working properly so you're showing up for the searches that matter, set up something simple so your past customers hear from you before each season, and keep your ads running consistently instead of on and off. Nothing crazy. Would it be worth 20 minutes this week to look at what's happening in your area specifically?\"" },
      ] },
    ],
  },
  {
    id: 'gyms',
    title: 'Fitness & Gyms',
    subtitle: 'Pain points, pitch angles, and the close',
    emoji: '💪',
    content: [
      { type: 'heading', text: 'Who They Are' },
      { type: 'para', text: "Gym owners became gym owners because they love fitness, not spreadsheets. Most started as trainers, fell in love with the community they built, and eventually opened their own place. Churn is quietly killing them. They sign new members every month and lose just as many through the back door — and they don't have a system to stop it." },
      { type: 'pain', emotional: ["They built a community they're proud of — and watching members quietly leave hurts personally, not just financially.", "January brings a flood of new signups. By March they're gone. This cycle repeats every year.", "They're competing with big-box gyms on one side and boutique studios on the other."], financial: ["The fitness industry loses 50% of new members within the first 6 months. Replacing a lost member costs 5x more than keeping one.", "Most gyms have no automated re-engagement system — members go quiet for 2 weeks and nobody notices until they cancel.", "Personal training and class upsells are their highest-margin revenue — and most aren't systematically offering them."] },
      { type: 'entry', title: 'ENTRY POINT 1 — The Leaky Bucket', text: "They're pouring new members in the top but losing them out the bottom with no system to stop it. Frame it as a retention problem, not a marketing problem." },
      { type: 'entry', title: 'ENTRY POINT 2 — The January Cliff', text: "Every gym owner lives through January every year. Bring it up. 'What happens to all those January signups by March?' They know. That emotional hook opens the door." },
      { type: 'script', lines: [
        { label: 'Opener', text: "\"Hey, is this [Owner]? I'll be straight — I help gyms with their online presence and member retention, and I looked you up before calling. I searched gyms in [city] and [Competitor] is showing up ahead of you with more reviews. Can I ask — what does your January-to-March usually look like?\"" },
        { label: 'The close', text: "\"Basically what I'd do is get your Google listing sorted so new people can find you, set up something simple to keep current members engaged before they disappear, and make it easy for your happy members to send you referrals. Nothing complicated. Would 20 minutes this week be worth it to walk through what I'm seeing?\"" },
      ] },
    ],
  },
  {
    id: 'realestate',
    title: 'Real Estate',
    subtitle: 'Pain points, pitch angles, and the close',
    emoji: '🏠',
    content: [
      { type: 'heading', text: 'Who They Are' },
      { type: 'para', text: "Real estate agents and small brokerages are hustlers — they live on commission, they live on referrals, and they live on relationships. The shift to online search has changed the game in ways most agents haven't caught up to." },
      { type: 'pain', emotional: ["They're relationship people in an increasingly algorithm-driven world — and that disconnect feels unfair.", "Every agent in town is competing for the same referrals from the same sphere.", "The pressure to stay visible on social, keep their database warm, and still be closing deals is relentless."], financial: ["87% of buyers start their home search online. Agents not showing up are invisible to the majority.", "A single closed transaction is worth $8,000–$20,000 in commission. Missing one lead per month due to poor visibility is $100k+ per year in lost potential.", "Zillow and Realtor.com charge $300–$1,000+/month per zip code for leads — and those leads are shared with multiple agents."] },
      { type: 'entry', title: 'ENTRY POINT 1 — The Zillow Trap', text: "Most agents are either paying Zillow a fortune for shared leads, or they're not generating online leads at all. Position what you do as the alternative — owning their own pipeline." },
      { type: 'entry', title: 'ENTRY POINT 2 — The Database They\'re Ignoring', text: "Every agent has a database of past clients and leads they haven't touched in months. Automated follow-up turns that cold list warm without them lifting a finger." },
      { type: 'script', lines: [
        { label: 'Opener', text: "\"Hey [Name] — I'll be upfront, I help real estate agents build their own lead pipeline so they're not dependent on Zillow or just referrals. I looked you up before reaching out and noticed [Top Agent] is showing up ahead of you for searches in [city]. Figured it was worth a conversation.\"" },
        { label: 'Database question', text: "\"Can I ask — how often are you actually touching your past clients right now? Because that list is almost always the most underused thing an agent has. People who already know you, already trust you — and if they're not hearing from you regularly, they'll just go with whoever they come across first.\"" },
        { label: 'The close', text: "\"What I'd do is get you showing up in local search so buyers and sellers find you without Zillow being in the middle, set up automated follow-up for your database, and handle your content so you stay visible without burning yourself out on it. Would 20 minutes this week be worth walking through what that looks like?\"" },
      ] },
    ],
  },
  {
    id: 'solar',
    title: 'Solar',
    subtitle: 'Pain points, pitch angles, and the close',
    emoji: '☀️',
    content: [
      { type: 'heading', text: 'Who They Are' },
      { type: 'para', text: "Solar companies sit in an interesting spot — they're selling a genuinely good product with real, measurable ROI, but they're operating in a market that got burned by bad actors. Independent solar companies are fighting that reputation every day, even when their own product and service is excellent." },
      { type: 'pain', emotional: ["They're selling something genuinely great, but the industry has a trust problem — and they're fighting that stigma on every single call.", "National installers are spending millions on ads. Independent companies feel invisible by comparison.", "The sales cycle is long — homeowners research for weeks before deciding. Without a nurture system, those leads go cold."], financial: ["Average solar installation runs $15,000–$30,000. A single closed deal missed due to a weak online presence is significant.", "70% of solar leads research online before requesting a quote.", "Referral programs, when systematized, generate leads at a fraction of the cost of paid acquisition — and close at a higher rate."] },
      { type: 'heading', text: 'The Trust Reframe' },
      { type: 'quote', text: "\"The national guys have the ad budget. They don't have what you have — actual customers in this area who can vouch for you by name. What we do is make that visible. Local trust beats national advertising for this product every time — if you know how to show it.\"" },
      { type: 'script', lines: [
        { label: 'Opener', text: "\"Hey, is this [Owner]? I'll be straight — I help independent solar companies with their online presence, and I looked you up before calling. When I searched solar installation in [city], [Competitor] is showing up ahead of you with a stronger review presence. I know local companies usually do better work than the nationals — the problem is homeowners don't know that before they click.\"" },
        { label: 'The close', text: "\"What I'd do is get your Google presence set up so you're actually showing up when people search locally, put in place a simple system so every finished install generates a review and ideally a referral, and set up some follow-up for the quotes that go quiet. Worth 20 minutes this week to look at it?\"" },
      ] },
    ],
  },
];

interface Theme { icon: string; color: string; }

function getTheme(title: string): Theme {
  const t = title.toLowerCase();
  if (t.includes('pain')) return { icon: '🎯', color: '#dc2626' };
  if (t.includes('close')) return { icon: '📈', color: '#16a34a' };
  if (t.includes('entry')) return { icon: '🚪', color: '#2563eb' };
  if (t.includes('open') || t.includes('talking') || t.includes('wall')) return { icon: '💬', color: '#2563eb' };
  if (t.includes('reframe') || t.includes('residual') || t.includes('fomo') || t.includes('soft') || t.includes('transfer') || t.includes('mindset')) return { icon: '💡', color: '#7c3aed' };
  if (t.includes('who they are')) return { icon: '👤', color: '#6b7280' };
  return { icon: '✦', color: '#6b7280' };
}

function renderBlock(block: Block, key: number, theme: Theme) {
  if (block.type === 'para') {
    return <p key={key} style={{ color: '#374151', lineHeight: 1.7, marginBottom: '0.85rem', fontSize: 'var(--text-label)' }}>{block.text}</p>;
  }
  if (block.type === 'quote') {
    return <p key={key} style={{ fontStyle: 'italic', color: '#374151', lineHeight: 1.7, fontSize: 14.5, margin: '0.4rem 0' }}>{block.text}</p>;
  }
  if (block.type === 'callout') {
    return <div key={key} style={{ background: '#111', color: '#fff', borderRadius: 'var(--radius-lg)', padding: '1.1rem 1.25rem', margin: '1rem 0', lineHeight: 1.7, fontSize: 'var(--text-label)' }}>{block.text}</div>;
  }
  if (block.type === 'entry') {
    return (
      <div key={key} style={{ background: '#f9fafb', borderRadius: 'var(--radius-md)', padding: '0.9rem 1.1rem', margin: '0.6rem 0' }}>
        <div style={{ fontWeight: 700, fontSize: 'var(--text-small)', color: theme.color, marginBottom: 4 }}>{block.title}</div>
        <p style={{ color: '#374151', margin: 0, fontSize: 'var(--text-body-lg)', lineHeight: 1.6 }}>{block.text}</p>
      </div>
    );
  }
  if (block.type === 'pain') {
    return (
      <div key={key} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '0.75rem 0' }}>
        <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
          <div style={{ fontWeight: 700, fontSize: 'var(--text-small)', color: '#dc2626', marginBottom: 8 }}>EMOTIONAL PAIN</div>
          {block.emotional.map((p, j) => (
            <div key={j} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626', marginTop: 6, flexShrink: 0 }} />
              <p style={{ fontSize: 'var(--text-body)', color: '#374151', margin: 0, lineHeight: 1.5 }}>{p}</p>
            </div>
          ))}
        </div>
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
          <div style={{ fontWeight: 700, fontSize: 'var(--text-small)', color: '#d97706', marginBottom: 8 }}>FINANCIAL PAIN</div>
          {block.financial.map((p, j) => (
            <div key={j} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#d97706', marginTop: 6, flexShrink: 0 }} />
              <p style={{ fontSize: 'var(--text-body)', color: '#374151', margin: 0, lineHeight: 1.5 }}>{p}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (block.type === 'script') {
    return (
      <div key={key} style={{ background: '#1e1e2e', borderRadius: 'var(--radius-lg)', padding: '1.1rem', margin: '0.75rem 0' }}>
        <div style={{ fontSize: 'var(--text-tiny)', color: '#6b7280', fontWeight: 600, marginBottom: 10, letterSpacing: '0.05em' }}>CALL SCRIPT</div>
        {block.lines.map((line, j) => (
          <div key={j} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 'var(--text-micro)', color: '#4ade80', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{line.label}</div>
            <div style={{ color: '#e2e8f0', fontSize: 'var(--text-body-lg)', lineHeight: 1.7, fontStyle: 'italic' }}>{line.text}</div>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

interface Group { title: string; items: Block[]; }

export default function LeadFlowPlaybook() {
  const [active, setActive] = useState('mindset');
  const section = sections.find((s) => s.id === active) ?? sections[0];

  const groups: Group[] = [];
  let current: Group | null = null;
  section.content.forEach((block) => {
    if (block.type === 'heading') {
      current = { title: block.text, items: [] };
      groups.push(current);
    } else if (current) {
      current.items.push(block);
    }
  });

  const scrollAreaStyle: CSSProperties = { flex: 1, overflowY: 'auto', padding: '2rem' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '1rem 0', marginBottom: '1rem', flexShrink: 0 }}>
        {sections.map((s) => (
          <button key={s.id} onClick={() => setActive(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 'var(--radius-pill)', border: active === s.id ? 'none' : '1px solid #e5e7eb', background: active === s.id ? '#16a34a' : '#fff', color: active === s.id ? '#fff' : '#374151', cursor: 'pointer', fontSize: 'var(--text-body)', fontWeight: active === s.id ? 600 : 500 }}>
            <span>{s.emoji}</span>{s.title}
          </button>
        ))}
      </div>

      <div style={scrollAreaStyle}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: 4, color: '#111' }}>{section.title}</h1>
            <p style={{ color: '#9ca3af', fontSize: 'var(--text-subhead)' }}>{section.subtitle}</p>
          </div>

          {groups.map((group, gi) => {
            const theme = getTheme(group.title);
            return (
              <div key={gi} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 'var(--radius-2xl)', padding: '1.5rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 'var(--text-subhead)' }}>{theme.icon}</span>
                  <span style={{ fontSize: 'var(--text-small)', fontWeight: 700, letterSpacing: '0.06em', color: theme.color, textTransform: 'uppercase' }}>{group.title}</span>
                </div>
                {group.items.map((block, i) => renderBlock(block, i, theme))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
