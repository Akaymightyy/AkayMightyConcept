// =====================================================================
//  site-config.js  —  shared site configuration for Akay Mighty Concept
//  ---------------------------------------------------------------------
//  Single source of truth for brand identity, navigation, pricing,
//  testimonials, and featured projects. Imported by layout.js and any
//  page that needs to render pricing cards, testimonials, or project
//  data.
//
//  USAGE
//    <script type="module">
//      import { SITE_CONFIG, PRICING_TIERS, TESTIMONIALS, FEATURED_PROJECTS }
//        from './site-config.js';
//    </script>
// =====================================================================

// ----- Brand identity --------------------------------------------------
export const SITE_CONFIG = {
  brand: 'Akay Mighty Concept',
  brandShort: 'AKAY',
  brandAccent: 'MIGHTY',
  brandSuffix: 'CONCEPT',
  tagline:
    "I'm Awwal Abdulhakeem — a Website Developer & Graphics Designer. Premium websites, branding, and print that make businesses unforgettable.",
  description:
    "I design and build websites that turn visitors into customers — plus branding, flyers, and print that make your business unforgettable. 8+ years crafting bold visuals and converting websites.",
  url: 'https://akaymightyconcept.com',
  author: 'Awwal Abdulhakeem',
  email: 'hello@akaymightyconcept.com',
  whatsapp: '2349049541318', // Nigeria, +234 904 954 1318
  whatsappDisplay: '+234 904 954 1318',
  location: 'Kaduna, Nigeria · Working worldwide',
  logo: './akay-logo.jpg',
  headshot: './akay-headshot.png',
  cv: './Akay-CV.jpg',

  // Primary nav (top bar). Used by layout.js to render the header.
  nav: [
    { label: 'Home', url: '/home.html', id: 'home' },
    { label: 'Projects', url: '/projects.html', id: 'projects' },
    { label: 'About', url: '/about.html', id: 'about' },
    { label: 'Services', url: '/services.html', id: 'services' },
    { label: 'Blog', url: '/blog.html', id: 'blog' },
    { label: 'Downloads', url: '/downloads.html', id: 'downloads' },
    { label: 'Start a Project', url: '/start-a-project.html', id: 'start-a-project', cta: true }
  ],

  // Footer quick-links (split into 2 columns).
  footerStudioLinks: [
    { label: 'About', url: '/about.html' },
    { label: 'Projects', url: '/projects.html' },
    { label: 'Services', url: '/services.html' },
    { label: 'Blog', url: '/blog.html' },
    { label: 'Downloads', url: '/downloads.html' },
    { label: 'Start a Project', url: '/start-a-project.html' }
  ],
  footerConnectLinks: [
    { label: 'Home', url: '/home.html' },
    { label: 'Recent Work', url: '/projects.html' },
    { label: 'Pricing', url: '/services.html#pricing' },
    { label: 'Project Inquiry', url: '/start-a-project.html' },
    { label: 'Downloads', url: '/downloads.html' }
  ],

  // Social platforms (used in header CTA row + footer).
  social: [
    {
      label: 'Instagram',
      url: 'https://instagram.com/akaymightyconcept',
      icon: 'instagram'
    },
    {
      label: 'Facebook',
      url: 'https://facebook.com/akaymightyconcept',
      icon: 'facebook'
    },
    {
      label: 'LinkedIn',
      url: 'https://www.linkedin.com/in/akaymightyconcept',
      icon: 'linkedin'
    },
    {
      label: 'WhatsApp',
      url: 'https://wa.me/2349049541318',
      icon: 'whatsapp'
    }
  ],

  // Tool/stack strip shown on the homepage.
  tools: [
    { name: 'HTML5', color: '#e34f26' },
    { name: 'CSS3', color: '#1572b6' },
    { name: 'JavaScript', color: '#f7df1e' },
    { name: 'Firebase', color: '#ffca28' },
    { name: 'Vercel', color: '#ffffff' },
    { name: 'Figma', color: '#f24e1e' },
    { name: 'CorelDRAW', color: '#2a2a85' },
    { name: 'Photoshop', color: '#31a8ff' }
  ]
};

// ----- Pricing tiers (used by home.html + services.html) --------------
export const PRICING_TIERS = [
  {
    id: 'landing-page',
    name: 'Landing Page',
    price: '50,000',
    currency: 'NGN',
    symbol: '₦',
    turnaround: 'Delivered in 3–5 days',
    popular: false,
    category: 'Web',
    features: [
      'Single high-converting page',
      'Mobile-responsive design',
      'WhatsApp / contact integration',
      '2 rounds of revisions',
      'Fast 3–5 day delivery',
      'Basic SEO setup'
    ]
  },
  {
    id: 'full-website',
    name: 'Full Website',
    price: '150,000',
    currency: 'NGN',
    symbol: '₦',
    turnaround: 'Delivered in 2–3 weeks',
    popular: true,
    badge: 'Most Popular',
    category: 'Web',
    features: [
      'Up to 6 pages, fully custom',
      'SEO-optimized structure',
      'Admin dashboard for live edits',
      'Unlimited revisions until happy',
      'Hosting & deployment setup',
      'Analytics + contact integrations'
    ]
  },
  {
    id: 'brand-print',
    name: 'Brand + Print',
    price: '35,000',
    currency: 'NGN',
    symbol: '₦',
    turnaround: 'Delivered in 24–72 hrs',
    popular: false,
    category: 'Brand',
    features: [
      'Logo or flyer design (design + branding)',
      'Print-ready files (CMYK) for cards & merch',
      'Social media formats',
      'Fast turnaround',
      '2 design variations',
      'Source files included'
    ]
  }
];

// ----- Add-ons (à la carte pricing for single items) ------------------
// Each add-on is a single, fixed-price deliverable that a client can buy
// without committing to a full package. Mix and match — or start with one
// and upgrade later. Admin-managed (Firestore `content/addons`); the
// static defaults here are merged with Firestore on the public
// services.html page so the list always renders, even offline.
export const ADDONS = [
  { id: 'extra-page',      name: 'Extra Page',              price: '10,000', symbol: '₦', description: 'Additional page beyond the package scope',                                category: 'Web' },
  { id: 'logo-only',       name: 'Logo Only',               price: '15,000', symbol: '₦', description: 'Single logo design with 3 concepts + source files',                      category: 'Brand' },
  { id: 'business-card',   name: 'Business Card Design',    price: '8,000',  symbol: '₦', description: 'Double-sided design + print-ready CMYK file',                            category: 'Print' },
  { id: 'maintenance',     name: '1 Month Maintenance',     price: '20,000', symbol: '₦', description: 'Content updates, bug fixes, and small changes for 30 days',              category: 'Web' },
  { id: 'flyer-design',    name: 'Flyer Design',            price: '12,000', symbol: '₦', description: 'Single-sided flyer with custom graphics + 2 revisions',                  category: 'Brand' },
  { id: 'banner-print',    name: 'Banner Printing',         price: '15,000', symbol: '₦', description: 'Large format banner design + print (up to 3ft x 6ft)',                   category: 'Print' }
];

// ----- Testimonials (used by home.html) -------------------------------
export const TESTIMONIALS = [
  {
    name: 'Muyiwa O.',
    initials: 'MO',
    title: 'Co-founder, Marvel Oaks Solicitors',
    rating: 5,
    quote:
      "Awwal transformed our brand completely. The logo, flyers, and website he designed brought us more customers in three months than we had all year. Truly exceptional work."
  },
  {
    name: 'Aisha B.',
    initials: 'AB',
    title: 'CEO, Naya Foods & Bakery',
    rating: 5,
    quote:
      "The attention to detail is unmatched. Akay Mighty Concept handled our entire brand identity — from logo to packaging — and the result was beyond what we imagined. Highly recommend."
  },
  {
    name: 'Bosun E.',
    initials: 'BE',
    title: 'Founder, Bostrad Logistics',
    rating: 5,
    quote:
      "Professional, fast, and incredibly talented. The website Awwal built for us loads fast, looks premium, and converts visitors. Working with him was the best decision we made this year."
  }
];

// ----- Featured projects (3 case-study slugs used on home.html) -------
// These slugs must match the `slug` field on the matching Firestore project
// (collection `content/projects`) or the `slug` field on the matching
// entry in PROJECT_CASE_STUDIES below. The home page builds the 3 featured
// cards by fetching these specific slugs.
export const FEATURED_PROJECTS = [
  'scottish-essentials',
  'ajb-autos',
  'victorian-bloom'
];

// ----- PROJECT CASE STUDIES ------------------------------------------
// Full case-study data for the featured projects. Each entry is rendered
// on /project-detail.html?slug=SLUG. The first 3 entries here are also
// mirrored by FEATURED_FALLBACK so the homepage never looks empty when
// Firestore is offline. The admin dashboard can add/edit/delete entries
// (saved to Firestore `content/case-studies`); on load, project-detail
// merges Firestore case studies on top of these static defaults.
//
// Shape:
//   { slug, title, category, status, coverImage, challenge, solution,
//     tools: [string], screenshots: [url], liveUrl, order }
export const PROJECT_CASE_STUDIES = [
  {
    slug: 'scottish-essentials',
    title: 'Scottish Essentials Beauty & Spa',
    category: 'Web · Spa Brand',
    status: 'Active',
    coverImage: 'https://s0.wp.com/mshots/v1/https%3A%2F%2Fscottishessentialsbeautyspa.vercel.app?w=1200&h=900',
    liveUrl: 'https://scottishessentialsbeautyspa.vercel.app',
    order: 0,
    challenge:
      "Scottish Essentials Beauty & Spa needed a digital home that matched the luxury feel of their physical spa — without paying agency prices. Their existing Instagram presence had no booking flow, and customers had to DM to schedule appointments. They also wanted a way to sell skincare products online without the overhead of a full e-commerce platform, and the entire site needed to load fast on the 3G connections most of their customers use.",
    solution:
      "I designed a dark, gold-accented website with a hero booking CTA, a product grid with lightbox gallery, and integrated WhatsApp ordering. Load time stayed under 2 seconds even on 3G, and bookings now flow straight to the owner's WhatsApp. The product grid uses native lazy-loading + a CSS-only lightbox (no JS framework) so the page stays light. A custom dark-mode palette with subtle gold gradients mirrors the spa's physical interior.",
    tools: ['HTML5', 'CSS3', 'JavaScript', 'Firebase', 'Vercel', 'WhatsApp API', 'Lightbox', 'Lazy Loading'],
    screenshots: [
      'https://cdn.kord.live/serve/ZoCtg7SPBWlc.jpg',
      'https://cdn.kord.live/serve/4cG5RghDuw9w.jpg',
      'https://cdn.kord.live/serve/NRlPY4VLxSVG.jpg'
    ]
  },
  {
    slug: 'ajb-autos',
    title: 'AJB Autos',
    category: 'Web · Automotive',
    status: 'Active',
    coverImage: 'https://s0.wp.com/mshots/v1/https%3A%2F%2Fajbautos.com.ng?w=1200&h=900',
    liveUrl: 'https://ajbautos.com.ng',
    order: 1,
    challenge:
      "AJB Autos needed a sleek, professional website to showcase their premium vehicle inventory. The challenge was creating a dark, luxurious UI that conveyed trust while remaining easy to navigate on mobile — plus a seamless way for prospects to inquire about any vehicle directly. The client also wanted each car listing to feel like a showroom card, not a classified ad, and the homepage hero had to communicate 'premium dealership' inside two seconds.",
    solution:
      "I built a modern dark-themed website with smooth animations, a virtual showroom feel, and direct WhatsApp inquiry buttons on every vehicle listing. High-quality car imagery is front and center, with minimal distractions, so buyers can browse the full inventory and inquire in one tap. A custom horizontal-scroll gallery on the inventory page lets buyers swipe through car photos without leaving the listing, and every CTA deep-links into WhatsApp with the vehicle name pre-filled.",
    tools: ['HTML5', 'CSS3', 'JavaScript', 'Dark UI', 'Responsive Design', 'SEO', 'WhatsApp API', 'IntersectionObserver'],
    screenshots: [
      'https://cdn.kord.live/serve/4cG5RghDuw9w.jpg',
      'https://cdn.kord.live/serve/ZoCtg7SPBWlc.jpg',
      'https://cdn.kord.live/serve/KWXIC3QcBiFj.jpg'
    ]
  },
  {
    slug: 'victorian-bloom',
    title: 'Victorian Bloom Hotel & Resort',
    category: 'Web · Hotel',
    status: 'Delivered',
    coverImage: 'https://s0.wp.com/mshots/v1/https%3A%2F%2Fvictoria-bloom-hotel-resort.onrender.com?w=1200&h=900',
    liveUrl: 'https://victoria-bloom-hotel-resort.onrender.com',
    order: 2,
    challenge:
      "Victorian Bloom Hotel & Resort in Asaba needed a luxury website that showcased their rooms, amenities, and booking flow and needed a complete identity that felt both elegant and modern — strong enough to anchor signage, packaging, business cards, and Instagram templates. The owner had a Pinterest board of inspiration but no formal brief, so the brand system had to be self-explanatory enough that she could extend it on her own without hiring a designer each time. The palette also had to translate cleanly from RGB screens to CMYK print without the muddy shifts you usually get.",
    solution:
      "I built a complete brand kit from the ground up: a hand-drawn logomark, a rose-gold + deep-plum color system, serif/sans typography pairing, and CMYK print-ready files for cards and packaging. The system was handed off as a brand deck so the client can extend it on her own — a one-page 'brand rules' card plus a folder of pre-sized Instagram templates and printable PDFs. The color system was tested against a Fogra 39 CMYK profile so the printed cards matched the on-screen palette within ΔE < 3.",
    tools: ['CorelDRAW', 'Photoshop', 'Illustrator', 'Print Production', 'Brand Strategy', 'CMYK Pre-press', 'Typography'],
    screenshots: [
      'https://cdn.kord.live/serve/NRlPY4VLxSVG.jpg',
      'https://cdn.kord.live/serve/KWXIC3QcBiFj.jpg',
      'https://cdn.kord.live/serve/ZoCtg7SPBWlc.jpg'
    ]
  },
  {
    slug: 'kaduna-lifestyle',
    title: 'Kaduna Lifestyle',
    category: 'Web · Game',
    status: 'Active',
    coverImage: 'https://s0.wp.com/mshots/v1/https%3A%2F%2Fkadunalifestyle.zone.id?w=1200&h=900',
    liveUrl: 'https://kadunalifestyle.zone.id',
    order: 3,
    challenge: "A multiplayer life-sim browser game set in Kaduna.",
    solution: "Built a fresh multiplayer life-sim that runs straight in the browser, with a Kaduna setting and real-time play.",
    tools: ['HTML5', 'CSS3', 'JavaScript', 'Firebase', 'Vercel', 'Responsive Design'],
    screenshots: ['https://s0.wp.com/mshots/v1/https%3A%2F%2Fkadunalifestyle.zone.id?w=1200&h=900']
  },
  {
    slug: 'afrorush',
    title: 'AfroRush',
    category: 'Web · Game',
    status: 'Active',
    coverImage: 'https://s0.wp.com/mshots/v1/https%3A%2F%2Fafrorush.vercel.app?w=1200&h=900',
    liveUrl: 'https://afrorush.vercel.app',
    order: 4,
    challenge: "An African okada street-racing browser game.",
    solution: "Built with Next.js, Phaser and Firebase: fast street-racing action that plays on any phone browser.",
    tools: ['HTML5', 'CSS3', 'JavaScript', 'Firebase', 'Vercel', 'Responsive Design'],
    screenshots: ['https://s0.wp.com/mshots/v1/https%3A%2F%2Fafrorush.vercel.app?w=1200&h=900']
  },
  {
    slug: 'kay-super-racing',
    title: 'Kay Super Racing',
    category: 'Web · Game',
    status: 'Active',
    coverImage: 'https://s0.wp.com/mshots/v1/https%3A%2F%2Fsuper-racing.vercel.app?w=1200&h=900',
    liveUrl: 'https://super-racing.vercel.app',
    order: 5,
    challenge: "A three.js arcade racing game that runs in the browser.",
    solution: "Built a 3D arcade racer with three.js, tuned to run smoothly on phones, hosted on Vercel.",
    tools: ['HTML5', 'CSS3', 'JavaScript', 'Firebase', 'Vercel', 'Responsive Design'],
    screenshots: ['https://s0.wp.com/mshots/v1/https%3A%2F%2Fsuper-racing.vercel.app?w=1200&h=900']
  },
  {
    slug: 'naija-lavish',
    title: 'NaijaLavish',
    category: 'Web · Game',
    status: 'Active',
    coverImage: 'https://s0.wp.com/mshots/v1/https%3A%2F%2Fnaija-lavish.vercel.app?w=1200&h=900',
    liveUrl: 'https://naija-lavish.vercel.app',
    order: 6,
    challenge: "An Abuja multiplayer life-sim built with Next.js, Three.js and Firebase.",
    solution: "Built an Abuja-set multiplayer life-sim with a 3D world and Firebase-backed accounts.",
    tools: ['HTML5', 'CSS3', 'JavaScript', 'Firebase', 'Vercel', 'Responsive Design'],
    screenshots: ['https://s0.wp.com/mshots/v1/https%3A%2F%2Fnaija-lavish.vercel.app?w=1200&h=900']
  },
  {
    slug: 'kayshooter',
    title: 'Kayshooter',
    category: 'Web · Game',
    status: 'Active',
    coverImage: 'https://s0.wp.com/mshots/v1/https%3A%2F%2Fkayshooter.vercel.app?w=1200&h=900',
    liveUrl: 'https://kayshooter.vercel.app',
    order: 7,
    challenge: "A browser shooter game.",
    solution: "Built a fast browser shooter, hosted on Vercel.",
    tools: ['HTML5', 'CSS3', 'JavaScript', 'Firebase', 'Vercel', 'Responsive Design'],
    screenshots: ['https://s0.wp.com/mshots/v1/https%3A%2F%2Fkayshooter.vercel.app?w=1200&h=900']
  },
  {
    slug: 'kayhost-html',
    title: 'Kayhost HTML',
    category: 'Web · App',
    status: 'Active',
    coverImage: 'https://s0.wp.com/mshots/v1/https%3A%2F%2Fkayhosthtml.vercel.app?w=1200&h=900',
    liveUrl: 'https://kayhosthtml.vercel.app',
    order: 8,
    challenge: "Instant HTML hosting with an AI visual editor.",
    solution: "Built a tool where you paste or upload HTML, host it instantly, and edit it visually with AI help.",
    tools: ['HTML5', 'CSS3', 'JavaScript', 'Firebase', 'Vercel', 'Responsive Design'],
    screenshots: ['https://s0.wp.com/mshots/v1/https%3A%2F%2Fkayhosthtml.vercel.app?w=1200&h=900']
  },
  {
    slug: 'rental-home-connect',
    title: 'Rental Home Connect',
    category: 'Web · Real Estate',
    status: 'Active',
    coverImage: 'https://s0.wp.com/mshots/v1/https%3A%2F%2Frental-home-connect.vercel.app?w=1200&h=900',
    liveUrl: 'https://rental-home-connect.vercel.app',
    order: 9,
    challenge: "A rental listings site with an admin dashboard.",
    solution: "Built a listings site with a Firebase and Cloudinary admin so the owner can manage properties and photos.",
    tools: ['HTML5', 'CSS3', 'JavaScript', 'Firebase', 'Vercel', 'Responsive Design'],
    screenshots: ['https://s0.wp.com/mshots/v1/https%3A%2F%2Frental-home-connect.vercel.app?w=1200&h=900']
  },
  {
    slug: 'kayverify',
    title: 'KayVerify',
    category: 'Web · SaaS',
    status: 'Active',
    coverImage: 'https://s0.wp.com/mshots/v1/https%3A%2F%2Ftest-web-page-seven.vercel.app?w=1200&h=900',
    liveUrl: 'https://test-web-page-seven.vercel.app',
    order: 10,
    challenge: "SMS verification platform with a redesigned landing page.",
    solution: "Rebranded the platform and redesigned its landing page to look trustworthy and convert.",
    tools: ['HTML5', 'CSS3', 'JavaScript', 'Firebase', 'Vercel', 'Responsive Design'],
    screenshots: ['https://s0.wp.com/mshots/v1/https%3A%2F%2Ftest-web-page-seven.vercel.app?w=1200&h=900']
  },
  {
    slug: 'kaylinkz',
    title: 'KayLinkz',
    category: 'Web · Platform',
    status: 'Active',
    coverImage: 'https://s0.wp.com/mshots/v1/https%3A%2F%2Fkaylinkz.name.ng?w=1200&h=900',
    liveUrl: 'https://kaylinkz.name.ng',
    order: 11,
    challenge: "A MERN social media platform.",
    solution: "Built a full social platform on the MERN stack with profiles, posts and feeds.",
    tools: ['HTML5', 'CSS3', 'JavaScript', 'Firebase', 'Vercel', 'Responsive Design'],
    screenshots: ['https://s0.wp.com/mshots/v1/https%3A%2F%2Fkaylinkz.name.ng?w=1200&h=900']
  },
  {
    slug: 'kaymain-hosting',
    title: 'KayMain Hosting',
    category: 'Web · SaaS',
    status: 'Active',
    coverImage: 'https://s0.wp.com/mshots/v1/https%3A%2F%2Fsample3-chi.vercel.app?w=1200&h=900',
    liveUrl: 'https://sample3-chi.vercel.app',
    order: 12,
    challenge: "A web hosting platform built on Firebase.",
    solution: "Built a hosting SaaS with customer accounts, plans and an admin side.",
    tools: ['HTML5', 'CSS3', 'JavaScript', 'Firebase', 'Vercel', 'Responsive Design'],
    screenshots: ['https://s0.wp.com/mshots/v1/https%3A%2F%2Fsample3-chi.vercel.app?w=1200&h=900']
  },
  {
    slug: 'tawakkaltu-food-canteen',
    title: 'Tawakkaltu Food Canteen',
    category: 'Web · Food',
    status: 'Active',
    coverImage: 'https://s0.wp.com/mshots/v1/https%3A%2F%2Ftawakkaltufoodcateen.vercel.app?w=1200&h=900',
    liveUrl: 'https://tawakkaltufoodcateen.vercel.app',
    order: 13,
    challenge: "A website for a food canteen.",
    solution: "Built a mobile-friendly menu and ordering site for a local food canteen.",
    tools: ['HTML5', 'CSS3', 'JavaScript', 'Firebase', 'Vercel', 'Responsive Design'],
    screenshots: ['https://s0.wp.com/mshots/v1/https%3A%2F%2Ftawakkaltufoodcateen.vercel.app?w=1200&h=900']
  },
  {
    slug: 'valca-tiles-marbles',
    title: 'Valca Tiles & Marbles',
    category: 'Web · Business',
    status: 'Active',
    coverImage: 'https://s0.wp.com/mshots/v1/https%3A%2F%2Fakaymightygadgets.vercel.app?w=1200&h=900',
    liveUrl: 'https://akaymightygadgets.vercel.app',
    order: 14,
    challenge: "A showcase site for a tiles and marbles business.",
    solution: "Built a clean product showcase site so customers can browse and get in touch quickly.",
    tools: ['HTML5', 'CSS3', 'JavaScript', 'Firebase', 'Vercel', 'Responsive Design'],
    screenshots: ['https://s0.wp.com/mshots/v1/https%3A%2F%2Fakaymightygadgets.vercel.app?w=1200&h=900']
  },
  {
    slug: 'akay-online-bank',
    title: 'Akay Online Bank',
    category: 'Web · App',
    status: 'Active',
    coverImage: 'https://s0.wp.com/mshots/v1/https%3A%2F%2Fakaymightybank.name.ng?w=1200&h=900',
    liveUrl: 'https://akaymightybank.name.ng',
    order: 15,
    challenge: "An online banking app interface.",
    solution: "Designed and built a banking app interface with dashboard, transfers and history screens.",
    tools: ['HTML5', 'CSS3', 'JavaScript', 'Firebase', 'Vercel', 'Responsive Design'],
    screenshots: ['https://s0.wp.com/mshots/v1/https%3A%2F%2Fakaymightybank.name.ng?w=1200&h=900']
  },
  {
    slug: 'walletman',
    title: 'WalletMan',
    category: 'Web · App',
    status: 'Active',
    coverImage: 'https://s0.wp.com/mshots/v1/https%3A%2F%2Fwalletman-flax.vercel.app?w=1200&h=900',
    liveUrl: 'https://walletman-flax.vercel.app',
    order: 16,
    challenge: "A personal wallet and money tracking app.",
    solution: "Built a simple money tracker for recording income and spending on any phone.",
    tools: ['HTML5', 'CSS3', 'JavaScript', 'Firebase', 'Vercel', 'Responsive Design'],
    screenshots: ['https://s0.wp.com/mshots/v1/https%3A%2F%2Fwalletman-flax.vercel.app?w=1200&h=900']
  },
  {
    slug: 'akay-bank-app',
    title: 'Akay Bank App',
    category: 'Web · App',
    status: 'Active',
    coverImage: 'https://s0.wp.com/mshots/v1/https%3A%2F%2Fakay-bank-app.vercel.app?w=1200&h=900',
    liveUrl: 'https://akay-bank-app.vercel.app',
    order: 17,
    challenge: "A mobile-first banking app demo.",
    solution: "Built a mobile-first banking app demo with clean cards and clear flows.",
    tools: ['HTML5', 'CSS3', 'JavaScript', 'Firebase', 'Vercel', 'Responsive Design'],
    screenshots: ['https://s0.wp.com/mshots/v1/https%3A%2F%2Fakay-bank-app.vercel.app?w=1200&h=900']
  }
];

// ----- Static featured card fallback (used when Firestore is offline) -
// Mirrors the first 3 PROJECT_CASE_STUDIES entries so the homepage never
// looks empty. Kept as a slug-keyed object so the homepage can do a quick
// O(1) lookup when Firestore is unavailable.
export const FEATURED_FALLBACK = PROJECT_CASE_STUDIES.slice(0, 3).reduce((acc, cs) => {
  acc[cs.slug] = {
    slug: cs.slug,
    title: cs.title,
    category: cs.category,
    cover: cs.coverImage,
    liveUrl: cs.liveUrl,
    status: cs.status,
    summary:
      cs.slug === 'scottish-essentials'
        ? 'Luxury dark aesthetic, gold accents, WhatsApp booking, skincare product grid & lightbox gallery.'
        : cs.slug === 'ajb-autos'
        ? 'Premium car dealership website with inventory showcase and WhatsApp inquiry.'
        : 'Full brand identity — logo, color system, business cards, packaging & social templates.',
    challenge: cs.challenge,
    solution: cs.solution,
    tech: cs.tools
  };
  return acc;
}, {});

// ----- Career timeline entries (used on about.html) -------------------
export const CAREER_TIMELINE = [
  {
    date: '2022 — Present',
    role: 'Founder & Creative Director',
    company: 'Akay Mighty Concept',
    desc:
      'Founded my own creative studio specializing in web development, brand identity design, and full digital printing services. Managing 150+ client projects across Nigeria and internationally, with a focus on delivering conversion-driven websites, bold visual identities, and high-quality print production for businesses of all sizes.',
    tags: ['Web Dev', 'Branding', 'Print Production', 'Studio Lead']
  },
  {
    date: '2019 — 2022',
    role: 'Freelance Designer & Digital Printer',
    company: 'Self-Employed',
    desc:
      'Transitioned into full-time freelance design and digital printing work. Served clients across Kaduna, Lagos, and Abuja with logo designs, flyers, business cards, social media graphics, and large-format print production. Built a strong reputation for fast turnaround, premium print quality, and bold, attention-grabbing designs for over 50 businesses.',
    tags: ['Freelance', 'Print', 'Logo Design', 'Flyers']
  },
  {
    date: '2018 — 2019',
    role: 'Junior Web Developer',
    company: 'Freelance Projects',
    desc:
      'Started learning web development — HTML, CSS, and JavaScript. Built my first client websites using pure code and WordPress, combining my existing design skills with front-end development. Delivered 10+ small business websites during this learning phase while continuing print production work.',
    tags: ['HTML', 'CSS', 'JavaScript', 'WordPress']
  },
  {
    date: '2017 — 2018',
    role: 'Digital Printer & Graphics Designer',
    company: 'Apprenticeship / Self-Taught',
    desc:
      'Began my creative journey in digital printing and graphics design. Learned CorelDRAW, Photoshop, and Pixellab. Started by designing and printing flyers, business cards, banners, and branded merchandise for local businesses in Kaduna. This period built the foundation for my design eye, print production knowledge, and understanding of what makes visual content effective.',
    tags: ['CorelDRAW', 'Photoshop', 'Apprenticeship', 'Kaduna']
  }
];

// ----- Skills list (used on about.html) -------------------------------
export const SKILLS = [
  'Website Development',
  'Web Design',
  'UI/UX Design',
  'Responsive Design',
  'Landing Pages',
  'Brand Identity',
  'Logo Design',
  'Flyer Design',
  'Social Media Graphics',
  'Large Format Print',
  'Business Cards',
  'Packaging'
];

// ----- Stats (used on home.html + about.html) -------------------------
export const STATS = [
  { target: 150, label: 'Projects Delivered' },
  { target: 80, label: 'Happy Clients' },
  { target: 8, label: 'Years Experience' },
  { target: 25, label: 'Awards & Features' }
];

// ----- Blog posts (used on blog.html + blog-post.html) ----------------
// Each post has full HTML content rendered on /blog-post.html?slug=SLUG.
// The admin dashboard can edit/add posts (saved to Firestore
// `content/blog-posts`); on load, blog-post.html merges Firestore posts
// on top of these static defaults.
//
// Shape: { slug, title, excerpt, date, author, category, coverImage,
//         content (HTML string), tags: [string] }
export const BLOG_POSTS = [
  {
    slug: '5-landing-page-mistakes',
    title: '5 Landing Page Mistakes That Kill Your Conversions (And How to Fix Them)',
    category: 'Web Design',
    date: 'Jun 2026',
    author: 'Awwal Abdulhakeem',
    coverImage: 'https://s0.wp.com/mshots/v1/https%3A%2F%2Fscottishessentialsbeautyspa.vercel.app?w=1200&h=900',
    excerpt:
      'Most businesses lose potential customers before they even finish reading the page. Here are the top 5 mistakes I see on landing pages and exactly how to fix each one to turn more visitors into paying customers.',
    tags: ['Landing Pages', 'Conversion', 'UX', 'Web Design'],
    content: `
      <p>Most landing pages I audit lose 60–80% of their visitors before the first scroll. That's not a traffic problem — it's a design problem. After building 150+ landing pages for clients across Nigeria and beyond, the same five mistakes show up again and again. Here's exactly what they are and how to fix each one.</p>

      <h2>1. Your headline talks about you, not the visitor</h2>
      <p>The first thing a visitor sees is your H1. If it reads like "Welcome to Acme Corp — Providing Quality Solutions Since 2014," they're gone in two seconds. Nobody cares about your founding year. They care about whether you can solve their problem.</p>
      <p><strong>Fix:</strong> Rewrite your H1 as a promise. "Get more paying customers from your website in 30 days" beats "We are a digital marketing agency." Lead with the outcome, not the company. Use the subhead to add specificity — who it's for, how fast, what makes it different.</p>

      <h2>2. You buried the call-to-action</h2>
      <p>If your only CTA is at the bottom of a 4,000-word page, you're losing the 70% of visitors who never scroll past the first screen. The fix isn't to add more CTAs everywhere — it's to add the <em>right</em> CTA in the right places.</p>
      <p><strong>Fix:</strong> Place one primary CTA above the fold (in the hero section), one in the middle (after the strongest proof point), and one at the bottom. Make them visually distinct from everything else — bright button, plenty of whitespace, action-oriented copy ("Book a Free Call" beats "Submit").</p>

      <h2>3. Your hero image is generic stock</h2>
      <p>Stock photos of smiling strangers in business-casual outfits do not build trust. They signal "we couldn't be bothered to show our actual work." Visitors have seen the same handshake photo a thousand times; their brains auto-filter it out.</p>
      <p><strong>Fix:</strong> Use real product screenshots, real team photos, or a custom illustration. If you can't afford a custom shoot, even a clean UI mockup of your product beats stock. The goal is for visitors to instantly see what they're getting — not to admire a stock photographer's composition.</p>

      <h2>4. No social proof above the fold</h2>
      <p>Trust is built in milliseconds. If a visitor lands on your page and sees nothing but marketing copy, they have no reason to believe any of it. The fastest way to build trust is to show that other people — real people — already trusted you and got results.</p>
      <p><strong>Fix:</strong> Add a single line of social proof directly under your H1. "Trusted by 80+ businesses across Nigeria" or "★★★★★ — 4.9/5 from 47 client reviews." A logo strip works too, but only if the logos are recognizable to your target audience. Unknown logos add nothing.</p>

      <h2>5. Your form asks for too much</h2>
      <p>Every extra field on your contact form cuts conversions by roughly 10–25%. Asking for a phone number, company name, job title, and budget range when all you actually need is their email and a message is a guaranteed way to lose leads.</p>
      <p><strong>Fix:</strong> Cut your form to the absolute minimum. For most service businesses, that's name, email, and a short message. If you need more info, ask for it later — in the discovery call, or in a follow-up email. The goal of the landing page form is to start the conversation, not to close the deal.</p>

      <h2>The takeaway</h2>
      <p>Landing pages aren't art projects — they're conversion tools. Every element on the page should either build trust or move the visitor toward the CTA. If it does neither, cut it. The fastest way to double your conversions isn't to drive more traffic — it's to stop losing the traffic you already have.</p>

      <p>Need a landing page audit? <a href="/start-a-project.html">Start a project</a> and I'll send you a recorded walkthrough of exactly what to fix on your current page.</p>
    `
  },
  {
    slug: 'why-every-small-business-needs-a-brand-identity',
    title: 'Why Every Small Business Needs a Brand Identity (Not Just a Logo)',
    category: 'Branding',
    date: 'May 2026',
    author: 'Awwal Abdulhakeem',
    coverImage: 'https://s0.wp.com/mshots/v1/https%3A%2F%2Fajbautos.com.ng?w=1200&h=900',
    excerpt:
      "A logo is just the tip of the iceberg. True brand identity includes your color system, typography, voice, and how people feel when they interact with your business. Here's a practical breakdown of what you actually need.",
    tags: ['Branding', 'Logo Design', 'Small Business', 'Identity'],
    content: `
      <p>"I already have a logo — why do I need a brand identity?" I hear this every week from small business owners who paid ₦10,000 for a logo and assumed the branding box was ticked. Here's the truth: a logo is one piece of a much larger puzzle. Without the rest of the system, that logo is doing about 10% of the work it could be doing for your business.</p>

      <h2>A logo is a face. A brand is a personality.</h2>
      <p>Think of it this way: your logo is your face. It's how people recognize you in a crowd. But your face alone doesn't tell anyone whether you're trustworthy, funny, premium, or cheap. That comes from your personality — how you talk, how you dress, how you treat people. A brand identity is the visual + verbal equivalent of that personality.</p>

      <h2>The 5 layers of a real brand identity</h2>
      <p>A complete brand identity has five layers. Skip any one of them and your brand feels incomplete — even if customers can't articulate why.</p>

      <h3>1. The logo system</h3>
      <p>Not just one logo, but a small family: a primary mark, a simplified version for small spaces, a monogram for favicons and social avatars, and a clear-space + minimum-size rule so it never gets squished. Each variation should be tested at favicon size (16×16px) — if it's unreadable, you need a simpler version.</p>

      <h3>2. The color system</h3>
      <p>One primary color, one secondary, and 2–3 supporting neutrals. Each color needs both an RGB value (for screens) and a CMYK value (for print), because the same color shifts dramatically between the two. Document the hex codes, the CMYK breakdowns, and where each color should be used (e.g. "primary blue is for CTAs only, never for body text").</p>

      <h3>3. Typography</h3>
      <p>Pick two typefaces: one for headings, one for body. They should contrast — a heavy display face for headings and a clean sans-serif for body is a classic combo. Specify sizes (H1 = 48px, H2 = 32px, body = 16px), line-heights, and letter-spacing. This keeps every flyer, business card, and Instagram post looking like it came from the same business.</p>

      <h3>4. Visual style</h3>
      <p>What kind of imagery feels "on brand" for you? Bright and airy? Dark and moody? Illustrations or photos? Hand-drawn or geometric? Define this once and apply it everywhere — your Instagram grid, your website hero, your print ads. Inconsistent imagery is the #1 thing that makes a small business look amateur.</p>

      <h3>5. Voice and tone</h3>
      <p>How does your brand talk? Are you formal and professional, or warm and conversational? Funny or serious? This isn't about writing style — it's about personality. Write down three adjectives that describe your brand's voice (e.g. "confident, warm, no-nonsense") and use them as a filter for every piece of copy you write.</p>

      <h2>Why this matters for small businesses specifically</h2>
      <p>Big companies can afford to be inconsistent — they have multi-million-dollar ad budgets to compensate. Small businesses don't. Every touchpoint — your Instagram bio, your WhatsApp business card, the flyer you handed out at a conference — has to do double duty. A consistent brand identity makes each touchpoint work harder. A prospect who sees your flyer, then visits your website, then messages you on WhatsApp should feel like they're dealing with the same business at every step.</p>

      <p>Without that consistency, you look like three different businesses. And three different businesses don't build trust.</p>

      <h2>The good news: it doesn't have to cost a fortune</h2>
      <p>A full agency brand identity can run ₦500,000+. But for most small businesses, a focused 1-week sprint is plenty: logo system, color palette, typography pairing, and a one-page brand rules document. That's enough to keep every piece of marketing consistent for the next 2–3 years.</p>

      <p>Want a brand identity that actually does the work? <a href="/start-a-project.html">Start a project</a> — I'll send you a fixed-price quote within 24 hours.</p>
    `
  },
  {
    slug: 'web-design-trends-2026',
    title: 'Web Design Trends 2026: What Actually Converts (And What to Skip)',
    category: 'Web Design',
    date: 'Apr 2026',
    author: 'Awwal Abdulhakeem',
    coverImage: 'https://s0.wp.com/mshots/v1/https%3A%2F%2Fvictoria-bloom-hotel-resort.onrender.com?w=1200&h=900',
    excerpt:
      "Not every trend is worth following. After 150+ client builds, here are the 2026 web design trends that genuinely move the needle on conversions — and the ones that just look pretty in a Dribbble shot.",
    tags: ['Web Design', 'Trends', '2026', 'Conversion'],
    content: `
      <p>Every January, the design world publishes its annual "trends to watch" list. Most of them are recycled from last year, and the genuinely new ones are usually bad ideas that will look dated in 18 months. After building 150+ websites in the last 8 years, I've learned to filter trends into two piles: the ones that move the conversion needle, and the ones that just look good in a Dribbble shot. Here's the 2026 list, sorted accordingly.</p>

      <h2>Trends worth adopting</h2>

      <h3>1. Dark mode by default (with a toggle)</h3>
      <p>Dark mode crossed from "trendy" to "expected" in 2025. In 2026, sites that don't offer it feel old. But — and this is the important part — dark mode done badly is worse than no dark mode at all. Pure black backgrounds with pure white text cause eye strain. Use a soft dark like #0a0a0a or #111, with off-white text (#f0f0f0) for body and pure white only for headings. And always include a manual toggle, even if you auto-detect the user's system preference.</p>

      <h3>2. Variable fonts (finally mainstream)</h3>
      <p>Variable fonts let a single font file act as hundreds of weights — bold, light, condensed, extended, all from one HTTP request. They've been technically possible since 2020, but browser support and foundry licensing finally caught up in 2025. In 2026, using variable fonts is the single biggest performance win available to most sites. Drop your font payload from 800KB to 80KB without losing any visual flexibility.</p>

      <h3>3. Scroll-driven animations (used sparingly)</h3>
      <p>The browser-native CSS scroll-driven animations spec finally landed in all major browsers in 2025. You can now do scroll-linked fades, parallax, and progress bars without a single line of JavaScript. The temptation is to use them everywhere. Resist. One tasteful scroll animation on the hero, one on a stat counter, done. Anything more and you're showing off, not communicating.</p>

      <h3>4. Generous whitespace</h3>
      <p>This isn't new, but it's finally reached mainstream adoption. The "every pixel must be filled" era is over. In 2026, the most premium-feeling sites use 30–50% more whitespace than they did three years ago. If your section looks crowded, double the padding. Then double it again.</p>

      <h3>5. WhatsApp-native CTAs</h3>
      <p>This is a Nigeria/Africa-specific trend, but it's huge. WhatsApp is the default communication channel here — email forms get ignored, WhatsApp buttons get clicks. In 2026, every service-business website should have a WhatsApp CTA above the fold, with the message pre-filled ("Hi, I'm interested in your web design service"). Conversion rates 3–5x higher than contact forms.</p>

      <h2>Trends to skip</h2>

      <h3>1. Aggressive 3D and WebGL</h3>
      <p>Yes, the Three.js demos look amazing on a 16-core MacBook Pro with fiber internet. On a 4-year-old Android over 3G — which is what 60% of your visitors are using — they take 12 seconds to load and immediately bounce. Unless 3D is core to your product (you're selling 3D models, or you're a game studio), skip it.</p>

      <h3>2. AI-generated everything</h3>
      <p>The "let AI write all your copy and generate all your images" trend peaked in 2025 and is now actively hurting brands. Customers can smell AI copy from a mile away, and the moment they do, trust drops by half. Use AI for first drafts and ideation, then have a human edit. Never ship raw AI output as your final brand voice.</p>

      <h3>3. Brutalist / anti-design</h3>
      <p>It looks cool in a portfolio. It looks broken to your customers. Brutalist design works for design studios targeting other designers. For everyone else — service businesses, e-commerce, SaaS — it's conversion poison. Skip.</p>

      <h3>4. Auto-playing video backgrounds</h3>
      <p>Bandwidth hogs, accessibility nightmares, and almost always mute-able distractions. Use a static image with a subtle gradient overlay instead. Same visual impact, 1/100th the payload.</p>

      <h2>The meta-trend: performance is the new design</h2>
      <p>If there's one thing tying all the "worth adopting" trends together, it's this: every one of them makes your site faster. Variable fonts cut payload. CSS scroll animations replace JS libraries. Generous whitespace means less content to load. WhatsApp CTAs replace heavy form libraries.</p>

      <p>In 2026, performance isn't a technical concern delegated to the dev team — it's a design decision. The fastest sites win. Not because Google says so (though they do, via Core Web Vitals), but because visitors simply don't wait. A site that loads in 1.2 seconds converts 3x better than the same site loading in 4 seconds.</p>

      <p>Design for speed first. Everything else is decoration.</p>

      <p>Want a site that follows the right trends and skips the rest? <a href="/start-a-project.html">Start a project</a> — I'll send you a mockup within 48 hours.</p>
    `
  }
];

// ----- Process steps (used on services.html) -------------------------
export const PROCESS_STEPS = [
  {
    num: '01',
    title: 'Discovery',
    desc:
      "We hop on a WhatsApp call or chat to understand your business, your audience, and the exact outcome you want. No 20-page briefs — just a focused conversation that lets me propose the right scope."
  },
  {
    num: '02',
    title: 'Design',
    desc:
      "I send the first design direction within 48 hours — usually a full page mockup or 3 logo concepts depending on your package. You give feedback, I refine, we repeat until you're happy."
  },
  {
    num: '03',
    title: 'Build',
    desc:
      'Once the design is locked, I build the production site (or final print files). Clean code, fast load times, mobile-first, and SEO baked in from day one.'
  },
  {
    num: '04',
    title: 'Launch',
    desc:
      "We deploy to your domain (or set one up). I share source files, walk you through any admin dashboard, and stay on call for the first 7 days post-launch for any tweaks."
  }
];

// ----- Service-tier detail blocks (used on services.html) ------------
export const SERVICE_TIERS_DETAIL = [
  {
    id: 'landing-page',
    name: 'Landing Page',
    price: '50,000',
    currency: 'NGN',
    symbol: '₦',
    turnaround: 'Delivered in 3–5 days',
    popular: false,
    category: 'Web',
    summary:
      "A single high-converting page built to do one job — turn your traffic into leads, bookings, or sales. Perfect for product launches, event promos, lead-gen campaigns, and small businesses that need a sharp web presence without a 6-page site.",
    deliverables: [
      '1 single-page website, fully responsive',
      'Custom design — no templates',
      'Hero section + up to 6 content sections',
      'WhatsApp / contact form integration',
      'Basic on-page SEO (title, meta, headings)',
      'Mobile + desktop optimization',
      'Deployment to Vercel (your subdomain or custom domain)',
      '2 rounds of revisions',
      'Source files on request'
    ],
    bestFor: [
      'Product launches & promos',
      'Lead-gen campaigns',
      'Event & RSVP pages',
      'Small service businesses'
    ]
  },
  {
    id: 'full-website',
    name: 'Full Website',
    price: '150,000',
    currency: 'NGN',
    symbol: '₦',
    turnaround: 'Delivered in 2–3 weeks',
    popular: true,
    badge: 'Most Popular',
    category: 'Web',
    summary:
      "A complete, custom multi-page website built to grow with your business. Up to 6 fully designed pages, an admin dashboard so you can edit content yourself, SEO baked in from the start, and unlimited revisions until you're happy with every pixel.",
    deliverables: [
      'Up to 6 fully custom pages (Home, About, Services, Projects, Blog, Contact, etc.)',
      'Custom design — no templates',
      'Admin dashboard for live content edits',
      'Blog / news section with CMS',
      'SEO-optimized structure + sitemap',
      'Contact form + WhatsApp integration',
      'Analytics setup (GA4 + Search Console)',
      'Hosting & deployment setup',
      'Unlimited revisions until happy',
      '7 days post-launch support'
    ],
    bestFor: [
      'Service businesses & agencies',
      'E-commerce without cart (catalog + inquiry)',
      'Professional portfolios',
      'Companies that need to edit their own content'
    ]
  },
  {
    id: 'brand-print',
    name: 'Brand + Print',
    price: '35,000',
    currency: 'NGN',
    symbol: '₦',
    turnaround: 'Delivered in 24–72 hrs',
    popular: false,
    category: 'Brand',
    summary:
      "A focused brand & print package — design and branding first (logo or flyer), with print-ready files for business cards, banners, and merch. You get a custom design, source files, social formats, and CMYK print files ready for any print shop.",
    deliverables: [
      'Logo OR flyer design (your choice)',
      '3 unique design concepts',
      '2 rounds of revisions on the chosen concept',
      'Print-ready CMYK files (PDF + AI + PNG)',
      'Social media formats (IG, FB, WhatsApp)',
      'Source files included',
      'Quick 24–72hr turnaround',
      'Brand color palette + typography guide (logo package)'
    ],
    bestFor: [
      'Startups needing a logo fast',
      'Event promos & flyer campaigns',
      'Businesses refreshing an outdated logo',
      'Anyone who needs print-ready files today'
    ]
  }
];

// ----- Downloads (used on downloads.html + footer) --------------------
// Three download slots surfaced on the public downloads.html page and
// editable from the admin dashboard (saved to Firestore
// `content/downloads`). The CV currently points at the placeholder
// Akay-CV.jpg shipped with the site; the Corporate Profile and Brand
// Deck slots show "Coming soon" until the admin uploads a real PDF.
export const DOWNLOADS = [
  {
    id: 'cv',
    name: 'Akay CV / Resume',
    description:
      "Awwal Abdulhakeem's full CV — 8+ years of web development, branding, and print production work across Nigeria and worldwide. PDF, 2 pages.",
    fileUrl: './Akay-CV.jpg',
    icon: 'cv',
    available: true
  },
  {
    id: 'corporate-profile',
    name: 'Corporate Profile',
    description:
      'A formal corporate profile for Akay Mighty Concept — services, process, case studies, and pricing. Perfect for B2B procurement teams and partnership conversations.',
    fileUrl: '',
    icon: 'profile',
    available: false
  },
  {
    id: 'brand-deck',
    name: 'Brand Deck',
    description:
      "The Akay Mighty Concept brand deck — logo system, color palette, typography, and visual style guidelines. Useful if you're collaborating on a co-branded project.",
    fileUrl: '',
    icon: 'brand',
    available: false
  }
];

// ----- Site content defaults (editable from admin Site Content tab) ---
// These mirror the values used in home.html / services.html / about.html
// so the admin dashboard can edit them without touching code. Stored in
// Firestore `content/site-content`. The shape is intentionally flat so
// the admin form can be a simple key/value grid.
export const SITE_CONTENT_DEFAULTS = {
  // Hero
  heroBadge: 'Available for Work',
  heroName: 'Hi, I\'m Awwal Abdulhakeem 👋',
  heroTitleLead: "I'm a Website Developer &",
  heroRotatingWords: 'Graphics Designer|Brand Strategist|UI/UX Designer|Digital Printer|Creative Director',
  heroTagline:
    "I design and build websites that turn visitors into customers — plus branding, flyers, and print that make your business unforgettable. 8+ years crafting bold visuals and converting websites.",

  // Stats (numbers — must be numeric strings so the counter animation works)
  statProjects: '150',
  statClients: '80',
  statYears: '8',
  statAwards: '25',

  // CTA band
  ctaTitle: 'Ready to create something bold?',
  ctaDesc:
    "Let's turn your idea into a brand people remember. Whether it's a website, a logo, or a full print campaign — I'm ready to deliver magic."
};

export default {
  SITE_CONFIG,
  PRICING_TIERS,
  ADDONS,
  TESTIMONIALS,
  FEATURED_PROJECTS,
  FEATURED_FALLBACK,
  PROJECT_CASE_STUDIES,
  CAREER_TIMELINE,
  SKILLS,
  STATS,
  BLOG_POSTS,
  DOWNLOADS,
  SITE_CONTENT_DEFAULTS,
  PROCESS_STEPS,
  SERVICE_TIERS_DETAIL
};
