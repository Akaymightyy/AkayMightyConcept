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
    { label: 'Start a Project', url: '/start-a-project.html', id: 'start-a-project', cta: true }
  ],

  // Footer quick-links (split into 2 columns).
  footerStudioLinks: [
    { label: 'About', url: '/about.html' },
    { label: 'Projects', url: '/projects.html' },
    { label: 'Services', url: '/services.html' },
    { label: 'Blog', url: '/blog.html' },
    { label: 'Start a Project', url: '/start-a-project.html' }
  ],
  footerConnectLinks: [
    { label: 'Home', url: '/home.html' },
    { label: 'Recent Work', url: '/projects.html' },
    { label: 'Pricing', url: '/services.html#pricing' },
    { label: 'Project Inquiry', url: '/start-a-project.html' }
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
    features: [
      'Logo or flyer design',
      'Print-ready files (CMYK)',
      'Social media formats',
      'Fast turnaround',
      '2 design variations',
      'Source files included'
    ]
  }
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
// (collection `content/projects`). The home page builds the 3 featured
// cards by fetching these specific slugs.
export const FEATURED_PROJECTS = [
  'scottish-essentials',
  'ajb-autos',
  'victorian-bloom'
];

// ----- Static featured card fallback (used when Firestore is offline) -
// Mirrors the Firestore entries so the homepage never looks empty.
export const FEATURED_FALLBACK = {
  'scottish-essentials': {
    slug: 'scottish-essentials',
    title: 'Scottish Essentials Beauty & Spa',
    category: 'Web · Spa Brand',
    cover: 'https://cdn.kord.live/serve/ZoCtg7SPBWlc.jpg',
    liveUrl: 'https://scottishessentialsbeautyspa.vercel.app',
    status: 'Active',
    summary:
      'Luxury dark aesthetic, gold accents, WhatsApp booking, skincare product grid & lightbox gallery.',
    challenge:
      'Scottish Essentials Beauty & Spa needed a digital home that matched the luxury feel of their physical spa — without paying agency prices. Their existing Instagram presence had no booking flow, and customers had to DM to schedule appointments.',
    solution:
      "I designed a dark, gold-accented website with a hero booking CTA, a product grid with lightbox gallery, and integrated WhatsApp ordering. Load time stayed under 2 seconds even on 3G, and bookings now flow straight to the owner's WhatsApp.",
    tech: ['HTML5', 'CSS3', 'JavaScript', 'Firebase', 'Vercel', 'WhatsApp API']
  },
  'ajb-autos': {
    slug: 'ajb-autos',
    title: 'AJB Autos',
    category: 'Web · Automotive',
    cover: 'https://cdn.kord.live/serve/4cG5RghDuw9w.jpg',
    liveUrl: 'https://ajbautos.com.ng',
    status: 'Active',
    summary:
      'Premium car dealership website with inventory showcase and WhatsApp inquiry.',
    challenge:
      'AJB Autos needed a sleek, professional website to showcase their premium vehicle inventory. The challenge was creating a dark, luxurious UI that conveyed trust while remaining easy to navigate on mobile — plus a seamless way for prospects to inquire about any vehicle directly.',
    solution:
      'I built a modern dark-themed website with smooth animations, a virtual showroom feel, and direct WhatsApp inquiry buttons on every vehicle listing. High-quality car imagery is front and center, with minimal distractions, so buyers can browse the full inventory and inquire in one tap.',
    tech: ['HTML5', 'CSS3', 'JavaScript', 'Dark UI', 'Responsive', 'SEO']
  },
  'victorian-bloom': {
    slug: 'victorian-bloom',
    title: 'Victorian Bloom Florals',
    category: 'Branding · Print',
    cover: 'https://cdn.kord.live/serve/NRlPY4VLxSVG.jpg',
    liveUrl: '',
    status: 'Delivered',
    summary:
      'Full brand identity — logo, color system, business cards, packaging & social templates.',
    challenge:
      'Victorian Bloom Florals was launching as a premium floral studio and needed a complete identity that felt both elegant and modern — strong enough to anchor signage, packaging, business cards, and Instagram templates.',
    solution:
      'I built a complete brand kit from the ground up: a hand-drawn logomark, a rose-gold + deep-plum color system, serif/sans typography pairing, and CMYK print-ready files for cards and packaging. The system was handed off as a brand deck so the client can extend it on their own.',
    tech: ['CorelDRAW', 'Photoshop', 'Print Production', 'Brand Strategy']
  }
};

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

// ----- Blog placeholder posts (used on blog.html) ---------------------
export const BLOG_POSTS = [
  {
    slug: '5-landing-page-mistakes',
    title: '5 Landing Page Mistakes That Kill Your Conversions (And How to Fix Them)',
    category: 'Web Design',
    date: 'Jun 2026',
    excerpt:
      'Most businesses lose potential customers before they even finish reading the page. Here are the top 5 mistakes I see on landing pages and exactly how to fix each one to turn more visitors into paying customers.',
    image: 'https://cdn.kord.live/serve/ZoCtg7SPBWlc.jpg'
  },
  {
    slug: 'logo-is-not-a-brand',
    title: "Why Your Logo Alone Isn't a Brand Identity — What Nigerian SMEs Are Missing",
    category: 'Branding',
    date: 'May 2026',
    excerpt:
      'A logo is just the tip of the iceberg. True brand identity includes your color system, typography, voice, and how people feel when they interact with your business. Here is a practical breakdown of what you actually need.',
    image: 'https://cdn.kord.live/serve/4cG5RghDuw9w.jpg'
  },
  {
    slug: 'why-i-still-use-vanilla-js-2026',
    title: 'Why I Still Build Websites with Pure HTML, CSS & JS in 2026',
    category: 'Web Dev',
    date: 'Apr 2026',
    excerpt:
      "With all the frameworks out there, why would a developer still choose vanilla code? In this article, I break down the real reasons: faster load times, better SEO, zero dependency headaches, and websites that just feel faster.",
    image: 'https://cdn.kord.live/serve/KWXIC3QcBiFj.jpg'
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
    summary:
      "A focused brand & print package — perfect when you need a logo or flyer designed and print-ready fast. You get a custom design, source files, social formats, and CMYK print files ready for any print shop.",
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

export default {
  SITE_CONFIG,
  PRICING_TIERS,
  TESTIMONIALS,
  FEATURED_PROJECTS,
  FEATURED_FALLBACK,
  CAREER_TIMELINE,
  SKILLS,
  STATS,
  BLOG_POSTS,
  PROCESS_STEPS,
  SERVICE_TIERS_DETAIL
};
