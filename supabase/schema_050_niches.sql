-- Mastermind by MARQ — Phase 50 schema (Brand Lab Factory, step 2: niche
-- presets). Run once, after schema_049_pricing_template_1500.sql. Safe to
-- re-run — seed is guarded on "no rows yet for this user".
--
-- A niche is pre-loaded research the generator reasons from, so the
-- operator isn't re-deriving "what does a plumbing site need" in his head
-- on every call. benchmark_sites is the field that compounds: every good
-- site he finds gets pasted in with a one-line note on why, and every
-- later prompt for that niche inherits it. Owner-only, same as every
-- Scaling-category table.
create table if not exists niches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  slug text not null,
  name text not null,
  buyer_context text not null default '',
  standard_sections text[] not null default '{}',
  required_functionality text[] not null default '{}',
  trust_signals text[] not null default '{}',
  common_mistakes text[] not null default '{}',
  visual_conventions text not null default '',
  -- [{ "url": "...", "note": "why it works" }]
  benchmark_sites jsonb not null default '[]',
  keywords text[] not null default '{}',
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);
alter table niches enable row level security;
drop policy if exists "owner only" on niches;
create policy "owner only" on niches for all
  using (auth.uid() = user_id and is_owner(auth.uid())) with check (auth.uid() = user_id and is_owner(auth.uid()));

-- ── Seed ────────────────────────────────────────────────────────────────
-- Same explicit-user-lookup pattern as schema_039/040: SQL Editor sessions
-- aren't authenticated, so auth.uid()-defaulted inserts can't be used.
-- Benchmark sites are deliberately left EMPTY on seed — those are the
-- operator's proprietary list, added one paste at a time, not something
-- to pre-fill with names that may be wrong by the time this runs.
do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users order by created_at asc limit 1;
  if v_user_id is null then
    return;
  end if;
  if exists (select 1 from niches where user_id = v_user_id) then
    return;
  end if;

  insert into niches (user_id, slug, name, buyer_context, standard_sections, required_functionality, trust_signals, common_mistakes, visual_conventions, keywords, sort_order) values
  (v_user_id, 'plumbing', 'Plumbing & HVAC',
    'Homeowners and property managers, usually mid-emergency (burst pipe, no heat, no hot water) or at a seasonal trigger (AC before summer, furnace before winter). Extremely urgent, low loyalty, decision made on the phone within minutes of landing. They are searching "near me" on a phone and calling the first credible result.',
    array['Hero with phone number and emergency CTA','Services grid (repair / install / maintenance)','Service area','Reviews','Why us / trust bar','Financing','About the team','Contact + booking'],
    array['Click-to-call button visible at every scroll position on mobile','Emergency / 24-7 call button','Quote or booking form with photo upload','Service-area map or zip list','Reviews feed (Google)','Financing application link'],
    array['License number visible','Insured and bonded','Years in business','Google review count and rating','Before / after photos','Upfront pricing promise','Brand-name equipment logos (Carrier, Trane, Rheem)','Warranty terms'],
    array['Phone number not tappable or buried','Generic stock photo of a smiling stranger in a polo','No service area stated so out-of-area calls waste time','Pricing hidden entirely','Slow load on mobile','No emergency path separate from scheduled work'],
    'Category reads as blue-and-white, bold sans, a truck photo, a badge wall. Breaking it toward a cleaner, calmer layout can signal "premium, trustworthy" — but the phone number and emergency path must stay louder than anything else. Do not trade urgency for elegance.',
    array['plumber near me','emergency plumber','water heater repair','AC repair','furnace repair','drain cleaning','HVAC installation'], 0),

  (v_user_id, 'roofing', 'Roofing',
    'Homeowners after a storm, a leak, or an insurance letter; sometimes a buyer during a home sale. High-ticket ($8k–$30k+), researched over days, heavily driven by insurance-claim handling and a free inspection offer. Trust is the whole sale — roofing has a scam reputation.',
    array['Hero with free inspection CTA','Services (replacement / repair / storm damage / gutters)','Insurance claim help','Materials and warranties','Project gallery','Reviews','Financing','Service area','Contact'],
    array['Free inspection request form','Click-to-call','Photo gallery with before/after','Financing application link','Reviews feed','Storm-damage checklist or lead magnet'],
    array['State license and insurance','Manufacturer certifications (GAF, Owens Corning)','Workmanship warranty years','Local address and years in business','Photo proof of real local jobs','BBB or Angi badge','Named crew, not anonymous'],
    array['Storm-chaser look — no local address, no faces','Gallery of manufacturer stock images instead of real jobs','Vague on warranty terms','No insurance-claim explanation','No pricing framing at all'],
    'Category reads as dark navy or red, shield badges, drone shots of roofs. Real local job photos beat any styling choice. A cleaner, more editorial layout differentiates from storm-chasers — but keep the inspection CTA and the local proof front and center.',
    array['roofing contractor','roof replacement','roof repair','storm damage roof','roof inspection','gutter installation'], 1),

  (v_user_id, 'dental', 'Dental',
    'Adults choosing a family or cosmetic dentist, often new to the area or switching after a bad experience; parents for kids; some emergency (toothache, chipped tooth). Insurance acceptance and online booking decide it more than anything else. Moderate urgency, high anxiety.',
    array['Hero with book-online CTA','Services (general / cosmetic / emergency / kids)','Meet the doctor and team','Insurance and financing','New patient info','Office tour and photos','Reviews','Location and hours','Contact'],
    array['Online booking (or a request-appointment form)','Click-to-call','New-patient forms download or link','Insurance list','Reviews feed','Map with hours'],
    array['Doctor credentials and photo','Real office photos','Insurance list','Google reviews','New patient specials','Emergency same-day availability','Cleanliness and technology mentions'],
    array['Stock photo of perfect white teeth','No insurance list so people call to ask','Booking buried under a phone-only flow','Clinical, cold layout that raises anxiety','No real staff faces'],
    'Category reads as teal or sky-blue, rounded, lots of white, a smiling model. Warmth and real faces reduce anxiety more than any color choice. Breaking toward a warmer, editorial look with the actual team works; going clinical or luxury-dark does not for family practices.',
    array['dentist near me','family dentist','cosmetic dentist','emergency dentist','teeth whitening','dental implants','invisalign'], 2),

  (v_user_id, 'medspa', 'Med Spa / Aesthetics',
    'Mostly women 28–55 researching a specific treatment (Botox, filler, laser, body contouring), comparing 2–3 providers on results and provider credentials. Considered purchase, repeat visits, referrals matter. Discretion and results photos drive the decision.',
    array['Hero with book-consult CTA','Treatments menu grouped by concern','Before / after gallery','Meet the providers (credentials)','Memberships and specials','Pricing or starting-at pricing','Reviews','Location and hours','Contact'],
    array['Online booking or consult request','Before/after gallery with consent-safe images','Treatment menu with starting prices','Membership signup or info','Reviews feed','Click-to-call and text'],
    array['Provider credentials (RN, NP, MD, PA)','Before/after photos of real clients','Product/brand names (Allergan, Galderma)','Reviews','Clean, medical-grade facility photos','Memberships or loyalty proof'],
    array['Generic luxury stock imagery, no real results','No pricing framing at all','Providers not named or credentialed','Treatment list without concern-based navigation','Slow, image-heavy pages on mobile'],
    'Category reads as blush, cream, gold, serif headlines, soft lighting. That look is expected and safe; the differentiator is real before/after and named providers. A more editorial, high-contrast direction can signal premium — keep imagery real and never obviously AI-generated for faces.',
    array['med spa near me','botox','dermal fillers','laser hair removal','body contouring','medical spa','aesthetics clinic'], 3),

  (v_user_id, 'restaurant', 'Restaurant / Food Truck',
    'Locals and visitors deciding where to eat in the next hour, mostly from a phone, often from Google Maps or Instagram. They want the menu, hours, location, and whether it looks good — in under ten seconds. Food trucks add "where are you today."',
    array['Hero with food photography and order/menu CTA','Menu','Hours and location (or today''s truck location)','Photos','Catering or events','Reviews','About / story','Contact and social'],
    array['Menu that renders on mobile (not a PDF)','Order online or order-ahead link','Google Maps link and hours','Truck location / schedule (trucks)','Catering inquiry form','Instagram feed or link'],
    array['Real food photos','Hours that are accurate','Google rating','Press or local mentions','Owner or chef story','Health and cleanliness cues (implicitly, via photos)'],
    array['Menu as a PDF or an image that can''t be read on a phone','Hours wrong or missing','Autoplay video or heavy hero that loads slowly on cellular','No location for a truck','Stock food photos'],
    'Category reads as warm, photo-first, big type. The rule: food photography carries it, everything else stays out of the way. Breaking toward a minimal, typographic look works only if the photos are strong; a text-heavy restaurant site loses.',
    array['restaurant near me','food truck','tacos near me','order online','catering','lunch near me'], 4),

  (v_user_id, 'auto', 'Auto Repair',
    'Drivers with a check-engine light, a noise, or a needed inspection; some fleet accounts. Urgent to moderate, price-sensitive, deeply distrustful of being upsold. Decision driven by reviews, transparency, and whether they can get in today.',
    array['Hero with call and schedule CTA','Services','Why us / transparency promise','Reviews','Specials and coupons','Fleet services','About the shop','Location and hours'],
    array['Click-to-call','Schedule service form','Coupons or specials block','Reviews feed','Map and hours','Text-us option'],
    array['ASE certifications','Years in business and family-owned','Warranty on repairs','Google reviews','Upfront estimate promise','Real shop and staff photos','Brands serviced'],
    array['No pricing or estimate framing so the upsell fear stays','Anonymous shop, no faces','Reviews hidden','Confusing service list','Not mobile-first when 90% of searches are'],
    'Category reads as red/black/gray, chrome, aggressive type. A calmer, more honest-looking layout with real people directly counters the industry''s trust problem — this is a niche where breaking convention toward plain and transparent wins.',
    array['auto repair near me','mechanic near me','brake repair','oil change','check engine light','transmission repair'], 5),

  (v_user_id, 'law', 'Law Firm',
    'People in a stressful moment (injury, arrest, divorce, immigration, estate) researching who can help, often late at night on a phone. High stakes, high anxiety, comparing 2–4 firms on practice-area fit, credentials, and whether the consult is free. Long consideration for some, immediate for criminal/injury.',
    array['Hero with free consult CTA and practice-area focus','Practice areas','Attorney bios','Results or case studies (where permitted)','Reviews and testimonials','Process / what to expect','FAQ','Contact and intake'],
    array['Consultation request form with case-type field','Click-to-call and text','Attorney bio pages','Live chat or after-hours contact option','Reviews feed','Practice-area pages'],
    array['Bar admissions and years practicing','Named attorneys with photos','Case results (with required disclaimers)','Awards and ratings (Avvo, Super Lawyers)','Reviews','Free consultation stated plainly','Office address'],
    array['Every-practice-area-for-everyone with no focus','Stock gavel and scales imagery','No named attorneys','Buried contact path','Results claims without disclaimers','Dense legal copy the client can''t read'],
    'Category reads as navy, gold, serif, columns, a courthouse. A more modern, plain-language, human layout differentiates strongly — clients want to feel understood, not intimidated. Keep credentials visible; drop the gavel.',
    array['personal injury lawyer','criminal defense attorney','divorce lawyer','immigration lawyer','estate planning attorney','lawyer near me'], 6),

  (v_user_id, 'gym', 'Gym / Fitness Studio',
    'Adults deciding whether to try a class or join, driven by a New Year, a friend, a life change, or moving nearby. They want the schedule, the price, and whether they''ll fit in — vibe matters as much as facts. Low urgency, high drop-off, free trial converts.',
    array['Hero with free trial CTA and vibe photography','Classes or programs','Schedule','Pricing and memberships','Coaches','Results and community','Reviews','Location and hours','Contact'],
    array['Free trial or intro offer signup','Class schedule (live, not a PDF)','Membership pricing','Coach bios','Reviews feed','Instagram feed','Map and hours'],
    array['Real member and coach photos','Coach certifications','Member results or transformations (with consent)','Google reviews','Clear pricing','Community proof (events, member count if real)'],
    array['Hidden pricing so people never call','Schedule as a PDF','Stock photos of models instead of real members','Intimidating, aggressive imagery for a beginner-friendly gym','No clear first step'],
    'Category reads as black, neon accent, high-contrast, motion. That fits performance gyms; for beginner-friendly or boutique studios a lighter, warmer, community-first look converts better. Choose based on who actually walks in.',
    array['gym near me','fitness studio','crossfit','personal trainer','group fitness classes','yoga studio','pilates'], 7),

  (v_user_id, 'realestate', 'Real Estate Agent',
    'Buyers and sellers, mostly from referral or a Zillow/Google search, evaluating whether an agent knows their specific neighborhood and has real results. Sellers care about recent sales and marketing; buyers care about responsiveness. Long consideration, high ticket, referral-driven.',
    array['Hero with home-value or search CTA','About the agent','Recent sales and results','Neighborhood guides','Buyer and seller process','Testimonials','Listings','Contact'],
    array['Home valuation request form','Listing search or MLS feed embed','Contact / consult form','Neighborhood pages','Testimonials feed','Click-to-call and text'],
    array['License and brokerage','Sold volume and count (real numbers only)','Recent sold listings with photos','Reviews (Zillow, Google)','Years in the local market','Professional headshot and video'],
    array['Generic brokerage template with no local specificity','Headshot only, no neighborhood knowledge shown','Testimonials without names','No home-value lead capture','Listings feed that''s empty or broken'],
    'Category reads as white, navy or black, serif, big listing photos, a headshot. Neighborhood-level content and real sold data differentiate more than styling. A more editorial, local-magazine feel positions the agent as the area expert.',
    array['real estate agent near me','homes for sale','sell my house','realtor','home value','buy a house'], 8),

  (v_user_id, 'landscaping', 'Landscaping',
    'Homeowners wanting a new yard, a cleanup, or recurring maintenance; some HOAs and commercial. Seasonal, visual, portfolio-driven. They want to see work like theirs, get a quote, and know the crew shows up. Moderate urgency, quote-driven.',
    array['Hero with quote CTA and best project photo','Services (design / install / maintenance / hardscape)','Project gallery','Process','Service area','Reviews','About the crew','Contact and quote form'],
    array['Quote request form with photo upload','Project gallery organized by service','Click-to-call','Service-area map or list','Reviews feed','Seasonal service signup (maintenance)'],
    array['Real project photos, before/after','License and insurance','Years in business','Reviews','Named owner and crew','Awards or associations'],
    array['Stock garden photos instead of real jobs','No service area','Quote form that asks too much','Gallery not organized by what the visitor wants','No maintenance/recurring offer'],
    'Category reads as green, earthy, photo-heavy. The photos are the product — layout should get out of the way. A cleaner, gallery-first, near-monochrome UI lets real work dominate and signals a design-led firm over a mow-and-blow outfit.',
    array['landscaping near me','landscape design','lawn care','hardscape','yard cleanup','sprinkler installation'], 9),

  (v_user_id, 'salon', 'Salon / Barber',
    'Clients picking a stylist or barber by vibe, price, and whether they can book now — largely from Instagram and Google. Repeat, relationship-based, referral-heavy. The booking link is the entire conversion.',
    array['Hero with book-now CTA','Services and prices','The team (stylists/barbers with photos)','Gallery','Reviews','Location and hours','Products','Contact'],
    array['Online booking link (Square, Booksy, Vagaro, GlossGenius)','Service menu with prices','Stylist profiles with Instagram links','Gallery or Instagram feed','Reviews feed','Map and hours'],
    array['Real work photos','Named stylists with photos','Prices listed','Reviews','Products carried','Clean, styled space photos'],
    array['No prices','Booking requires a phone call','Stock photos','Team not shown','Slow image loads on mobile'],
    'Category reads as black-and-white or moody, big photos, script or condensed type. The work photos and the booking button carry it. Match the shop''s actual personality — a barbershop and a color-specialist salon should not share a template.',
    array['barber near me','hair salon near me','haircut','balayage','mens haircut','hair color'], 10),

  (v_user_id, 'ecommerce', 'E-commerce (single product)',
    'A buyer who arrived from an ad or a social post, deciding in under a minute whether this one product solves their problem and whether the store is legit. Conversion depends on clarity, proof, and checkout friction. Returns and shipping policy matter more than most founders think.',
    array['Hero with product, one-line value prop, and buy CTA','Problem / solution','How it works','Social proof and reviews','Comparison or why-this-one','FAQ','Shipping, returns, guarantee','Buy section repeated','Footer with policies'],
    array['Add-to-cart and checkout (Stripe or Shopify)','Reviews block','Email capture','Variant or quantity selector if needed','Order tracking or account (optional)','Policy pages'],
    array['Real reviews with names and photos','Guarantee and return policy stated plainly','Shipping times','Press or UGC','Secure checkout badges','Founder story'],
    array['Invented review counts or testimonials','Vague on shipping and returns','Too many products for a single-product story','No mobile-first checkout','Hero that doesn''t show the product'],
    'Category reads as clean white, one bold accent, product photography on plain background. Motion and lifestyle imagery add energy but must not slow the page. Honest proof beats any styling — never fake reviews or scarcity.',
    array['buy online','free shipping','best [product]','reviews','30 day guarantee'], 11),

  (v_user_id, 'saas', 'SaaS / App',
    'A user or a buyer with a specific job to do, evaluating whether this tool does it, what it costs, and whether they can try it now. Product-led: the free trial or demo is the conversion. Comparisons and integrations matter. Skeptical of hype.',
    array['Hero with one-sentence value prop and try/demo CTA','Product screenshots or short demo','Features by job-to-be-done','Integrations','Pricing','Customers and logos (real only)','Security / trust','FAQ','Footer'],
    array['Signup or trial flow','Demo request form','Pricing table with plan toggle','Login link','Docs or help center link','Status page link (optional)'],
    array['Real customer logos (with permission)','Real screenshots, not mockups','Security and compliance mentions where true','Uptime or status','Founder or team','Public pricing'],
    array['Hero copy that says nothing ("empower your workflow")','Fake logos or invented customer counts','No pricing','Screenshots that are mockups','Features listed without the job they solve'],
    'Category reads as gradient blobs, purple accent, rounded cards, isometric illustrations. Breaking toward plain, dense, screenshot-led and monochrome signals a serious tool (the Linear/Vercel look). Product screenshots are the proof; keep them real.',
    array['software for','app for','best [category] tool','free trial','pricing','alternative to'], 12),

  (v_user_id, 'coaching', 'Coaching / Consulting',
    'An individual or business owner with a specific pain, evaluating whether this person is credible and whether working together is worth the money. Trust and specificity decide it; vague "transformation" language loses. Lead magnet or discovery call converts.',
    array['Hero with who-it''s-for and book-a-call CTA','The problem you solve','Who you are and why you','Offers / programs','Results and testimonials','Process','Lead magnet','FAQ','Contact'],
    array['Book-a-call scheduling embed','Lead magnet email capture','Application or intake form','Testimonials','Payment link for programs (Stripe)','Newsletter signup'],
    array['Named clients and specific results (with permission)','Credentials or track record','Real photos and video','Testimonials with names and faces','Press or speaking','Clear pricing or "starts at"'],
    array['Generic transformation copy with no specifics','Stock imagery of laptops and coffee','No named results','Hidden pricing and a hard-sell call','Too many offers'],
    'Category reads as warm neutrals, serif headlines, a big portrait. Specificity in copy differentiates more than any visual. A cleaner, more direct, evidence-first layout separates a real operator from the guru template.',
    array['business coach','consultant','[niche] coaching','book a call','free guide'], 13),

  (v_user_id, 'other', 'Other (freeform)',
    'No stored research. The operator describes the business and niche in their own words and the generator reasons from first principles: who buys, what triggers it, what the site must do, what trust looks like in that category.',
    array['Hero','Offer','Proof','How it works','About','FAQ','Contact'],
    array['Primary contact or conversion action','Contact form'],
    array['Whatever is real and verifiable for this business'],
    array['Guessing the niche''s conventions instead of asking','Inventing trust signals'],
    'Unknown category: derive conventions from the closest real analog, then decide whether to follow or break them. State the reasoning.',
    array[]::text[], 99);
end $$;
