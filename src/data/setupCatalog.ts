/** Setup page catalog (Appendix 5, Part 2). One entry per thing to wire
 *  up: what it powers in plain language, how to get it click by click, what
 *  stops working without it, and which Worker secrets hold it. Shared by
 *  the Setup screen and the Worker (which only uses ids and secret names). */

export type SetupKind = 'platform' | 'account';
export interface SetupField { secret: string; label: string; placeholder?: string; hint?: string }
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
    id: 'twilio', kind: 'platform', name: 'Twilio (Morning Digest texts)', testable: true,
    powers: 'The 5:30am text from "Morning Digest" and the reply commands (ECOM, dials 30, done).',
    steps: [
      { text: 'Sign up at Twilio, verify your email and your phone.', link: 'https://www.twilio.com/try-twilio' },
      { text: 'Console → Phone Numbers → Buy a number → Toll-Free → buy one.', link: 'https://console.twilio.com/us1/develop/phone-numbers/manage/search' },
      { text: 'Messaging → Regulatory Compliance → Toll-Free Verification → submit with use case "Account notifications — a daily planning summary sent only to the account owner", under 100/month.', link: 'https://console.twilio.com/us1/develop/sms/regulatory-compliance/toll-free-verification' },
      { text: 'Copy the Account SID and Auth Token from the Console home page.', link: 'https://console.twilio.com/' },
      { text: 'Upgrade from trial (~$20) or every text starts with "Sent from your Twilio trial account".' },
      { text: 'Paste all four values below, Save, Test. Then set the reply webhook (shown after Test) under the number\'s Messaging → "A message comes in".' },
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
    id: 'higgsfield', kind: 'platform', name: 'Higgsfield', testable: false, phase: 'E-comm 5 / Content 4',
    powers: 'Brand Lab mockups, content visuals, and the Clip Editor\'s enhancements.',
    steps: [
      { text: 'Sign in to Higgsfield and open the API / developer settings for your workspace.', link: 'https://higgsfield.ai/' },
      { text: 'Create an API key, paste below, Save.' },
      { text: 'There is no free test call for this one; it is checked the first time Brand Lab or the Clip Editor uses it.' },
    ],
    withoutIt: 'Brand Lab gives written brand options with no mockups; the Clip Editor can\'t enhance clips.',
    fields: [{ secret: 'HIGGSFIELD_API_KEY', label: 'API key' }],
  },
];

export const ACCOUNT_SETUP: SetupEntry[] = [
  {
    id: 'instagram', kind: 'account', name: 'Instagram (Business or Creator)', testable: true, connect: 'oauth', phase: 'Content C2',
    powers: 'Your posts, views, reach, saves, shares and follower changes, pulled daily into Content → Accounts.',
    unlocks: ['Content: real account numbers and post grades', 'E-comm: post metrics for brand content', 'Digest: yesterday\'s post grades'],
    steps: [
      { text: 'In the Instagram app: Settings → Account type and tools → Switch to professional account → Creator or Business.' },
      { text: 'Mastermind\'s Instagram app has to exist first (a one-time developer setup, walked through in Platform Setup). Once it does, the Connect button below goes live.' },
      { text: 'Press Connect, log in to Instagram, approve. You come back here connected.' },
    ],
    withoutIt: 'Content numbers stay manual.',
    fields: [{ secret: 'INSTAGRAM_APP_ID', label: 'App ID (platform)' }, { secret: 'INSTAGRAM_APP_SECRET', label: 'App secret (platform)' }],
  },
  {
    id: 'tiktok', kind: 'account', name: 'TikTok', testable: true, connect: 'oauth', phase: 'Content C2',
    powers: 'Views, likes, comments and shares per video, pulled daily.',
    unlocks: ['Content: TikTok account numbers and grades'],
    steps: [
      { text: 'Mastermind\'s TikTok app needs Login Kit + Display API approved by TikTok (days). Start it now in TikTok for Developers.', link: 'https://developers.tiktok.com/apps' },
      { text: 'Once approved and the client key/secret are saved, press Connect and approve.' },
    ],
    withoutIt: 'TikTok numbers stay manual.',
    fields: [{ secret: 'TIKTOK_CLIENT_KEY', label: 'Client key (platform)' }, { secret: 'TIKTOK_CLIENT_SECRET', label: 'Client secret (platform)' }],
  },
  {
    id: 'shopify', kind: 'account', name: 'Shopify', testable: true, connect: 'token', phase: 'E-comm 7',
    powers: 'Orders, revenue and conversion on every brand card; checkout for the stores.',
    unlocks: ['E-comm: live revenue, orders, conversion', 'Read loop: funnel from real orders'],
    steps: [
      { text: 'Shopify admin → Settings → Apps and sales channels → Develop apps → Create an app.' },
      { text: 'Configure Admin API scopes: read_orders, read_products, read_analytics. Install the app.' },
      { text: 'Copy the Admin API access token (shown once) and your store domain (yourstore.myshopify.com). Paste both below.' },
    ],
    withoutIt: 'Brand cards show "Connect Shopify" instead of revenue.',
    fields: [{ secret: 'token', label: 'Admin API access token', placeholder: 'shpat_…' }, { secret: 'shop', label: 'Store domain', placeholder: 'yourstore.myshopify.com' }],
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
    id: 'cloudflare_pages', kind: 'account', name: 'Cloudflare Pages (store previews)', testable: true, connect: 'token', phase: 'E-comm 6',
    powers: 'Preview URLs for each store build and the deploy after you merge.',
    unlocks: ['E-comm step 6: preview → merge → deploy'],
    steps: [
      { text: 'Cloudflare → My Profile → API Tokens → Create Custom Token.', link: 'https://dash.cloudflare.com/profile/api-tokens' },
      { text: 'Permissions: Account → Cloudflare Pages → Edit. Account Resources: your account.' },
      { text: 'Copy the token and your Account ID, paste both below.' },
    ],
    withoutIt: 'Store builds have no preview URL.',
    fields: [{ secret: 'token', label: 'API token' }, { secret: 'account_id', label: 'Account ID' }],
  },
];

export const ALL_SETUP = [...PLATFORM_SETUP, ...ACCOUNT_SETUP];
/** Every Worker secret the Setup page is allowed to write. */
export const WRITABLE_SECRETS = PLATFORM_SETUP.flatMap((e) => e.fields.map((f) => f.secret)).concat(['INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET', 'TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TOKEN_ENCRYPTION_KEY']).filter((s) => s !== 'VITE_VAPID_PUBLIC_KEY');
