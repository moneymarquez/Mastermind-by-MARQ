/** Setup page catalog (Appendix 5, Part 2). One entry per thing to wire
 *  up: what it powers in plain language, how to get it click by click, what
 *  stops working without it, and which Worker secrets hold it. Shared by
 *  the Setup screen and the Worker (which only uses ids and secret names). */

export type SetupKind = 'platform' | 'account';
export interface SetupField { secret: string; label: string; placeholder?: string; hint?: string; optional?: boolean }
export interface SetupEntry {
  id: string;
  kind: SetupKind;
  name: string;
  powers: string;
  steps: { text: string; link?: string }[];
  withoutIt: string;
  fields: SetupField[];
  /** For account connections: 'oauth' opens the provider; 'token' pastes one. */
  connect?: 'oauth' | 'token';
  unlocks?: string[];
  testable: boolean;
  phase?: string;
  /** A placeholder for something deliberately not built yet: shown with
   *  its reason, no Connect button. */
  notStarted?: string;
}

export const PLATFORM_SETUP: SetupEntry[] = [
  {
    id: 'anthropic', kind: 'platform', name: 'Anthropic (Claude)', testable: true,
    powers: 'Every worker, the orchestrator, Nova, and the Morning Digest\'s ranking pass. Each call is metered in the cost ledger and stops at the daily cap.',
    steps: [
      { text: 'Open the Anthropic Console and sign in.', link: 'https://console.anthropic.com/settings/keys' },
      { text: 'Click "Create Key", name it mastermind-workers, and copy it. It is shown once.' },
      { text: 'Billing → add $10 of credit, then Billing → Limits → set a monthly spend limit as a backstop.', link: 'https://console.anthropic.com/settings/billing' },
      { text: 'Paste the key below and press Save, then Test.' },
    ],
    withoutIt: 'Workers can\'t run, Nova can\'t answer, and the digest sends its plain draft instead of a ranked one.',
    fields: [{ secret: 'ANTHROPIC_API_KEY', label: 'API key', placeholder: 'sk-ant-…' }],
  },
  {
    id: 'xai', kind: 'platform', name: 'Grok (xAI)', testable: true, phase: 'Texting',
    powers: 'Two-way texting: a text to the Mastermind number that isn\'t a digest command gets an AI reply, in the voice set in Settings (lead response by default). Optional: with no key, replies use Cloudflare\'s free Workers AI model; add a key to use Grok instead.',
    steps: [
      { text: 'Open the xAI console and sign in.', link: 'https://console.x.ai/' },
      { text: 'API Keys → Create API key, name it mastermind-texting, copy it.' },
      { text: 'Add a little credit and set a spend limit in Billing as a backstop.' },
      { text: 'Paste the key below and press Save, then Test.' },
    ],
    withoutIt: 'Replies still work, using Cloudflare\'s free Workers AI model (a bit less polished than Grok).',
    fields: [{ secret: 'XAI_API_KEY', label: 'API key', placeholder: 'xai-…' }],
  },
  {
    id: 'twilio', kind: 'platform', name: 'Twilio (texts)', testable: true,
    powers: 'The 5:30am Morning Digest and its reply commands (ECOM, dials 30, done), the two-way texting line (anyone who texts the number gets a Grok reply in lead-response mode), and SMS alerts like "Sale made" and "Store preview ready".',
    steps: [
      { text: 'Sign up at Twilio, verify your email and your phone.', link: 'https://www.twilio.com/try-twilio' },
      { text: 'Console → Phone Numbers → Buy a number → Toll-Free → buy one.', link: 'https://console.twilio.com/us1/develop/phone-numbers/manage/search' },
      { text: 'Messaging → Regulatory Compliance → Toll-Free Verification → submit with use case "Account notifications — a daily planning summary sent only to the account owner", under 100/month.', link: 'https://console.twilio.com/us1/develop/sms/regulatory-compliance/toll-free-verification' },
      { text: 'Copy the Account SID and Auth Token from the Console home page.', link: 'https://console.twilio.com/' },
      { text: 'Upgrade from trial (~$20) or every text starts with "Sent from your Twilio trial account".' },
      { text: 'Texting anyone besides yourself (leads, clients) from a 10-digit number needs A2P 10DLC registration: Messaging → Regulatory Compliance → A2P 10DLC → register the brand and a campaign. Until it\'s approved, Test shows "10DLC: not registered yet".', link: 'https://console.twilio.com/us1/develop/sms/regulatory-compliance/a2p-10dlc-overview' },
      { text: 'Paste all four values below, Save, Test. Then point the number\'s Messaging → "A message comes in" webhook at the texting line URL shown after Test (/api/sms/inbound). The digest reply commands keep working through it.' },
    ],
    withoutIt: 'The digest arrives as a push notification from the app instead of a text, and reply commands don\'t work.',
    fields: [
      { secret: 'TWILIO_ACCOUNT_SID', label: 'Account SID', placeholder: 'AC…' },
      { secret: 'TWILIO_AUTH_TOKEN', label: 'Auth Token' },
      { secret: 'TWILIO_FROM_NUMBER', label: 'Your Twilio number', placeholder: '+18885551234' },
      { secret: 'DIGEST_TO_NUMBER', label: 'Your cell', placeholder: '+1801…' },
    ],
  },
  {
    id: 'cloudflare_secrets', kind: 'platform', name: 'Cloudflare (lets this page save keys)', testable: true,
    powers: 'Lets the Save buttons on this page write Worker secrets directly, and reads Cloudflare Web Analytics for the Marketing tab.',
    steps: [
      { text: 'Cloudflare dashboard → My Profile → API Tokens → Create Token → Create Custom Token.', link: 'https://dash.cloudflare.com/profile/api-tokens' },
      { text: 'Permissions: Account → Workers Scripts → Edit, and Account → Account Analytics → Read. Account Resources: your account only.' },
      { text: 'Create, copy the token. Copy your Account ID from the right-hand side of any Workers page.' },
      { text: 'This one pair must be added by hand once: Workers & Pages → mastermind-by-marq → Settings → Variables and Secrets → Add → type Secret → CF_API_TOKEN, then CF_ACCOUNT_ID. After that, every other key on this page saves from here.', link: 'https://dash.cloudflare.com/?to=/:account/workers-and-pages' },
    ],
    withoutIt: 'Every key on this page has to be added by hand in the Cloudflare dashboard (the steps say where). Site visits don\'t show in Marketing.',
    fields: [{ secret: 'CF_API_TOKEN', label: 'API token' }, { secret: 'CF_ACCOUNT_ID', label: 'Account ID' }],
  },
  {
    id: 'push', kind: 'platform', name: 'Web push (app notifications)', testable: true,
    powers: 'Push notifications from Mastermind — the digest fallback, daily plan pings, reminders.',
    steps: [
      { text: 'These are usually set already (Daily Plan pushes use them). If not: run npx web-push generate-vapid-keys on any computer.' },
      { text: 'Add VITE_VAPID_PUBLIC_KEY as a build variable and a runtime variable, and VAPID_PRIVATE_KEY as a secret, in Cloudflare → Workers & Pages → mastermind-by-marq → Settings.' },
      { text: 'On iPhone, add Mastermind to your home screen, open it from there, and turn on push in Settings → Morning Digest.' },
    ],
    withoutIt: 'No push notifications at all, so the digest has no fallback while Twilio is pending.',
    fields: [{ secret: 'VITE_VAPID_PUBLIC_KEY', label: 'Public key' }, { secret: 'VAPID_PRIVATE_KEY', label: 'Private key' }],
  },
  {
    id: 'etsy', kind: 'platform', name: 'Etsy Open API', testable: true, phase: 'E-comm 3',
    powers: 'The Etsy Product Sheet from Etsy\'s official API instead of web search.',
    steps: [
      { text: 'Go to Etsy Developers → Create a New App (sign in with an Etsy account).', link: 'https://www.etsy.com/developers/register' },
      { text: 'Describe it as "personal product research"; you only need read access.' },
      { text: 'Copy the Keystring (that is the API key). Paste below, Save, Test.' },
    ],
    withoutIt: 'The Etsy sheet fills from web search, marked AI read.',
    fields: [{ secret: 'ETSY_API_KEY', label: 'Keystring' }],
  },
  {
    id: 'cj', kind: 'platform', name: 'CJ Dropshipping', testable: true, phase: 'E-comm 5',
    powers: 'Supplier Finder pulls real supplier prices, stock and ship times, and drafts sample orders.',
    steps: [
      { text: 'Sign up at CJ Dropshipping.', link: 'https://cjdropshipping.com/' },
      { text: 'Go to My CJ → Authorization → API → Generate API Key.', link: 'https://cjdropshipping.com/myCJ.html#/apikey' },
      { text: 'Copy the key, paste below, Save, Test.' },
    ],
    withoutIt: 'Supplier research falls back to web search; sample orders are drafted by hand.',
    fields: [{ secret: 'CJ_API_KEY', label: 'API key' }],
  },
  {
    id: 'parallel', kind: 'platform', name: 'Parallel (research)', testable: true, phase: 'October',
    powers: 'The research worker\'s web access: Product Scout and Audience Analyst search through Parallel, and Money Move researches each week\'s opportunity live and local. Every number keeps its source link.',
    steps: [
      { text: 'Sign up at Parallel and open the platform dashboard.', link: 'https://platform.parallel.ai/' },
      { text: 'API Keys → Create key, name it masterminds-research, copy it.' },
      { text: 'Search is about $1–5 per 1,000 calls; deep Task runs are $5 (Lite) to $100 (Pro) per 1,000. The research bucket in HQ caps it at $40 a month by default.' },
      { text: 'Paste the key below, Save, then Test (one cheap search).' },
    ],
    withoutIt: 'Scout and Analyst fall back to Claude\'s built-in web search; Money Move uses your profile only, without live local research.',
    fields: [{ secret: 'PARALLEL_API_KEY', label: 'API key' }],
  },
  {
    id: 'higgsfield', kind: 'platform', name: 'Higgsfield', testable: false, phase: 'E-comm 5 / Content 4',
    powers: 'Brand Lab mockups, content visuals, and the Clip Editor\'s enhancements.',
    steps: [
      { text: 'Sign in to Higgsfield and open the API / developer settings for your workspace.', link: 'https://higgsfield.ai/' },
      { text: 'Create an API key, paste below, Save.' },
      { text: 'The API has its own wallet, separate from a Higgsfield website subscription — the subscription does not pay for API calls. Top it up ($5–$25 to start) in the API dashboard.' },
      { text: 'There is no free test call for this one; it is checked the first time Brand Lab or the Clip Editor uses it. Every generation goes through the visual-spend cap in HQ ($60/month by default).' },
    ],
    withoutIt: 'Brand Lab gives written brand options with no mockups; the Clip Editor can\'t enhance clips.',
    fields: [{ secret: 'HIGGSFIELD_API_KEY', label: 'API key' }],
  },
];

export const ACCOUNT_SETUP: SetupEntry[] = [
  {
    id: 'instagram', kind: 'account', name: 'Instagram (Business or Creator)', testable: true, connect: 'oauth', phase: 'Content C2',
    powers: 'Your posts, views, reach, saves, shares and follower changes, pulled daily into Content → Accounts — and posts on your approval: the Publisher posts each approved Reel at its planned time.',
    unlocks: ['Content: approved posts go out on their own', 'Content: real account numbers and post grades', 'E-comm: post metrics for brand content', 'Digest: yesterday\'s post grades'],
    steps: [
      { text: 'In the Instagram app: Settings → Account type and tools → Switch to professional account → Creator or Business.' },
      { text: 'Mastermind\'s Instagram app has to exist first (a one-time developer setup, walked through in Platform Setup). Once it does, the Connect button below goes live.' },
      { text: 'Press Connect, log in to Instagram, approve (it asks for basic profile, insights and content publish). You come back here connected.' },
      { text: 'Connected before posting was added? Disconnect and Connect again — the old login can\'t post.' },
    ],
    withoutIt: 'Content numbers stay manual, and approved posts wait for you to post them by hand.',
    fields: [{ secret: 'INSTAGRAM_APP_ID', label: 'App ID (platform)' }, { secret: 'INSTAGRAM_APP_SECRET', label: 'App secret (platform)' }],
  },
  {
    id: 'tiktok', kind: 'account', name: 'TikTok', testable: true, connect: 'oauth', phase: 'Content C2',
    powers: 'Views, likes, comments and shares per video, pulled daily — and posts on your approval: the Publisher uploads each approved video at its planned time.',
    unlocks: ['Content: approved videos go out on their own', 'Content: TikTok account numbers and grades'],
    steps: [
      { text: 'Mastermind\'s TikTok app needs Login Kit, Display API and Content Posting API (Direct Post) approved by TikTok (days). Start it now in TikTok for Developers.', link: 'https://developers.tiktok.com/apps' },
      { text: 'Until TikTok audits the app, Direct Post only allows private (only-me) posts. The Publisher says so on each post it makes that way.' },
      { text: 'Once approved and the client key/secret are saved, press Connect and approve (user.info.basic, video.list, video.publish).' },
      { text: 'Connected before posting was added? Disconnect and Connect again — the old login can\'t post.' },
    ],
    withoutIt: 'TikTok numbers stay manual, and approved videos wait for you to post them by hand.',
    fields: [{ secret: 'TIKTOK_CLIENT_KEY', label: 'Client key (platform)' }, { secret: 'TIKTOK_CLIENT_SECRET', label: 'Client secret (platform)' }],
  },
  {
    id: 'shopify', kind: 'account', name: 'Shopify', testable: true, connect: 'token', phase: 'E-comm 7',
    powers: 'The one Shopify store behind every product site: products, checkout, payments and orders. The Launcher adds each approved product here and points that site\'s Buy button at this store\'s checkout.',
    unlocks: ['E-comm: live revenue, orders, conversion', 'Read loop: funnel from real orders'],
    steps: [
      { text: 'Name the store as a neutral parent brand (e.g. "MARQ Goods"), not a product. Every product site checks out through this one store, so its name and logo show on checkout, order emails and card statements. Settings → Store details for the name; Settings → Checkout → Customize for the checkout and email logo.' },
      { text: 'Open Shopify\'s Dev Dashboard (Settings → Apps → Develop apps → "Build apps in Dev Dashboard", or dev.shopify.com/dashboard) → Create app → name it Masterminds.', link: 'https://dev.shopify.com/dashboard' },
      { text: 'In the app\'s Versions/Configuration, add Admin API scopes: read_orders, read_products, write_products, write_publications, read_analytics. Release the version.' },
      { text: 'Install the app on your store (Home → Install app → pick this store). The app and the store must be in the same Shopify organization.' },
      { text: 'Settings → copy the Client ID and Client Secret, plus your store domain (yourstore.myshopify.com). Paste them below. Masterminds gets a fresh 24-hour token from them on its own.' },
      { text: 'Online Store → Preferences: remove the storefront password before launching, or customers hit it at checkout.' },
      { text: 'Older custom app with an shpat_ token? Paste that token instead of the Client ID/Secret (plus its API secret key for sale alerts).' },
    ],
    withoutIt: 'Brand cards show "Connect Shopify" instead of revenue.',
    fields: [
      { secret: 'shop', label: 'Store domain', placeholder: 'yourstore.myshopify.com' },
      { secret: 'client_id', label: 'Client ID (Dev Dashboard app)', placeholder: 'from the app\'s Settings', optional: true },
      { secret: 'client_secret', label: 'Client Secret (Dev Dashboard app)', placeholder: 'from the app\'s Settings', optional: true, hint: 'Also signs the sale alerts (order webhooks).' },
      { secret: 'token', label: 'or: Admin API access token (older custom app)', placeholder: 'shpat_…', optional: true },
      { secret: 'webhook_secret', label: 'API secret key (older custom app only)', placeholder: 'from the app\'s API credentials', optional: true, hint: 'Only for an shpat_ token: Shopify signs order webhooks with it.' },
    ],
  },
  {
    id: 'github', kind: 'account', name: 'GitHub (store repos only)', testable: true, connect: 'token', phase: 'E-comm 6',
    powers: 'Store Builder commits each store\'s code to a branch in its own repo — never to Mastermind.',
    unlocks: ['E-comm step 6: store builds and previews'],
    steps: [
      { text: 'GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.', link: 'https://github.com/settings/personal-access-tokens/new' },
      { text: 'Repository access: Only select repositories → pick the store repos only (not Mastermind).' },
      { text: 'Permissions: Contents Read and write, Pull requests Read and write, Metadata Read. Expiration 90 days.' },
      { text: 'Generate, copy, paste below.' },
    ],
    withoutIt: 'Store Builder can\'t create preview branches.',
    fields: [{ secret: 'token', label: 'Fine-grained token', placeholder: 'github_pat_…' }],
  },
  {
    id: 'cloudflare_pages', kind: 'account', name: 'Cloudflare Pages (store hosting)', testable: true, connect: 'token', phase: 'E-comm 6',
    powers: 'Hosts each store: the Launcher deploys the approved page to production (brand-store.pages.dev) the moment you approve it.',
    unlocks: ['E-comm step 6: approve → live store'],
    steps: [
      { text: 'Cloudflare → My Profile → API Tokens → Create Custom Token.', link: 'https://dash.cloudflare.com/profile/api-tokens' },
      { text: 'Permissions: Account → Cloudflare Pages → Edit. Account Resources: your account.' },
      { text: 'Copy the token and your Account ID, paste both below.' },
    ],
    withoutIt: 'Approved store pages can\'t go live.',
    fields: [{ secret: 'token', label: 'API token' }, { secret: 'account_id', label: 'Account ID' }],
  },
  {
    id: 'facebook', kind: 'account', name: 'Facebook Pages', testable: true, connect: 'oauth', phase: 'Content',
    powers: 'Your Facebook Pages, connected for posting on your approval and their engagement numbers. Facebook posting turns on after Instagram and TikTok are proven.',
    unlocks: ['Content: Facebook Page as a posting account'],
    steps: [
      { text: 'Use the same Meta developer app as Instagram: developers.facebook.com → your app → add the "Facebook Login for Business" product.', link: 'https://developers.facebook.com/apps' },
      { text: 'Add the redirect URL from Platform setup under Facebook Login → Settings → Valid OAuth Redirect URIs. Request pages_manage_posts and pages_read_engagement (pages_show_list comes with them so the app can see which Pages you run).' },
      { text: 'Save the app ID and secret in Platform setup (Facebook app ID / secret), then press Connect, pick your Pages and approve.' },
    ],
    withoutIt: 'Facebook Pages can\'t be posting accounts.',
    fields: [{ secret: 'FACEBOOK_APP_ID', label: 'App ID (platform)' }, { secret: 'FACEBOOK_APP_SECRET', label: 'App secret (platform)' }],
  },
  {
    id: 'amazon', kind: 'account', name: 'Amazon (Seller Central)', testable: false, phase: 'Not started',
    notStarted: 'Selling on Amazon (SP-API) is deliberately left out of this pass until Marq decides to build it. Product Scout already reads Amazon best-seller pages through web search.',
    powers: 'Placeholder — not built. Would list products and pull orders through Amazon\'s Selling Partner API.',
    steps: [],
    withoutIt: 'Nothing changes today; Amazon research still works through Product Scout.',
    fields: [],
  },
];

export const ALL_SETUP = [...PLATFORM_SETUP, ...ACCOUNT_SETUP];
/** Every Worker secret the Setup page is allowed to write. */
export const WRITABLE_SECRETS = PLATFORM_SETUP.flatMap((e) => e.fields.map((f) => f.secret)).concat(['INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET', 'TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET', 'TOKEN_ENCRYPTION_KEY']).filter((s) => s !== 'VITE_VAPID_PUBLIC_KEY');
