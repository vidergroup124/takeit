/**
 * TakeIT Gaming & Console Store — Main Application Script
 * Supports:
 *  - Guest Storefront (Console Hardware, Game Disc Buy & Daily Rental + Deposit, Upcoming IT Gear)
 *  - Admin Dashboard (USERNAME: takeitcompany2026)
 *  - Online Database Sync (Firebase Cloud Firestore Modular SDK / Supabase REST / Local Server API)
 *  - Google Sheets Order Logging (Apps Script Webhook + UTF-8 BOM CSV/Excel Export)
 */

const ADMIN_CREDENTIALS = {
  username: 'takeitcompany2026',
  password: '990123456789TakeIT*'
};

const STORAGE_KEYS = {
  PRODUCTS: 'takeit_products_v1',
  DELETED_PRODUCTS: 'takeit_deleted_products_v1',
  ORDERS: 'takeit_orders_v1',
  SETTINGS: 'takeit_settings_v1',
  CART: 'takeit_cart_v2',
  ADMIN_SESSION: 'takeit_admin_session_v1',
  SUPPORT: 'takeit_support_v1',
  SAVED_CONTACT: 'takeit_saved_contact_v1',
  CONSOLE_SESSIONS: 'takeit_console_sessions_v1'
};

// High-reliability SVG Data URI generator for crisp gamer product art out of the box
function makeProductBannerSvg(title, subtitle, accent1, accent2, icon) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#070b14"/>
        <stop offset="55%" stop-color="${accent1}"/>
        <stop offset="100%" stop-color="${accent2}"/>
      </linearGradient>
    </defs>
    <rect width="640" height="400" fill="url(#g)"/>
    <circle cx="540" cy="80" r="140" fill="rgba(255,255,255,0.06)"/>
    <circle cx="100" cy="340" r="160" fill="rgba(255,255,255,0.04)"/>
    <text x="44" y="120" font-size="68" font-family="sans-serif">${icon}</text>
    <text x="44" y="215" font-size="30" font-weight="800" fill="#ffffff" font-family="Prompt, sans-serif">${escapeXml(title)}</text>
    <text x="44" y="260" font-size="20" font-weight="600" fill="#cbd5e1" font-family="Prompt, sans-serif">${escapeXml(subtitle)}</text>
    <rect x="44" y="305" width="170" height="38" rx="19" fill="rgba(0,0,0,0.45)"/>
    <text x="64" y="330" font-size="16" font-weight="700" fill="#38bdf8" font-family="Prompt, sans-serif">TAKEIT OFFICIAL</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const DEFAULT_SETTINGS = {
  sheetWebhookUrl: 'https://script.google.com/macros/s/AKfycbzps88OnbnHSjF7zH0R9KTXFksPAtB9xJmv39r9UuEst9i-IYUdZsoZiRKIimWuQHxP9A/exec',
  promptPayId: 'บัญชี xxx-x-x7216-x | เลขที่อ้างอิง 004666006162907 (รับเงินได้จากทุกธนาคาร)',
  bankInfo: 'MAKE by KBank (ธ.กสิกรไทย) ชื่อบัญชี: นาย ภาณุเดช พุทธบัวงาม',
  qrImageUrl: 'payment-qr.jpg',
  shippingFee: 60,
  cloudProvider: 'firebase', // Default to Firebase Cloud so all devices see the same products automatically
  firebaseConfigJson: JSON.stringify({
    apiKey: "AIzaSyDUAxkwmUt6WPUTj294qhPeGwpHOp3772A",
    authDomain: "takeit-ebb5e.firebaseapp.com",
    projectId: "takeit-ebb5e",
    storageBucket: "takeit-ebb5e.firebasestorage.app",
    messagingSenderId: "331086308576",
    appId: "1:331086308576:web:5a54810f2cbbf96bcd5c85",
    measurementId: "G-KP2GB6TJM2"
  }),
  supabaseUrl: '',
  supabaseKey: ''
};

function parseFirebaseConfig(rawInput) {
  const fallbackConfig = {
    apiKey: "AIzaSyDUAxkwmUt6WPUTj294qhPeGwpHOp3772A",
    authDomain: "takeit-ebb5e.firebaseapp.com",
    projectId: "takeit-ebb5e",
    storageBucket: "takeit-ebb5e.firebasestorage.app",
    messagingSenderId: "331086308576",
    appId: "1:331086308576:web:5a54810f2cbbf96bcd5c85",
    measurementId: "G-KP2GB6TJM2"
  };
  if (!rawInput || !String(rawInput).trim()) {
    return fallbackConfig;
  }
  const text = String(rawInput).trim();
  try {
    const parsed = JSON.parse(text);
    if (parsed && parsed.projectId) return parsed;
  } catch (e) {}

  // Support pasting raw JavaScript snippet directly from Firebase Console
  const extracted = {};
  const keys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId'];
  keys.forEach((k) => {
    const regex = new RegExp(`["']?${k}["']?\\s*:\\s*["']([^"']+)["']`);
    const match = text.match(regex);
    if (match && match[1]) {
      extracted[k] = match[1].trim();
    }
  });
  return extracted.projectId ? extracted : fallbackConfig;
}

function sortProductsCatalog(products) {
  const defaultOrder = new Map(DEFAULT_PRODUCTS.map((p, idx) => [p.id, idx]));
  return [...products].sort((a, b) => {
    const aIsCustom = !defaultOrder.has(a.id);
    const bIsCustom = !defaultOrder.has(b.id);
    if (aIsCustom && !bIsCustom) return -1;
    if (!aIsCustom && bIsCustom) return 1;
    if (aIsCustom && bIsCustom) {
      const aTime = Number(a.createdAtMs || String(a.id).replace(/\D/g, '') || 0);
      const bTime = Number(b.createdAtMs || String(b.id).replace(/\D/g, '') || 0);
      return bTime - aTime;
    }
    return (defaultOrder.get(a.id) ?? 999) - (defaultOrder.get(b.id) ?? 999);
  });
}

const DEFAULT_PRODUCTS = [
  {
    id: 'PROD-PS5-PRO',
    name: 'PlayStation 5 Pro Console (2TB SSD)',
    category: 'console',
    platform: 'PS5',
    status: 'ready',
    price: 29490,
    stock: 6,
    canRent: false,
    rentPricePerDay: 0,
    rentDeposit: 0,
    canHomeInstall: true,
    installFee: 500,
    hourlyRate: 35,
    esp32DeviceId: 'ESP32-PS5PRO-01',
    description: 'เครื่องเกมคอนโซลรุ่นท็อป PS5 Pro ความจุ 2TB รองรับ PSSR AI Upscaling และ Ray Tracing ขั้นสูง เลือกซื้อขาด หรือใช้บริการนำเครื่องไปติดตั้งที่บ้าน (จ่ายค่าติดตั้ง + คิดรายชั่วโมงตามจริงผ่านบอร์ด ESP32 Real-time)',
    image: makeProductBannerSvg('PlayStation 5 Pro', '2TB SSD • ซื้อขาด / เช่าติดบ้านรายชั่วโมง', '#1e3a8a', '#172554', '🕹️')
  },
  {
    id: 'PROD-PS5-SLIM',
    name: 'PlayStation 5 Slim รุ่นมีหัวอ่านแผ่น (Disc Edition)',
    category: 'console',
    platform: 'PS5',
    status: 'ready',
    price: 18690,
    stock: 10,
    canRent: false,
    rentPricePerDay: 0,
    rentDeposit: 0,
    canHomeInstall: true,
    installFee: 400,
    hourlyRate: 30,
    esp32DeviceId: 'ESP32-PS5-01',
    description: 'เครื่อง PS5 Slim รุ่นใส่แผ่นบลูเรย์ได้ ความจุ 1TB พร้อมจอย DualSense เลือกซื้อขาด หรือให้ทีมงานนำไปติดตั้งที่บ้าน คิดค่ารายชั่วโมงตามเวลาเปิดเครื่องจริงผ่านบอร์ด ESP32 Real-time',
    image: makeProductBannerSvg('PS5 Slim Disc 1TB', 'ซื้อขาด / เช่าติดบ้าน ฿30/ชม. (ESP32)', '#2563eb', '#0f172a', '🎮')
  },
  {
    id: 'PROD-NSW-OLED',
    name: 'Nintendo Switch – OLED Model (ชุดสีขาว / นีออน)',
    category: 'console',
    platform: 'Switch',
    status: 'ready',
    price: 10990,
    stock: 8,
    canRent: false,
    rentPricePerDay: 0,
    rentDeposit: 0,
    canHomeInstall: true,
    installFee: 300,
    hourlyRate: 25,
    esp32DeviceId: 'ESP32-NSW-01',
    description: 'หน้าจอ OLED สีสดขนาด 7 นิ้ว เล่นได้ทั้งโหมดต่อทีวีและพกพา เลือกซื้อขาด หรือใช้บริการเช่าไปติดตั้งที่บ้าน คิดรายชั่วโมงตามจริงผ่านระบบ ESP32',
    image: makeProductBannerSvg('Nintendo Switch OLED', 'ซื้อขาด / เช่าติดบ้าน ฿25/ชม. (ESP32)', '#be123c', '#4c0519', '🍄')
  },
  {
    id: 'PROD-XBOX-SX',
    name: 'Xbox Series X 1TB Console (รุ่นใส่แผ่นได้)',
    category: 'console',
    platform: 'Xbox',
    status: 'ready',
    price: 19900,
    stock: 4,
    canRent: false,
    rentPricePerDay: 0,
    rentDeposit: 0,
    canHomeInstall: true,
    installFee: 400,
    hourlyRate: 30,
    esp32DeviceId: 'ESP32-XBOX-01',
    description: 'เครื่องคอนโซลขุมพลัง 12 TFLOPS รองรับ 4K 120FPS พร้อมจอยไร้สาย Xbox รองรับทั้งซื้อขาดและบริการเช่าติดตั้งที่บ้านคิดรายชั่วโมงผ่านบอร์ด ESP32',
    image: makeProductBannerSvg('Xbox Series X 1TB', '4K 120FPS • ซื้อขาด / เช่าติดบ้านรายชั่วโมง', '#15803d', '#052e16', '🟢')
  },
  {
    id: 'PROD-DISC-MHWILDS',
    name: 'Monster Hunter Wilds (แผ่นแท้ PS5 Zone 3 ภาษาไทย)',
    category: 'disc',
    platform: 'PS5',
    status: 'ready',
    price: 2290,
    stock: 15,
    canRent: true,
    rentPricePerDay: 50,
    rentDeposit: 600,
    description: 'แผ่นเกมล่าแย้ภาคใหม่ล่าสุด รองรับซับไตเติลภาษาไทย เลือกซื้อขาดหรือเช่าแผ่นรายวันไปเล่นจนจบเนื้อเรื่องได้สุดคุ้ม!',
    image: makeProductBannerSvg('Monster Hunter Wilds', 'แผ่นแท้ PS5 • ซื้อขาด / เช่ารายวัน', '#7c3aed', '#1e1b4b', '🐉')
  },
  {
    id: 'PROD-DISC-ASTROBOT',
    name: 'ASTRO BOT (แผ่นแท้ PS5 โซนไทย)',
    category: 'disc',
    platform: 'PS5',
    status: 'ready',
    price: 1890,
    stock: 12,
    canRent: true,
    rentPricePerDay: 40,
    rentDeposit: 500,
    description: 'เกมยอดเยี่ยมแห่งปี (Game of the Year) ใช้ฟีเจอร์จอย DualSense เต็มรูปแบบ เช่าไปเล่น 7 วันจบได้สบายๆ',
    image: makeProductBannerSvg('ASTRO BOT (PS5)', 'Game of the Year • ซื้อขาด / เช่าแผ่น', '#0284c7', '#1e3a8a', '🤖')
  },
  {
    id: 'PROD-DISC-WUKONG',
    name: 'Black Myth: Wukong – Deluxe Disc Edition (PS5)',
    category: 'disc',
    platform: 'PS5',
    status: 'ready',
    price: 2090,
    stock: 9,
    canRent: true,
    rentPricePerDay: 45,
    rentDeposit: 550,
    description: 'แผ่นเกมแอ็กชัน RPG ตำนานไซอิ๋วสุดอลังการ มีทั้งแบบซื้อเก็บสะสมและบริการเช่าแผ่นรายวัน',
    image: makeProductBannerSvg('Black Myth: Wukong', 'PS5 Physical Disc • ซื้อ / เช่ารายวัน', '#b45309', '#27272a', '🐒')
  },
  {
    id: 'PROD-DISC-ELDEN',
    name: 'Elden Ring: Shadow of the Erdtree Edition (PS5)',
    category: 'disc',
    platform: 'PS5',
    status: 'ready',
    price: 1790,
    stock: 8,
    canRent: true,
    rentPricePerDay: 40,
    rentDeposit: 500,
    description: 'แผ่นเกม Action RPG ระดับตำนานพร้อมภาคเสริม เช่ารายวันไปลองฝีมือหรือซื้อขาดได้เลย',
    image: makeProductBannerSvg('Elden Ring: Erdtree', 'PS5 Disc • ซื้อขาด / เช่าแผ่นรายวัน', '#a16207', '#090d16', '⚔️')
  },
  {
    id: 'PROD-DISC-ZELDA',
    name: 'The Legend of Zelda: Tears of the Kingdom (ตลับแท้ Switch)',
    category: 'disc',
    platform: 'Switch',
    status: 'ready',
    price: 1690,
    stock: 11,
    canRent: true,
    rentPricePerDay: 35,
    rentDeposit: 500,
    description: 'ตลับเกมแท้ Nintendo Switch ผจญภัยอาณาจักรไฮรูล เปิดให้เช่ารายวันเริ่มต้นเพียงวันละ 35 บาท',
    image: makeProductBannerSvg('Zelda: Tears of Kingdom', 'Nintendo Switch • ซื้อ / เช่าตลับเกม', '#0d9488', '#134e4a', '🛡️')
  },
  {
    id: 'PROD-DISC-MARIO-JAM',
    name: 'Super Mario Party Jamboree (ตลับแท้ Switch)',
    category: 'disc',
    platform: 'Switch',
    status: 'ready',
    price: 1590,
    stock: 14,
    canRent: true,
    rentPricePerDay: 35,
    rentDeposit: 450,
    description: 'ตลับเกมปาร์ตี้สุดฮิต เหมาะสำหรับเช่าไปเล่นกับเพื่อนหรือครอบครัวช่วงวันหยุดสุดสัปดาห์!',
    image: makeProductBannerSvg('Mario Party Jamboree', 'Switch Cartridge • เช่าเล่นปาร์ตี้สุดคุ้ม', '#e11d48', '#4c0519', '🎲')
  },
  {
    id: 'PROD-IT-DUALSENSE',
    name: 'จอย PS5 DualSense Wireless Controller (Chroma Indigo)',
    category: 'it_other',
    platform: 'PS5',
    status: 'ready',
    price: 2690,
    stock: 7,
    canRent: false,
    rentPricePerDay: 0,
    rentDeposit: 0,
    description: 'คอนโทรลเลอร์ไร้สายแท้ศูนย์ไทย สีพิเศษ Chroma Indigo รองรับทั้ง PS5 และเชื่อมต่อ PC / Mac / มือถือ',
    image: makeProductBannerSvg('DualSense Controller', 'Chroma Indigo • อุปกรณ์เสริมแท้', '#4f46e5', '#1e1b4b', '🎮')
  },
  {
    id: 'PROD-IT-MONITOR-SOON',
    name: 'Sony INZONE M9 II 27" 4K 160Hz Gaming Monitor',
    category: 'it_other',
    platform: 'IT',
    status: 'coming_soon',
    price: 27990,
    stock: 0,
    canRent: false,
    rentPricePerDay: 0,
    rentDeposit: 0,
    description: '[สินค้าเตรียมเข้าเร็วๆ นี้] จอมอนิเตอร์เกมมิ่ง 4K HDR ออกแบบมาเพื่อ PS5 และเกมเมอร์ PC โดยเฉพาะ',
    image: makeProductBannerSvg('Sony INZONE M9 II 4K', 'COMING SOON • จอเกมมิ่ง 4K 160Hz', '#334155', '#0f172a', '🖥️')
  },
  {
    id: 'PROD-IT-GPU-SOON',
    name: 'การ์ดจอ GeForce RTX 5080 Gaming OC 16GB GDDR7',
    category: 'it_other',
    platform: 'IT',
    status: 'coming_soon',
    price: 45900,
    stock: 0,
    canRent: false,
    rentPricePerDay: 0,
    rentDeposit: 0,
    description: '[สินค้า IT เตรียมเข้าเร็วๆ นี้] การ์ดจอเกมมิ่งรุ่นใหม่สำหรับสาย PC Gaming ทางร้าน TakeIT กำลังนำเข้ามาจำหน่ายเร็วๆ นี้',
    image: makeProductBannerSvg('GeForce RTX 5080 16GB', 'COMING SOON • สินค้า IT สำหรับเกมเมอร์', '#065f46', '#0f172a', '⚡')
  }
];

// Application State
let state = {
  products: [],
  deletedProductsMap: {},
  orders: [],
  supportTickets: [],
  consoleSessions: [],
  settings: { ...DEFAULT_SETTINGS },
  cart: [],
  isAdmin: false,
  activeCategory: 'all',
  activePlatform: 'all',
  activeMode: 'all',
  searchQuery: '',
  pendingSlipDataUrl: '',
  pendingIssueImageDataUrl: '',
  editingProductImages: [],
  firestoreDb: null,
  firebaseModules: null,
  auth: null,
  authModules: null,
  currentUser: null,
  esp32SearchQuery: ''
};

function isAutoGeneratedBannerSvg(src) {
  if (!src || typeof src !== 'string') return false;
  if (!src.startsWith('data:image/svg+xml')) return false;
  try {
    const decoded = decodeURIComponent(src);
    return decoded.includes('TAKEIT OFFICIAL');
  } catch (e) {
    return src.includes('TAKEIT%20OFFICIAL') || src.includes('TAKEIT OFFICIAL');
  }
}

function isAutoGeneratedExtraSlideSvg(src) {
  if (!isAutoGeneratedBannerSvg(src)) return false;
  try {
    const decoded = decodeURIComponent(src);
    return (
      decoded.includes('ภาพสินค้ามุมที่ 2') ||
      decoded.includes('บริการเช่าแผ่น TakeIT') ||
      decoded.includes('รับประกันคุณภาพ TakeIT') ||
      decoded.includes('แผ่นแท้ 100% • เช่า')
    );
  } catch (e) {
    return false;
  }
}

function normalizeImageUrl(rawUrl) {
  const url = String(rawUrl || '').trim();
  if (!url) return '';
  // Convert Google Drive sharing links to direct embeddable image URLs
  const driveMatch = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
  }
  return url;
}

function getProductImages(p) {
  if (!p) return [];
  if (Array.isArray(p.images) && p.images.length > 0) {
    const valid = p.images.filter(Boolean).filter((img) => !isAutoGeneratedExtraSlideSvg(img));
    const realImages = valid.filter((img) => !isAutoGeneratedBannerSvg(img));
    if (realImages.length > 0) return realImages;
    if (valid.length > 0) return valid;
  }
  if (p.image && !isAutoGeneratedExtraSlideSvg(p.image)) {
    return [p.image];
  }
  const fallback = makeProductBannerSvg(p.name || 'TakeIT', p.platform || 'Console', '#1e3a8a', '#0f172a', '🎮');
  return [fallback];
}

function getProductShippingFee(product) {
  if (!product) return Number(state.settings?.shippingFee ?? 60);
  if (product.shippingFee !== undefined && product.shippingFee !== null && product.shippingFee !== '') {
    const val = Number(product.shippingFee);
    if (!Number.isNaN(val) && val >= 0) {
      if (product.category === 'console' && val === 150) return 200;
      return val;
    }
  }
  if (product.category === 'console') return 200;
  if (product.category === 'disc') return 50;
  if (product.category === 'it_other') return 80;
  return Number(state.settings?.shippingFee ?? 60);
}

function getCartItemShippingFeePerUnit(item, preferSnapshot = false) {
  if (!item) return 0;
  if (item.mode === 'home_install') return 0;
  if (preferSnapshot && item.shippingFee !== undefined && item.shippingFee !== null && item.shippingFee !== '') {
    const snapVal = Number(item.shippingFee);
    if (!Number.isNaN(snapVal) && snapVal >= 0) return snapVal;
  }
  const prod = state.products.find((p) => p.id === item.productId);
  if (prod) {
    return getProductShippingFee(prod);
  }
  if (item.shippingFee !== undefined && item.shippingFee !== null && item.shippingFee !== '') {
    const val = Number(item.shippingFee);
    if (!Number.isNaN(val) && val >= 0) return val;
  }
  return Number(state.settings?.shippingFee ?? 60);
}

function ensureProductGalleryImages(products) {
  if (!Array.isArray(products)) return [];
  const defaultMap = new Map(DEFAULT_PRODUCTS.map((dp) => [dp.id, dp]));
  return products.map((p) => {
    const cleaned = getProductImages(p);
    const def = defaultMap.get(p.id);
    const isConsole = p.category === 'console';
    const canHomeInstall = p.canHomeInstall !== undefined
      ? Boolean(p.canHomeInstall)
      : (def?.canHomeInstall !== undefined ? Boolean(def.canHomeInstall) : isConsole);
    const installFee = p.installFee !== undefined && p.installFee !== ''
      ? Number(p.installFee)
      : (def?.installFee ?? (isConsole ? 400 : 0));
    const hourlyRate = p.hourlyRate !== undefined && p.hourlyRate !== ''
      ? Number(p.hourlyRate)
      : (def?.hourlyRate ?? (isConsole ? 30 : 0));
    const rawDevId = p.esp32DeviceId || def?.esp32DeviceId || (isConsole ? (String(p.platform || '').toUpperCase() === 'PS4' ? 'PS4_01' : `ESP32-${String(p.platform || 'CON').toUpperCase()}-01`) : '');
    const esp32DeviceId = (rawDevId === 'ESP32-PS4-01') ? 'PS4_01' : rawDevId;

    return {
      ...p,
      canHomeInstall,
      installFee,
      hourlyRate,
      esp32DeviceId,
      shippingFee: getProductShippingFee(p),
      image: cleaned[0],
      images: cleaned
    };
  });
}

// ============================================================================
// Modern Web Guidance Fallbacks & Accessibility Helpers
// ============================================================================

// 1. Light-dismiss fallback for <dialog closedby="any"> (from light-dismiss-a-dialog guide)
function initDialogBestPractices() {
  const allDialogs = document.querySelectorAll('dialog');
  allDialogs.forEach((dialog) => {
    // Reset returnValue on close to avoid stale values leaking across opens (from dialog guide)
    dialog.addEventListener('close', () => {
      dialog.returnValue = '';
    });
  });

  if (!('closedBy' in HTMLDialogElement.prototype)) {
    document.querySelectorAll('dialog[closedby="any"]').forEach((dialog) => {
      dialog.addEventListener('click', (event) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent = (
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width
        );
        if (isDialogContent) return;
        dialog.close();
      });
    });
  }

  // Close buttons with data-close-dialog
  document.querySelectorAll('[data-close-dialog]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-close-dialog');
      const dlg = document.getElementById(targetId);
      if (dlg && dlg.open) dlg.close();
    });
  });
}

// 2. Validate Input After Interaction fallback & ARIA sync (from validate-input-after-interaction guide)
const UserInvalidFallback = (() => {
  const dirtyState = new WeakMap();

  const updateState = (input) => {
    if (!input.checkValidity) return;
    const isValid = input.checkValidity();
    input.classList.toggle('user-invalid-fallback', !isValid);
    input.classList.toggle('user-valid-fallback', isValid);
    if (!isValid) {
      input.setAttribute('aria-invalid', 'true');
    } else {
      input.removeAttribute('aria-invalid');
    }
  };

  const handleEvent = (event) => {
    const input = event.target;
    if (event.type === 'reset') {
      const controls = input.elements || [];
      for (const control of controls) {
        dirtyState.delete(control);
        control.classList.remove('user-invalid-fallback', 'user-valid-fallback');
        control.removeAttribute('aria-invalid');
      }
      return;
    }
    if (!input || !input.checkValidity) return;
    if (event.type === 'input' || event.type === 'change') {
      const st = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
      st.hasInteracted = true;
      dirtyState.set(input, st);
      if (st.hasBlurred) updateState(input);
    } else if (event.type === 'blur') {
      const st = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
      st.hasBlurred = true;
      dirtyState.set(input, st);
      if (st.hasInteracted) updateState(input);
    }
  };

  const init = (root = document) => {
    // Sync aria-invalid with native :user-invalid
    const syncAria = (el) => {
      if (!el || typeof el.matches !== 'function') return;
      try {
        if (CSS.supports('selector(:user-invalid)')) {
          el.setAttribute('aria-invalid', el.matches(':user-invalid') ? 'true' : 'false');
        }
      } catch (e) {}
    };
    root.addEventListener('blur', (e) => syncAria(e.target), true);
    root.addEventListener('input', (e) => {
      if (e.target && e.target.hasAttribute && e.target.hasAttribute('aria-invalid')) {
        syncAria(e.target);
      }
    });

    if (typeof CSS !== 'undefined' && CSS.supports && CSS.supports('selector(:user-invalid)')) return;
    root.addEventListener('blur', handleEvent, true);
    root.addEventListener('input', handleEvent);
    root.addEventListener('change', handleEvent);
    root.addEventListener('reset', handleEvent, true);
  };

  return { init };
})();

// ============================================================================
// Storage & Cloud Synchronization Engine (Local + Server + Firebase + Supabase)
// ============================================================================
async function loadInitialData() {
  // 1. Load from localStorage first for instant render
  try {
    const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      // Upgrade old placeholder bank settings to the owner's actual MAKE by KBank QR & account
      if (parsed.promptPayId === '0812345678') {
        parsed.promptPayId = DEFAULT_SETTINGS.promptPayId;
      }
      if (parsed.bankInfo && parsed.bankInfo.includes('123-4-56789-0')) {
        parsed.bankInfo = DEFAULT_SETTINGS.bankInfo;
      }
      if (!parsed.qrImageUrl) {
        parsed.qrImageUrl = DEFAULT_SETTINGS.qrImageUrl;
      }
      if (!parsed.sheetWebhookUrl || !String(parsed.sheetWebhookUrl).includes('script.google.com/macros/s/')) {
        parsed.sheetWebhookUrl = DEFAULT_SETTINGS.sheetWebhookUrl;
      }
      // Upgrade any device that was previously on 'local' mode to 'firebase' (takeit-ebb5e) so all devices sync together
      if (!parsed.cloudProvider || parsed.cloudProvider === 'local') {
        parsed.cloudProvider = 'firebase';
      }
      if (!parsed.firebaseConfigJson || !parsed.firebaseConfigJson.includes('AIzaSyDUAxkwmUt6WPUTj294qhPeGwpHOp3772A')) {
        parsed.firebaseConfigJson = DEFAULT_SETTINGS.firebaseConfigJson;
      }
      state.settings = {
        ...DEFAULT_SETTINGS,
        ...parsed,
        sheetWebhookUrl: (parsed.sheetWebhookUrl && String(parsed.sheetWebhookUrl).includes('script.google.com/macros/s/'))
          ? parsed.sheetWebhookUrl
          : DEFAULT_SETTINGS.sheetWebhookUrl,
        cloudProvider: parsed.cloudProvider || 'firebase',
        firebaseConfigJson: parsed.firebaseConfigJson || DEFAULT_SETTINGS.firebaseConfigJson
      };
    } else {
      state.settings = { ...DEFAULT_SETTINGS };
    }
    const savedDeletedProds = localStorage.getItem(STORAGE_KEYS.DELETED_PRODUCTS);
    if (savedDeletedProds) {
      try {
        const parsedDel = JSON.parse(savedDeletedProds);
        if (parsedDel && typeof parsedDel === 'object') {
          state.deletedProductsMap = parsedDel;
        }
      } catch (e) {}
    }

    const savedProducts = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (savedProducts) {
      const parsedProds = JSON.parse(savedProducts);
      if (Array.isArray(parsedProds)) {
        let changed = false;
        state.products = parsedProds.filter((p) => {
          if (!p || !p.id || p.isDeleted) return false;
          const delMs = Number(state.deletedProductsMap[p.id] || 0);
          return !(delMs > 0 && delMs >= Number(p.updatedAtMs || 0));
        });
        state.products.forEach((p) => {
          if (p.category === 'console' && (p.shippingFee === 150 || p.shippingFee === '150')) {
            p.shippingFee = 200;
            changed = true;
          }
        });
        if (changed) {
          try {
            localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(state.products));
          } catch (e) {}
        }
      }
    }
    const savedOrders = localStorage.getItem(STORAGE_KEYS.ORDERS);
    if (savedOrders) {
      state.orders = JSON.parse(savedOrders);
    }
    // Remove legacy stuck v1 cart key from earlier quota-overflow bug
    try { localStorage.removeItem('takeit_cart_v1'); } catch (e) {}
    const savedCart = localStorage.getItem(STORAGE_KEYS.CART);
    if (savedCart) {
      const parsedCart = JSON.parse(savedCart);
      state.cart = Array.isArray(parsedCart) ? parsedCart : [];
    }
    const savedSupport = localStorage.getItem(STORAGE_KEYS.SUPPORT);
    if (savedSupport) {
      try {
        state.supportTickets = JSON.parse(savedSupport);
      } catch (e) {}
    }
    const savedConsoleSessions = localStorage.getItem(STORAGE_KEYS.CONSOLE_SESSIONS);
    if (savedConsoleSessions) {
      try {
        const parsedSessions = JSON.parse(savedConsoleSessions);
        if (Array.isArray(parsedSessions)) {
          state.consoleSessions = parsedSessions.map((s) => {
            if ((s.id === 'ESP32-PS4-01' || s.deviceId === 'ESP32-PS4-01') && (!s.customerPhone || s.customerName === 'พร้อมเชื่อมบอร์ด ESP32 ของลูกค้า')) {
              return { ...s, isDeleted: true, deletedAtMs: s.deletedAtMs || Date.now() };
            }
            return s;
          });
        }
      } catch (e) {}
    }
    state.isAdmin = sessionStorage.getItem(STORAGE_KEYS.ADMIN_SESSION) === 'true';
  } catch (err) {
    console.warn('Local storage read warning:', err);
  }

  // 2. Try syncing from local Node.js server (/api/state) if running via node server.js
  try {
    const res = await fetch('/api/state', { method: 'GET' });
    if (res.ok) {
      const json = await res.json();
      if (json && json.data) {
        if (Array.isArray(json.data.products) && json.data.products.length > 0) {
          state.products = json.data.products.filter((p) => {
            if (!p || !p.id || p.isDeleted) return false;
            const delMs = Number(state.deletedProductsMap[p.id] || 0);
            return !(delMs > 0 && delMs >= Number(p.updatedAtMs || 0));
          });
        }
        if (Array.isArray(json.data.orders) && json.data.orders.length > 0) {
          state.orders = json.data.orders;
        }
        if (json.data.settings) {
          state.settings = { ...state.settings, ...json.data.settings };
        }
      }
    }
  } catch (e) {
    // Running statically without server.js — totally fine
  }

  const hasSavedProductsKey = localStorage.getItem(STORAGE_KEYS.PRODUCTS) !== null;
  const hasDeletedHistory = Object.keys(state.deletedProductsMap || {}).length > 0;
  if ((!Array.isArray(state.products) || state.products.length === 0) && !hasSavedProductsKey && !hasDeletedHistory) {
    state.products = [...DEFAULT_PRODUCTS];
  }
  state.products = ensureProductGalleryImages(state.products || []);

  // 3. Connect to Firebase Firestore or Supabase if configured
  await initCloudConnection();
  state.products = ensureProductGalleryImages(state.products || []);
  pruneCartAgainstCatalog();

  saveStateLocally();
  renderAll();

  // 4. Automatically push any existing orders to Google Sheets in the background so no order is ever missed
  if (state.orders.length > 0) {
    autoSyncOrdersToGoogleSheetSilent();
  }
}

function pruneCartAgainstCatalog() {
  if (!Array.isArray(state.cart) || state.cart.length === 0) return;
  const prodMap = new Map((state.products || []).map((p) => [p.id, p]));
  const filtered = state.cart.filter((item) => item && item.productId && prodMap.has(item.productId));
  if (filtered.length !== state.cart.length) {
    state.cart = filtered;
  }
}

function safeSetLocalStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    return false;
  }
}

function saveStateLocally() {
  // 1. Always save lightweight, critical keys FIRST so large images never block cart/deletions via QuotaExceededError
  const compactCart = (state.cart || []).map((item) => ({
    ...item,
    image: (item.image && String(item.image).startsWith('data:') && String(item.image).length > 4000) ? '' : (item.image || '')
  }));
  safeSetLocalStorage(STORAGE_KEYS.CART, compactCart);
  safeSetLocalStorage(STORAGE_KEYS.DELETED_PRODUCTS, state.deletedProductsMap || {});
  safeSetLocalStorage(STORAGE_KEYS.CONSOLE_SESSIONS, state.consoleSessions || []);
  safeSetLocalStorage(STORAGE_KEYS.SETTINGS, state.settings);

  // 2. Save support tickets (fallback without heavy base64 attachments if localStorage is full)
  if (!safeSetLocalStorage(STORAGE_KEYS.SUPPORT, state.supportTickets || [])) {
    const liteTickets = (state.supportTickets || []).map((t) => ({
      ...t,
      imageDataUrl: (t.imageDataUrl && String(t.imageDataUrl).length > 4000) ? '' : (t.imageDataUrl || '')
    }));
    safeSetLocalStorage(STORAGE_KEYS.SUPPORT, liteTickets);
  }

  // 3. Save orders (fallback stripping base64 slip images in localStorage cache only; Firebase keeps full slips)
  if (!safeSetLocalStorage(STORAGE_KEYS.ORDERS, state.orders || [])) {
    const liteOrders = (state.orders || []).slice(0, 60).map((o) => ({
      ...o,
      slipDataUrl: (o.slipDataUrl && String(o.slipDataUrl).length > 4000) ? '' : (o.slipDataUrl || '')
    }));
    safeSetLocalStorage(STORAGE_KEYS.ORDERS, liteOrders);
  }

  // 4. Save products (fallback stripping oversized custom base64 images in localStorage cache only; Firebase keeps full images)
  if (!safeSetLocalStorage(STORAGE_KEYS.PRODUCTS, state.products || [])) {
    const liteProducts = (state.products || []).map((p) => ({
      ...p,
      image: (p.image && String(p.image).startsWith('data:image/') && !String(p.image).startsWith('data:image/svg') && String(p.image).length > 4000) ? '' : (p.image || ''),
      images: []
    }));
    safeSetLocalStorage(STORAGE_KEYS.PRODUCTS, liteProducts);
  }

  // Also persist to local server API asynchronously if available
  fetch('/api/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      products: state.products,
      deletedProductsMap: state.deletedProductsMap,
      orders: state.orders,
      supportTickets: state.supportTickets,
      consoleSessions: state.consoleSessions,
      settings: state.settings
    })
  }).catch(() => {});
}

async function initCloudConnection() {
  const pill = document.getElementById('db-status-pill');
  const provider = state.settings.cloudProvider || 'firebase';

  if (provider === 'firebase') {
    try {
      const firebaseConfig = parseFirebaseConfig(state.settings.firebaseConfigJson);

      // Dynamically load Modular Firebase SDK v10 (App, Firestore, Auth)
      const appMod = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js');
      const fsMod = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
      const authMod = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js');

      const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(firebaseConfig);
      const db = fsMod.getFirestore(app);
      state.firestoreDb = db;
      state.firebaseModules = fsMod;

      const auth = authMod.getAuth(app);
      state.auth = auth;
      state.authModules = authMod;

      if (!state.authListenerAttached) {
        state.authListenerAttached = true;
        authMod.onAuthStateChanged(auth, (user) => {
          if (user) {
            state.currentUser = {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || (user.email ? user.email.split('@')[0] : 'ลูกค้า'),
              photoURL: user.photoURL || ''
            };
          } else {
            state.currentUser = null;
          }
          renderCustomerAuthUI();
        });
      }

      // 1. Initial fetch of products from Firestore
      const prodSnap = await fsMod.getDocs(fsMod.collection(db, 'takeit_products'));
      if (!prodSnap.empty) {
        const cloudMap = new Map();
        prodSnap.forEach((docSnap) => {
          const p = docSnap.data();
          const pid = p?.id || docSnap.id;
          if (!pid) return;
          if (p.isDeleted) {
            const delMs = Math.max(Number(p.deletedAtMs || 0), Number(p.updatedAtMs || 0), 1);
            state.deletedProductsMap[pid] = Math.max(Number(state.deletedProductsMap[pid] || 0), delMs);
            cloudMap.delete(pid);
            return;
          }
          const localDelMs = Number(state.deletedProductsMap[pid] || 0);
          if (localDelMs > 0 && localDelMs >= Number(p.updatedAtMs || 0)) {
            // Was deleted locally more recently — sync tombstone up to Firestore
            fsMod.setDoc(fsMod.doc(db, 'takeit_products', docSnap.id), {
              id: pid,
              isDeleted: true,
              deletedAtMs: localDelMs,
              updatedAtMs: localDelMs
            }).catch(() => {});
            return;
          }
          cloudMap.set(pid, p);
        });

        // Push any custom or more recently updated products (that were NOT deleted) to Cloud
        for (const lp of state.products) {
          if (!lp || !lp.id || lp.isDeleted) continue;
          const delMs = Number(state.deletedProductsMap[lp.id] || 0);
          const localTime = Number(lp.updatedAtMs || 0);
          if (delMs > 0 && delMs >= localTime) continue;

          const isCustomLocal = /^PROD-\d+$/.test(String(lp.id)) || lp.isCustom;
          const cloudProd = cloudMap.get(lp.id);
          const cloudTime = Number(cloudProd?.updatedAtMs || 0);
          if ((isCustomLocal && !cloudProd) || (cloudProd && localTime > cloudTime)) {
            const cleanedLp = ensureProductGalleryImages([lp])[0];
            cloudMap.set(lp.id, cleanedLp);
            fsMod.setDoc(fsMod.doc(db, 'takeit_products', lp.id), cleanedLp).catch(() => {});
          }
        }
        state.products = sortProductsCatalog(ensureProductGalleryImages(Array.from(cloudMap.values())));
      } else {
        // Firestore collection is empty — only seed if user hasn't intentionally deleted products
        if (Object.keys(state.deletedProductsMap || {}).length === 0) {
          await pushAllToCloud();
        }
      }

      // 2. Initial fetch & merge of orders from Firestore
      const orderSnap = await fsMod.getDocs(fsMod.collection(db, 'takeit_orders'));
      const orderMap = new Map();
      if (!orderSnap.empty) {
        orderSnap.forEach((docSnap) => {
          const d = docSnap.data();
          if (d && d.id) orderMap.set(d.id, d);
        });
      }
      for (const localOrd of state.orders) {
        if (!localOrd || !localOrd.id) continue;
        const cloudOrd = orderMap.get(localOrd.id);
        const localTime = Number(localOrd.updatedAtMs || 0);
        const cloudTime = Number(cloudOrd?.updatedAtMs || 0);
        if (!cloudOrd || localTime > cloudTime) {
          orderMap.set(localOrd.id, localOrd);
          fsMod.setDoc(fsMod.doc(db, 'takeit_orders', localOrd.id), localOrd).catch(() => {});
        }
      }
      if (orderMap.size > 0) {
        const mergedOrders = Array.from(orderMap.values()).filter((o) => !o.permanentlyErased);
        mergedOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        state.orders = mergedOrders;
      }

      // 3. Initial fetch & merge of support tickets / product requests from Firestore
      try {
        const supportSnap = await fsMod.getDocs(fsMod.collection(db, 'takeit_support'));
        const supportMap = new Map();
        if (!supportSnap.empty) {
          supportSnap.forEach((docSnap) => {
            const d = docSnap.data();
            if (d && d.id) supportMap.set(d.id, d);
          });
        }
        for (const localTkt of (state.supportTickets || [])) {
          if (!localTkt || !localTkt.id) continue;
          const cloudTkt = supportMap.get(localTkt.id);
          const localTime = Number(localTkt.updatedAtMs || 0);
          const cloudTime = Number(cloudTkt?.updatedAtMs || 0);
          if (!cloudTkt || localTime > cloudTime) {
            supportMap.set(localTkt.id, localTkt);
            fsMod.setDoc(fsMod.doc(db, 'takeit_support', localTkt.id), localTkt).catch(() => {});
          }
        }
        if (supportMap.size > 0) {
          const mergedTickets = Array.from(supportMap.values()).filter((t) => !t.isDeleted);
          mergedTickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          state.supportTickets = mergedTickets;
        }
      } catch (err) {
        console.warn('Initial support tickets fetch skipped/warning:', err);
      }

      // 4. Real-time listeners so any product or order added on one device appears on all other devices automatically
      if (!state.unsubscribeFirestore) {
        const unsubProd = fsMod.onSnapshot(fsMod.collection(db, 'takeit_products'), (snap) => {
          const localMap = new Map((state.products || []).map((p) => [p.id, p]));
          const liveMap = new Map();
          snap.forEach((d) => {
            const cloudProd = d.data();
            const pid = cloudProd?.id || d.id;
            if (!pid) return;
            if (cloudProd.isDeleted) {
              const delMs = Math.max(Number(cloudProd.deletedAtMs || 0), Number(cloudProd.updatedAtMs || 0), 1);
              state.deletedProductsMap[pid] = Math.max(Number(state.deletedProductsMap[pid] || 0), delMs);
              liveMap.delete(pid);
              return;
            }
            const localDelMs = Number(state.deletedProductsMap[pid] || 0);
            if (localDelMs > 0 && localDelMs >= Number(cloudProd.updatedAtMs || 0)) {
              return;
            }
            const localProd = localMap.get(pid);
            const picked = (localProd && !localProd.isDeleted && Number(localProd.updatedAtMs || 0) > Number(cloudProd.updatedAtMs || 0))
              ? localProd
              : cloudProd;
            liveMap.set(pid, picked);
          });
          state.products = sortProductsCatalog(ensureProductGalleryImages(Array.from(liveMap.values())));
          pruneCartAgainstCatalog();
          saveStateLocally();
          renderCartBadge();
          renderStorefront();
          if (document.getElementById('dialog-cart')?.open) {
            renderCartModalContents();
          }
          if (state.isAdmin) {
            renderAdminStats();
            renderAdminProductsTable();
          }
        });

        const unsubOrd = fsMod.onSnapshot(fsMod.collection(db, 'takeit_orders'), (snap) => {
          const localMap = new Map((state.orders || []).map((o) => [o.id, o]));
          const liveOrders = [];
          snap.forEach((d) => {
            const cloudOrd = d.data();
            const localOrd = localMap.get(cloudOrd.id);
            const picked = (localOrd && Number(localOrd.updatedAtMs || 0) > Number(cloudOrd.updatedAtMs || 0))
              ? localOrd
              : cloudOrd;
            if (!picked.permanentlyErased) {
              liveOrders.push(picked);
            }
          });
          liveOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          state.orders = liveOrders;
          saveStateLocally();
          if (state.isAdmin) {
            renderAdminStats();
            renderAdminOrdersTable();
          }
          const lookupDlg = document.getElementById('dialog-order-lookup');
          if (lookupDlg && lookupDlg.open) {
            refreshOpenOrderLookupModal();
          }
        });

        const unsubSupport = fsMod.onSnapshot(fsMod.collection(db, 'takeit_support'), (snap) => {
          const localMap = new Map((state.supportTickets || []).map((t) => [t.id, t]));
          const liveTickets = [];
          snap.forEach((d) => {
            const cloudTkt = d.data();
            const localTkt = localMap.get(cloudTkt.id);
            const picked = (localTkt && Number(localTkt.updatedAtMs || 0) > Number(cloudTkt.updatedAtMs || 0))
              ? localTkt
              : cloudTkt;
            if (!picked.isDeleted) {
              liveTickets.push(picked);
            }
          });
          liveTickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          state.supportTickets = liveTickets;
          saveStateLocally();
          updateSupportBadgeCount();
          if (state.isAdmin) {
            renderAdminSupportTicketsTable();
          }
        });

        const mergeEsp32CloudSnapshot = (snap) => {
          const existingMap = new Map((state.consoleSessions || []).map((s) => [s.deviceId || s.id, s]));
          const getFreshnessMs = (rec) => {
            const eMs = Number(rec?.last_timestamp || 0) > 1700000000 ? Number(rec.last_timestamp) * 1000 : 0;
            return Math.max(eMs, Number(rec?.updatedAtMs || 0), Number(rec?.manualActionAtMs || 0));
          };

          snap.forEach((d) => {
            const rawData = d.data();
            const devKey = String(rawData.console_name || rawData.deviceId || rawData.esp32DeviceId || d.id).trim();
            const prev = existingMap.get(devKey) || {};
            const wasDeleted = Boolean(prev.isDeleted || rawData.isDeleted);
            const deletedAtMs = Math.max(Number(prev.deletedAtMs || 0), Number(rawData.deletedAtMs || 0));
            const espEpochMs = Number(rawData.last_timestamp || 0) > 1700000000 ? Number(rawData.last_timestamp) * 1000 : 0;

            // Keep deleted items deleted unless real ESP32 hardware sent a brand-new heartbeat after deletion
            if (wasDeleted && !(espEpochMs > 0 && espEpochMs > deletedAtMs + 5000)) {
              existingMap.set(devKey, {
                ...prev,
                ...rawData,
                id: devKey,
                deviceId: devKey,
                isDeleted: true,
                deletedAtMs: deletedAtMs || Date.now()
              });
              return;
            }

            // Auto-suppress legacy placeholder ESP32-PS4-01 if it has no real hardware heartbeat
            if (devKey === 'ESP32-PS4-01' && !espEpochMs && (!rawData.customerPhone || rawData.customerName === 'พร้อมเชื่อมบอร์ด ESP32 ของลูกค้า')) {
              existingMap.set(devKey, { id: devKey, deviceId: devKey, isDeleted: true, deletedAtMs: Date.now() });
              return;
            }

            const prevFresh = getFreshnessMs(prev);
            const cloudFresh = getFreshnessMs(rawData);
            const mergedRaw = prevFresh > cloudFresh
              ? { ...rawData, ...prev, id: devKey, deviceId: devKey, isDeleted: false }
              : { ...prev, ...rawData, id: devKey, deviceId: devKey, isDeleted: false };

            const norm = normalizeEsp32SessionRecord(mergedRaw, devKey);
            if (norm) {
              existingMap.set(devKey, norm);
            }
          });
          const allRecords = Array.from(existingMap.values());
          allRecords.sort((a, b) => Number(b.updatedAtMs || 0) - Number(a.updatedAtMs || 0));
          state.consoleSessions = allRecords;
          saveStateLocally();
          updateEsp32BadgeCount();
          refreshEsp32ViewsIfOpen();
        };

        const unsubEsp32 = fsMod.onSnapshot(fsMod.collection(db, 'takeit_console_sessions'), mergeEsp32CloudSnapshot);
        const unsubPs4Tracker = fsMod.onSnapshot(fsMod.collection(db, 'ps4_tracker'), mergeEsp32CloudSnapshot);

        state.unsubscribeFirestore = () => {
          unsubProd();
          unsubOrd();
          unsubSupport();
          unsubEsp32();
          unsubPs4Tracker();
        };
      }

      if (pill) {
        pill.textContent = `☁️ ออนไลน์ (${firebaseConfig.projectId})`;
        pill.style.borderColor = 'rgba(16, 185, 129, 0.5)';
        pill.style.color = '#34d399';
      }
      return;
    } catch (err) {
      console.error('Firebase connection error:', err);
      showToast('⚠️ การเชื่อมต่อ Firebase ขัดข้อง: ' + (err.message || err), 'warning');
    }
  }

  if (provider === 'supabase' && state.settings.supabaseUrl && state.settings.supabaseKey) {
    try {
      const baseUrl = state.settings.supabaseUrl.replace(/\/$/, '');
      const headers = {
        apikey: state.settings.supabaseKey,
        Authorization: `Bearer ${state.settings.supabaseKey}`,
        'Content-Type': 'application/json'
      };
      const res = await fetch(`${baseUrl}/rest/v1/takeit_store_kv?select=key,value`, { headers });
      if (res.ok) {
        const rows = await res.json();
        rows.forEach((r) => {
          if (r.key === 'products' && Array.isArray(r.value)) state.products = r.value;
          if (r.key === 'orders' && Array.isArray(r.value)) state.orders = r.value;
        });
        if (pill) {
          pill.textContent = '☁️ เชื่อมต่อ Supabase Cloud แล้ว';
          pill.style.borderColor = 'rgba(16, 185, 129, 0.5)';
          pill.style.color = '#34d399';
        }
        return;
      }
    } catch (err) {
      console.error('Supabase connection error:', err);
    }
  }

  if (pill) {
    pill.textContent = state.settings.sheetWebhookUrl
      ? '📊 เชื่อมต่อ Google Sheets + Local DB พร้อมใช้งาน'
      : '⚡ ระบบฐานข้อมูลพร้อมใช้งานทันที';
  }
}

async function saveProductToCloud(product) {
  if (state.settings.cloudProvider === 'firebase') {
    if (!state.firestoreDb || !state.firebaseModules) {
      await initCloudConnection();
    }
    if (state.firestoreDb && state.firebaseModules) {
      try {
        const { doc, setDoc } = state.firebaseModules;
        await setDoc(doc(state.firestoreDb, 'takeit_products', product.id), product);
      } catch (err) {
        console.error('Firestore save product error:', err);
        showToast('⚠️ ไม่สามารถซิงค์สินค้าขึ้น Firebase ได้ (รูปภาพอาจมีขนาดรวมใหญ่เกิน 1MB): ' + (err.message || ''), 'error');
      }
    }
  } else if (state.settings.cloudProvider === 'supabase' && state.settings.supabaseUrl && state.settings.supabaseKey) {
    await syncSupabaseKeyValue('products', state.products);
  }
}

async function deleteProductFromCloud(productId, deletedAtMs = Date.now()) {
  if (state.settings.cloudProvider === 'firebase') {
    if (!state.firestoreDb || !state.firebaseModules) {
      await initCloudConnection();
    }
    if (state.firestoreDb && state.firebaseModules) {
      try {
        const { doc, setDoc, collection, getDocs, deleteDoc } = state.firebaseModules;
        const tombstone = {
          id: productId,
          isDeleted: true,
          deletedAtMs,
          updatedAtMs: deletedAtMs
        };
        // Write lightweight tombstone to prevent any other tab/device cache from resurrecting deleted product
        await setDoc(doc(state.firestoreDb, 'takeit_products', productId), tombstone);

        // Also clean up if any legacy/duplicate Firestore document exists with different doc.id
        const snap = await getDocs(collection(state.firestoreDb, 'takeit_products')).catch(() => null);
        if (snap && !snap.empty) {
          for (const d of snap.docs) {
            if (d.id !== productId && d.data()?.id === productId) {
              await deleteDoc(doc(state.firestoreDb, 'takeit_products', d.id)).catch(() => {});
            }
          }
        }
      } catch (err) {
        console.error('Firestore delete product error:', err);
        showToast('⚠️ ลบในเครื่องแล้ว แต่ไม่สามารถลบสินค้าบน Firebase ได้: ' + (err.message || ''), 'warning');
      }
    }
  } else if (state.settings.cloudProvider === 'supabase' && state.settings.supabaseUrl && state.settings.supabaseKey) {
    await syncSupabaseKeyValue('products', state.products);
  }
}

async function saveOrderToCloud(order) {
  if (state.settings.cloudProvider === 'firebase') {
    if (!state.firestoreDb || !state.firebaseModules) {
      await initCloudConnection();
    }
    if (state.firestoreDb && state.firebaseModules) {
      try {
        const { doc, setDoc } = state.firebaseModules;
        await setDoc(doc(state.firestoreDb, 'takeit_orders', order.id), order);
      } catch (err) {
        console.error('Firestore save order error:', err);
      }
    }
  } else if (state.settings.cloudProvider === 'supabase' && state.settings.supabaseUrl && state.settings.supabaseKey) {
    await syncSupabaseKeyValue('orders', state.orders);
  }
}

async function pushAllToCloud() {
  if (state.settings.cloudProvider === 'firebase' && state.firestoreDb && state.firebaseModules) {
    const { doc, setDoc } = state.firebaseModules;
    for (const p of state.products) {
      await setDoc(doc(state.firestoreDb, 'takeit_products', p.id), p);
    }
    for (const o of state.orders) {
      await setDoc(doc(state.firestoreDb, 'takeit_orders', o.id), o);
    }
    showToast('☁️ ซิงค์ข้อมูลสินค้าและออเดอร์ขึ้น Firebase Firestore สำเร็จ!');
  } else if (state.settings.cloudProvider === 'supabase' && state.settings.supabaseUrl && state.settings.supabaseKey) {
    await syncSupabaseKeyValue('products', state.products);
    await syncSupabaseKeyValue('orders', state.orders);
    showToast('☁️ ซิงค์ข้อมูลขึ้น Supabase สำเร็จ!');
  } else {
    saveStateLocally();
    showToast('💾 บันทึกข้อมูลลงระบบเรียบร้อยแล้ว');
  }
}

async function syncSupabaseKeyValue(key, value) {
  try {
    const baseUrl = state.settings.supabaseUrl.replace(/\/$/, '');
    await fetch(`${baseUrl}/rest/v1/takeit_store_kv`, {
      method: 'POST',
      headers: {
        apikey: state.settings.supabaseKey,
        Authorization: `Bearer ${state.settings.supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ key, value })
    });
  } catch (err) {
    console.error('Supabase sync error:', err);
  }
}

async function deleteOrderFromCloud(orderId) {
  if (state.settings.cloudProvider === 'firebase') {
    if (!state.firestoreDb || !state.firebaseModules) {
      await initCloudConnection();
    }
    if (state.firestoreDb && state.firebaseModules) {
      try {
        const { doc, deleteDoc } = state.firebaseModules;
        await deleteDoc(doc(state.firestoreDb, 'takeit_orders', orderId));
      } catch (err) {
        console.error('Firestore delete order error:', err);
      }
    }
  } else if (state.settings.cloudProvider === 'supabase' && state.settings.supabaseUrl && state.settings.supabaseKey) {
    await syncSupabaseKeyValue('orders', state.orders);
  }
}

async function deleteOrderFromGoogleSheet(orderId, reason = '') {
  const webhookUrl = getValidSheetWebhookUrl();
  if (!webhookUrl || !orderId) return false;

  // 1. Send delete_order action (supported by updated google-apps-script.gs to deleteRow)
  await postPayloadToGoogleSheet(webhookUrl, {
    action: 'delete_order',
    orderId
  });

  // 2. Also send sync_order with _deleteFromSheet: true and cleared customer fields so even if Apps Script hasn't been re-deployed yet, the row in Google Sheets is wiped/marked deleted immediately
  return postPayloadToGoogleSheet(webhookUrl, {
    action: 'sync_order',
    order: {
      id: orderId,
      originalOrderId: orderId,
      isDeletedByAdmin: true,
      _deleteFromSheet: true,
      createdAtFormatted: '-',
      orderTypeLabel: '🗑️ ลบรายการแล้ว',
      customer: {
        name: '[ลบข้อมูลลูกค้าแล้ว]',
        phone: '',
        lineId: '-',
        address: '[ลบข้อมูลออกจากระบบแล้ว]',
        note: `เหตุผลที่แอดมินลบ: ${reason || '-'}`
      },
      items: [],
      buySubtotal: 0,
      rentSubtotal: 0,
      depositSubtotal: 0,
      shippingFee: 0,
      grandTotal: 0,
      status: 'ลบคำสั่งซื้อแล้ว',
      statusLabel: `🗑️ ลบแล้ว (${reason || '-'})`,
      slipNote: '-'
    }
  });
}
function getValidSheetWebhookUrl() {
  const raw = (state.settings.sheetWebhookUrl || '').trim();
  if (raw && raw.includes('script.google.com/macros/s/')) {
    return raw;
  }
  return DEFAULT_SETTINGS.sheetWebhookUrl;
}

function buildSheetOrderPayload(order) {
  return {
    id: order.id || '',
    createdAt: order.createdAt || '',
    createdAtFormatted: order.createdAtFormatted || order.createdAt || new Date().toLocaleString('th-TH'),
    orderTypeLabel: order.orderTypeLabel || 'ซื้อ/เช่าสินค้า',
    customer: {
      name: order.customer?.name || '',
      phone: order.customer?.phone || '',
      lineId: order.customer?.lineId || '-',
      address: order.customer?.address || '',
      note: order.customer?.note || '-'
    },
    // Strip large base64 product images from items so the webhook payload stays tiny (< 1KB)
    items: (order.items || []).map((item) => ({
      productId: item.productId || '',
      name: item.name || '',
      platform: item.platform || '',
      mode: item.mode || 'buy',
      qty: Number(item.qty || 1),
      price: Number(item.price || 0),
      shippingFee: Number(item.shippingFee ?? 0),
      rentDays: Number(item.rentDays || 0),
      rentRate: Number(item.rentRate || 0),
      deposit: Number(item.deposit || 0),
      rentStartDate: item.rentStartDate || '',
      rentEndDate: item.rentEndDate || ''
    })),
    buySubtotal: Number(order.buySubtotal || 0),
    rentSubtotal: Number(order.rentSubtotal || 0),
    depositSubtotal: Number(order.depositSubtotal || 0),
    shippingFee: Number(order.shippingFee || 0),
    grandTotal: Number(order.grandTotal || 0),
    status: order.status || 'รอตรวจสอบสลิป',
    statusLabel: order.statusLabel || order.status || 'รอตรวจสอบสลิป',
    slipNote: order.slipNote || (order.slipDataUrl ? 'แนบสลิปโอนเงินแล้ว (เปิดดูรูปได้ในหน้า Admin)' : 'ไม่มีรูปสลิป')
  };
}

async function postPayloadToGoogleSheet(webhookUrl, payloadObj) {
  const bodyStr = JSON.stringify(payloadObj);

  // 1. Try standard CORS POST first so we can inspect the JSON response from Apps Script
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: bodyStr,
      redirect: 'follow'
    });
    if (res.ok) {
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        if (json && json.status === 'error') {
          console.error('Google Apps Script returned error:', json.message);
          if (state.isAdmin) {
            showToast('⚠️ Google Sheets แจ้งว่า: ' + json.message, 'warning');
          }
          return false;
        }
        return true;
      } catch (parseErr) {
        // If response is HTML (e.g. login page when "Who has access" is not set to "Anyone")
        if (text.includes('accounts.google.com') || text.includes('ServiceLogin')) {
          if (state.isAdmin) {
            showToast('⚠️ กรุณาตั้งค่า Apps Script > Deploy > Who has access เป็น "Anyone (ทุกคน)"', 'warning');
          }
          return false;
        }
        return true;
      }
    }
  } catch (corsErr) {
    // 2. Fallback for strict mobile in-app browsers: fire no-cors POST + GET query param fallback
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: bodyStr
      });
      if (bodyStr.length < 1800) {
        const sep = webhookUrl.includes('?') ? '&' : '?';
        fetch(`${webhookUrl}${sep}payload=${encodeURIComponent(bodyStr)}`, {
          method: 'GET',
          mode: 'no-cors'
        }).catch(() => {});
      }
      return true;
    } catch (fallbackErr) {
      console.error('Google Sheets Webhook error:', fallbackErr);
      return false;
    }
  }
  return false;
}

async function sendOrderToGoogleSheet(order, action = 'create_order') {
  const webhookUrl = getValidSheetWebhookUrl();
  if (!webhookUrl) return false;

  const cleanOrder = buildSheetOrderPayload(order);
  return postPayloadToGoogleSheet(webhookUrl, {
    action,
    order: cleanOrder
  });
}

async function autoSyncOrdersToGoogleSheetSilent() {
  const webhookUrl = getValidSheetWebhookUrl();
  const activeOrders = state.orders.filter((o) => !o.isDeletedByAdmin && !o.permanentlyErased);
  if (!webhookUrl || !activeOrders.length) return;
  const cleanOrders = activeOrders.map(buildSheetOrderPayload);
  await postPayloadToGoogleSheet(webhookUrl, {
    action: 'sync_all_orders',
    orders: cleanOrders
  });
}

async function syncAllOrdersToGoogleSheet() {
  const webhookUrl = getValidSheetWebhookUrl();
  if (!webhookUrl) {
    showToast('⚠️ กรุณาใส่ Google Apps Script Web App URL ในแท็บตั้งค่าก่อนครับ', 'warning');
    switchAdminTab('settings');
    return;
  }

  const activeOrders = state.orders.filter((o) => !o.isDeletedByAdmin && !o.permanentlyErased);
  const cleanOrders = activeOrders.map(buildSheetOrderPayload);
  const ok = await postPayloadToGoogleSheet(webhookUrl, {
    action: 'sync_all_orders',
    orders: cleanOrders
  });
  if (ok) {
    showToast(`📊 ส่งข้อมูลคำสั่งซื้อที่ใช้งานอยู่ (${cleanOrders.length} รายการ) เข้า Google Sheets เรียบร้อยแล้ว!`);
  }
}

function exportOrdersToCsvSheet() {
  const activeOrders = state.orders.filter((o) => !o.isDeletedByAdmin && !o.permanentlyErased);
  if (!activeOrders.length) {
    showToast('ยังไม่มีรายการคำสั่งซื้อสำหรับดาวน์โหลด', 'warning');
    return;
  }

  const headers = [
    'รหัสคำสั่งซื้อ (Order ID)',
    'วัน-เวลาที่สั่ง',
    'ชื่อลูกค้า',
    'เบอร์โทรศัพท์',
    'Line ID / ช่องทางติดต่อ',
    'ที่อยู่จัดส่ง',
    'รูปแบบคำสั่งซื้อ',
    'รายการสินค้าและการเช่าแผ่น',
    'ยอดซื้อสินค้า (บาท)',
    'ค่าเช่าแผ่นรวม (บาท)',
    'ค่ามัดจำแผ่นรวม (บาท)',
    'ค่าจัดส่ง (บาท)',
    'ยอดชำระสุทธิ (บาท)',
    'สถานะคำสั่งซื้อ',
    'หมายเหตุ'
  ];

  const escapeCsvCell = (val) => {
    const str = String(val ?? '').replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = activeOrders.map((o) => {
    const itemSummary = (o.items || []).map((item, i) => {
      if (item.mode === 'rent') {
        return `${i + 1}. [เช่าแผ่น] ${item.name} (${item.platform}) x${item.qty} | เช่า ${item.rentDays} วัน (${item.rentRate}บ./วัน = ${item.rentRate * item.rentDays * item.qty}บ.) + มัดจำ ${item.deposit * item.qty}บ. (เริ่ม ${item.rentStartDate} คืน ${item.rentEndDate})`;
      }
      return `${i + 1}. [ซื้อขาด] ${item.name} (${item.platform}) x${item.qty} = ${item.price * item.qty}บ.`;
    }).join(' ; ');

    return [
      o.id,
      o.createdAtFormatted || o.createdAt,
      o.customer?.name || '',
      `="${o.customer?.phone || ''}"`,
      o.customer?.lineId || '-',
      o.customer?.address || '',
      o.orderTypeLabel || '',
      itemSummary,
      o.buySubtotal || 0,
      o.rentSubtotal || 0,
      o.depositSubtotal || 0,
      o.shippingFee || 0,
      o.grandTotal || 0,
      o.status || 'รอตรวจสอบสลิป',
      o.customer?.note || '-'
    ].map(escapeCsvCell).join(',');
  });

  // Prepend UTF-8 BOM (\uFEFF) so Excel & Sheet programs open Thai text without mojibake
  const csvContent = '\uFEFF' + [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `TakeIT_Orders_${dateStr}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast('📊 ดาวน์โหลดไฟล์ตารางคำสั่งซื้อ (.CSV สำหรับเปิดใน Excel / Google Sheets) เรียบร้อยแล้ว!');
}

// Privacy & Masking Helpers (PDPA Compliance for Public Order Lookup)
function maskCustomerName(name) {
  if (!name || !String(name).trim()) return '***';
  const parts = String(name).trim().split(/\s+/);
  return parts.map((part) => {
    if (part.length <= 2) return part[0] + '*';
    if (part.length <= 4) return part[0] + '**' + part.slice(-1);
    return part.slice(0, 2) + '***' + part.slice(-1);
  }).join(' ');
}

function maskPhone(phone) {
  if (!phone) return '***';
  const clean = String(phone).replace(/\D/g, '');
  if (clean.length === 10) {
    return clean.slice(0, 3) + '-xxx-x' + clean.slice(-3);
  }
  if (clean.length >= 7) {
    return clean.slice(0, 3) + '-***-' + clean.slice(-2);
  }
  return clean.slice(0, 2) + '***';
}

// ============================================================================
// Formatting & Image Helpers
// ============================================================================
function formatTHB(num) {
  return '฿' + Number(num || 0).toLocaleString('th-TH');
}

function getCategoryLabel(cat) {
  if (cat === 'console') return '🕹️ เครื่องเกมคอนโซล';
  if (cat === 'disc') return '💿 แผ่นเกมคอนโซล';
  return '🎧 อุปกรณ์เกมมิ่ง & สินค้า IT';
}

function addDaysToDateStr(dateStr, days) {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setDate(d.getDate() + Number(days || 1));
  return d.toISOString().slice(0, 10);
}

function formatThaiDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

async function isHeicFile(file) {
  if (!file) return false;
  const name = String(file.name || '').toLowerCase();
  const type = String(file.type || '').toLowerCase();
  if (name.endsWith('.heic') || name.endsWith('.heif') || type.includes('heic') || type.includes('heif')) {
    return true;
  }
  // Check magic bytes / ftyp box in first 24 bytes in case MIME type or extension was omitted
  try {
    const slice = file.slice(0, 24);
    const buf = await slice.arrayBuffer();
    const str = String.fromCharCode(...new Uint8Array(buf));
    return str.includes('ftyp') && (
      str.includes('heic') ||
      str.includes('heix') ||
      str.includes('heim') ||
      str.includes('heis') ||
      str.includes('mif1') ||
      str.includes('msf1')
    );
  } catch (e) {
    return false;
  }
}

async function convertHeicToJpegBlob(file) {
  // 1. Try browser native decoding first (e.g. Safari on iOS / macOS can decode HEIC natively)
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file);
      bmp.close();
      return file;
    } catch (_) {}
  }

  // 2. Load heic2any on-demand if not loaded yet
  if (typeof window.heic2any !== 'function') {
    await new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src*="heic2any"]');
      if (existing) {
        if (typeof window.heic2any === 'function') return resolve();
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('โหลดตัวแปลง HEIC ไม่สำเร็จ')));
        return;
      }
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        const fb = document.createElement('script');
        fb.src = 'https://cdnjs.cloudflare.com/ajax/libs/heic2any/0.0.4/heic2any.min.js';
        fb.async = true;
        fb.onload = () => resolve();
        fb.onerror = () => reject(new Error('ไม่สามารถโหลดระบบอ่านไฟล์รูป HEIC ได้'));
        document.head.appendChild(fb);
      };
      document.head.appendChild(s);
    });
  }

  if (typeof window.heic2any === 'function') {
    const converted = await window.heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.86
    });
    return Array.isArray(converted) ? converted[0] : converted;
  }
  return file;
}

async function compressImageFileToDataUrl(file, maxWidth = 600, quality = 0.72) {
  let blobToProcess = file;
  const isHeic = await isHeicFile(file);

  if (isHeic) {
    showToast(`🔄 กำลังแปลงไฟล์ ${file.name || 'HEIC'} จาก iPhone เป็นภาพที่แสดงผลได้...`, 'info');
    try {
      blobToProcess = await convertHeicToJpegBlob(file);
    } catch (err) {
      console.error('HEIC conversion failed:', err);
      throw new Error(`ไม่สามารถแปลงไฟล์ HEIC ได้ (${err.message || 'เบราว์เซอร์ไม่รองรับ'})`);
    }
  }

  return new Promise((resolve, reject) => {
    const processImageElement = (img, cleanupUrl) => {
      try {
        const w = img.naturalWidth || img.width || 600;
        const h = img.naturalHeight || img.height || 400;
        let scale = Math.min(1, maxWidth / w);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0b1120';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        let dataUrl = canvas.toDataURL('image/jpeg', quality);

        // Adaptive size guard so multiple uploaded images always fit in Firestore (<1MB) and localStorage
        if (dataUrl.length > 135000) {
          scale = Math.min(1, 440 / w);
          canvas.width = Math.max(1, Math.round(w * scale));
          canvas.height = Math.max(1, Math.round(h * scale));
          ctx.fillStyle = '#0b1120';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        }
        if (cleanupUrl) URL.revokeObjectURL(cleanupUrl);
        resolve(dataUrl);
      } catch (err) {
        if (cleanupUrl) URL.revokeObjectURL(cleanupUrl);
        reject(err);
      }
    };

    const objectUrl = URL.createObjectURL(blobToProcess);
    const img = new Image();
    img.onload = () => processImageElement(img, objectUrl);
    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`เบราว์เซอร์ไม่สามารถเปิดรูป "${file.name || 'ภาพนี้'}" ได้`));
    };
    img.src = objectUrl;
  });
}

// ============================================================================
// Customer Google Authentication (Gmail Sign-in)
// ============================================================================
function renderCustomerAuthUI() {
  const wrap = document.getElementById('customer-auth-wrap');
  const roleBadge = document.getElementById('user-role-badge');
  if (!wrap) return;

  if (state.currentUser) {
    if (roleBadge) {
      roleBadge.className = 'guest-badge';
      roleBadge.style.background = 'rgba(56, 189, 248, 0.15)';
      roleBadge.style.borderColor = 'rgba(56, 189, 248, 0.4)';
      roleBadge.style.color = '#38bdf8';
      roleBadge.innerHTML = `👤 ${escapeXml(state.currentUser.displayName)}`;
      roleBadge.title = `เข้าสู่ระบบด้วย Gmail: ${state.currentUser.email}`;
    }

    wrap.innerHTML = `
      <div class="customer-profile-pill">
        ${state.currentUser.photoURL ? `<img src="${state.currentUser.photoURL}" alt="${escapeXml(state.currentUser.displayName)}" class="cust-avatar">` : '<span>👤</span>'}
        <span class="cust-name">${escapeXml(state.currentUser.displayName)}</span>
        <button type="button" class="btn-cust-logout" id="btn-customer-logout" title="ออกจากระบบ Google (Gmail)" aria-label="ออกจากระบบ Google">✕</button>
      </div>
    `;

    document.getElementById('btn-customer-logout')?.addEventListener('click', logoutCustomer);
  } else {
    if (roleBadge) {
      roleBadge.className = 'guest-badge';
      roleBadge.style.background = 'rgba(16, 185, 129, 0.12)';
      roleBadge.style.borderColor = 'rgba(16, 185, 129, 0.35)';
      roleBadge.style.color = '#34d399';
      roleBadge.textContent = '👤 โหมดลูกค้า: ทั่วไป (สั่งซื้อได้ทันที)';
      roleBadge.title = 'ลูกค้าทั่วไป (Guest)';
    }

    wrap.innerHTML = `
      <button type="button" class="btn btn-outline btn-sm btn-google-auth" id="btn-customer-login" title="เข้าสู่ระบบด้วย Gmail เพื่อดูประวัติคำสั่งซื้อส่วนตัว">
        <svg width="15" height="15" viewBox="0 0 24 24" style="vertical-align:middle; margin-inline-end:3px;"><path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.3l3.7 2.9C6.2 7.4 8.9 5 12 5z"/><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/><path fill="#FBBC05" d="M5.3 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.2-1.6.4-2.3L1.6 7.3C.6 9.3 0 10.6 0 12s.6 2.7 1.6 4.7l3.7-1.9z"/><path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.4-6.7-5.2L1.6 16c1.9 3.7 5.8 7 10.4 7z"/></svg>
        เข้าสู่ระบบด้วย Gmail
      </button>
    `;

    document.getElementById('btn-customer-login')?.addEventListener('click', loginWithGoogle);
  }
}

async function loginWithGoogle() {
  if (!state.auth || !state.authModules) {
    await initCloudConnection();
  }
  if (!state.auth || !state.authModules) {
    showToast('⚠️ ระบบล็อกอินกำลังเชื่อมต่อ กรุณารอสักครู่แล้วลองใหม่อีกครั้งครับ', 'warning');
    return;
  }
  try {
    const { signInWithPopup, GoogleAuthProvider } = state.authModules;
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(state.auth, provider);
    const u = result.user;
    showToast(`🎉 ยินดีต้อนรับคุณ ${u.displayName || 'ลูกค้า'} เข้าสู่ร้าน TakeIT!`);

    // Auto-fill checkout fields if open
    const custName = document.getElementById('cust-name');
    if (custName && !custName.value.trim()) custName.value = u.displayName || '';
  } catch (err) {
    console.error('Google Sign-In error:', err);
    if (err.code === 'auth/unauthorized-domain') {
      showToast('⚠️ โดเมนยังไม่ได้รับอนุญาตใน Firebase Console กรุณาเพิ่ม vidergroup124.github.io ในเมนู Authentication > Settings > Authorized domains ครับ', 'error');
    } else if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
      showToast('⚠️ เข้าสู่ระบบไม่สำเร็จ: ' + (err.message || err.code), 'error');
    }
  }
}

async function logoutCustomer() {
  if (state.auth && state.authModules) {
    try {
      await state.authModules.signOut(state.auth);
      showToast('ออกจากระบบ Google เรียบร้อยแล้ว');
    } catch (err) {
      console.error('Logout error:', err);
    }
  }
}

// ============================================================================
// UI Rendering: Storefront, Cart, and Admin Tables
// ============================================================================
function renderAll() {
  renderStorefront();
  renderCartBadge();
  if (document.getElementById('dialog-cart')?.open) {
    renderCartModalContents();
  }
  renderAdminVisibility();
  renderCustomerAuthUI();
  updateSupportBadgeCount();
  updateEsp32BadgeCount();
  if (state.isAdmin) {
    renderAdminStats();
    renderAdminOrdersTable();
    renderAdminProductsTable();
    renderAdminSupportTicketsTable();
    renderAdminEsp32Sessions();
    populateSettingsForm();
  }
}

function renderStorefront() {
  const grid = document.getElementById('product-grid');
  if (!grid) return;

  const q = state.searchQuery.trim().toLowerCase();
  const filtered = state.products.filter((p) => {
    if (state.activeCategory === 'home_console') {
      if (!p.canHomeInstall) return false;
    } else if (state.activeCategory !== 'all' && p.category !== state.activeCategory) {
      return false;
    }
    if (state.activePlatform !== 'all' && p.platform !== state.activePlatform) return false;
    if (state.activeMode === 'home_install_available' && !p.canHomeInstall) return false;
    if (state.activeMode === 'rent_available' && !p.canRent) return false;
    if (state.activeMode === 'ready' && p.status !== 'ready') return false;
    if (state.activeMode === 'coming_soon' && p.status !== 'coming_soon') return false;
    if (q) {
      const hay = `${p.name} ${p.description} ${p.platform} ${p.category} ${p.esp32DeviceId || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    const rawSearch = state.searchQuery.trim();
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align:center; padding:3rem 1.5rem; background:var(--bg-surface); border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
        <div style="font-size:2.8rem; margin-block-end:0.5rem;">🎮</div>
        <h3 style="margin:0 0 0.4rem; color:var(--text-primary);">ไม่พบสินค้าที่ตรงกับการค้นหา ${rawSearch ? `"${escapeXml(rawSearch)}"` : ''}</h3>
        <p style="color:var(--text-muted); margin:0 0 1.25rem; font-size:0.92rem; max-inline-size:520px; margin-inline:auto;">
          ร้าน TakeIT ยังไม่มีสินค้าหรือแผ่นเกมที่คุณกำลังตามหาอยู่ใช่ไหม? กดส่งชื่อสินค้าที่คุณอยากได้ด้านล่าง ทางร้านจะจัดหาและติดต่อกลับทันที!
        </p>
        <button type="button" class="btn btn-primary" id="btn-empty-request-product" style="font-size:0.92rem; padding:0.6rem 1.25rem;">
          💡 ส่งคำขอให้ร้าน TakeIT จัดหาให้ (ระบุช่องทางติดต่อกลับ)
        </button>
      </div>
    `;
    document.getElementById('btn-empty-request-product')?.addEventListener('click', () => {
      openSupportModal('wishlist', rawSearch);
    });
    return;
  }

  grid.innerHTML = filtered.map((p) => {
    const isReady = p.status === 'ready' && Number(p.stock) > 0;
    const isComingSoon = p.status === 'coming_soon';
    const images = getProductImages(p);

    let statusBadgeHtml = '';
    if (isComingSoon) {
      statusBadgeHtml = `<span class="badge badge-amber">⏳ เร็วๆ นี้ (Coming Soon)</span>`;
    } else if (!isReady) {
      statusBadgeHtml = `<span class="badge" style="background:rgba(244,63,94,0.2); color:#fda4af;">สินค้าหมดชั่วคราว</span>`;
    } else if (p.canHomeInstall) {
      statusBadgeHtml = `<span class="badge badge-emerald">🏠 เช่าติดบ้าน ${formatTHB(p.hourlyRate)}/ชม.</span>`;
    } else if (p.canRent) {
      statusBadgeHtml = `<span class="badge badge-purple">💿 ซื้อ / เช่ารายวันได้</span>`;
    } else {
      statusBadgeHtml = `<span class="badge badge-emerald">✅ พร้อมส่ง (${p.stock})</span>`;
    }

    const slidesHtml = images.map((imgSrc, idx) => `
      <div class="card-carousel-slide" data-slide-index="${idx}" data-open-gallery="${p.id}">
        <img src="${imgSrc}" alt="${escapeXml(p.name)} - รูปที่ ${idx + 1}" loading="lazy">
      </div>
    `).join('');

    const navControlsHtml = images.length > 1
      ? `
        <button type="button" class="carousel-nav-btn carousel-nav-prev" data-card-prev="${p.id}" aria-label="ดูรูปก่อนหน้าของ ${escapeXml(p.name)}">‹</button>
        <button type="button" class="carousel-nav-btn carousel-nav-next" data-card-next="${p.id}" aria-label="ดูรูปถัดไปของ ${escapeXml(p.name)}">›</button>
        <div class="carousel-dots" role="group" aria-label="ตัวบอกตำแหน่งรูปภาพ">
          ${images.map((_, idx) => `<button type="button" class="carousel-dot" data-card-dot="${p.id}" data-dot-idx="${idx}" aria-label="รูปที่ ${idx + 1}" ${idx === 0 ? 'aria-current="true"' : ''}></button>`).join('')}
        </div>
        <button type="button" class="photo-count-pill" data-open-gallery="${p.id}" data-slide-index="0" title="คลิกเพื่อขยายดูรูปทั้งหมด">
          🖼️ ${images.length} รูป
        </button>
      `
      : `
        <button type="button" class="photo-count-pill" data-open-gallery="${p.id}" data-slide-index="0" title="คลิกเพื่อดูรูปขนาดใหญ่">
          🔍 ดูรูปใหญ่
        </button>
      `;

    const rentSectionHtml = p.canRent
      ? `
        <div class="rent-box">
          <div>
            <span style="font-size:0.75rem; color:#d8b4fe; display:block;">บริการเช่าแผ่นรายวัน:</span>
            <span class="rent-rate">${formatTHB(p.rentPricePerDay)} / วัน</span>
          </div>
          <div style="text-align:end;">
            <span class="rent-deposit">ค่ามัดจำแผ่น ${formatTHB(p.rentDeposit)}</span>
            <span style="font-size:0.7rem; color:#a7f3d0; display:block;">(ได้มัดจำคืน 100% + ร้านออกค่าส่งกลับให้!)</span>
          </div>
        </div>
      `
      : '';

    const homeInstallSectionHtml = p.canHomeInstall
      ? `
        <div class="home-install-box">
          <div>
            <span style="font-size:0.74rem; color:#a7f3d0; display:block;">🏠 เช่าเครื่องไปติดตั้งที่บ้าน (ESP32 Real-time):</span>
            <span class="home-install-rate">⚡ ${formatTHB(p.hourlyRate)} / ชั่วโมง <span style="font-size:0.73rem; font-weight:500;">(คิดตามจริง Postpaid)</span></span>
          </div>
          <div style="text-align:end;">
            <span class="home-install-fee">ค่าติดตั้งที่บ้าน <strong>${formatTHB(p.installFee)}</strong></span>
            <span style="font-size:0.7rem; color:#38bdf8; display:block; cursor:pointer; text-decoration:underline;" data-open-esp32-meter="${escapeXml(p.esp32DeviceId || '')}">📡 กดเช็คชั่วโมงเครื่อง Real-time</span>
          </div>
        </div>
      `
      : '';

    let actionButtonsHtml = '';
    if (isComingSoon) {
      actionButtonsHtml = `
        <button type="button" class="btn btn-outline" disabled style="opacity:0.75; cursor:not-allowed;">
          ⏳ เตรียมเปิดจำหน่ายเร็วๆ นี้
        </button>
      `;
    } else if (!isReady) {
      actionButtonsHtml = `
        <button type="button" class="btn btn-outline" disabled style="opacity:0.6; cursor:not-allowed;">
          ❌ สินค้าหมดสต็อกชั่วคราว
        </button>
      `;
    } else {
      const buyBtn = Number(p.price) > 0
        ? `<button type="button" class="btn btn-primary" data-buy-id="${p.id}">🛒 ซื้อขาด ${formatTHB(p.price)}</button>`
        : '';
      const rentBtn = p.canRent
        ? `<button type="button" class="btn btn-rent" data-rent-id="${p.id}">💿 เช่าแผ่นรายวัน</button>`
        : '';
      const homeInstallBtn = p.canHomeInstall
        ? `<button type="button" class="btn btn-emerald" data-home-install-id="${p.id}">🏠 เช่าติดบ้าน ${formatTHB(p.hourlyRate)}/ชม.</button>`
        : '';
      actionButtonsHtml = buyBtn + rentBtn + homeInstallBtn;
    }

    return `
      <article class="product-card" data-card-prod-id="${p.id}">
        <div class="product-thumb-wrap">
          <div class="card-carousel-track" data-carousel-track="${p.id}">
            ${slidesHtml}
          </div>
          <div class="card-badges-top">
            <span class="platform-pill platform-${escapeXml(p.platform)}">${escapeXml(p.platform)}</span>
            ${statusBadgeHtml}
          </div>
          ${navControlsHtml}
        </div>

        <div class="product-body">
          <div class="product-cat-label">${getCategoryLabel(p.category)}</div>
          <h3 class="product-title">${escapeXml(p.name)}</h3>
          <p class="product-desc">${escapeXml(p.description || '')}</p>

          <div class="pricing-stack">
            <div class="price-row">
              <span style="font-size:0.82rem; color:var(--text-muted);">ราคาซื้อขาด:</span>
              <span class="price-buy">${Number(p.price) > 0 ? formatTHB(p.price) : 'เช่าอย่างเดียว'}</span>
            </div>
            <div class="price-row" style="margin-block-start:0.2rem; font-size:0.78rem;">
              <span style="color:var(--text-muted);">🚚 ค่าจัดส่งสินค้าชิ้นนี้ (กรณีซื้อ/เช่าแผ่น):</span>
              <strong style="color:${getProductShippingFee(p) === 0 ? '#34d399' : '#38bdf8'};">${getProductShippingFee(p) === 0 ? 'ส่งฟรี! (฿0)' : `${formatTHB(getProductShippingFee(p))} / ชิ้น`}</strong>
            </div>
            ${homeInstallSectionHtml}
            ${rentSectionHtml}
          </div>

          <div class="card-actions">
            ${actionButtonsHtml}
          </div>
        </div>
      </article>
    `;
  }).join('');

  // Attach Card Carousel Prev / Next / Dots & Scroll-Snap State Sync
  initCardCarousels(grid);

  // Open Full Gallery Modal on slide/badge click
  grid.querySelectorAll('[data-open-gallery]').forEach((el) => {
    el.addEventListener('click', () => {
      const prodId = el.getAttribute('data-open-gallery');
      const idx = Number(el.getAttribute('data-slide-index') || 0);
      openProductGalleryModal(prodId, idx);
    });
  });

  // Attach Buy, Rent & Home Console Installation click handlers
  grid.querySelectorAll('[data-buy-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prodId = btn.getAttribute('data-buy-id');
      addToCartBuy(prodId);
    });
  });

  grid.querySelectorAll('[data-rent-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prodId = btn.getAttribute('data-rent-id');
      openRentalCalculatorModal(prodId);
    });
  });

  grid.querySelectorAll('[data-home-install-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prodId = btn.getAttribute('data-home-install-id');
      addToCartHomeInstall(prodId);
    });
  });

  grid.querySelectorAll('[data-open-esp32-meter]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const devId = el.getAttribute('data-open-esp32-meter') || '';
      openHomeConsoleModal('meter', devId);
    });
  });
}

// Synchronize scroll-snap carousel state using scrollsnapchange + IntersectionObserver fallback
function bindHorizontalSnapSync(trackEl, onActiveIndexChange) {
  if (!trackEl) return;
  const slides = Array.from(trackEl.children);
  if (slides.length <= 1) return;

  if ('onscrollsnapchange' in HTMLElement.prototype) {
    trackEl.addEventListener('scrollsnapchange', (event) => {
      const snappedSlide = event.snapTargetInline;
      if (snappedSlide) {
        const idx = slides.indexOf(snappedSlide);
        if (idx > -1) onActiveIndexChange(idx);
      }
    });
  } else if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const idx = slides.indexOf(entry.target);
            if (idx > -1) onActiveIndexChange(idx);
          }
        });
      },
      { root: trackEl, threshold: 0.65 }
    );
    slides.forEach((slide) => observer.observe(slide));
  }
}

function initCardCarousels(grid) {
  grid.querySelectorAll('[data-carousel-track]').forEach((track) => {
    const prodId = track.getAttribute('data-carousel-track');
    const card = track.closest('.product-card');
    const dots = Array.from(card.querySelectorAll(`[data-card-dot="${prodId}"]`));
    const slides = Array.from(track.children);
    if (slides.length <= 1) return;

    let currentIdx = 0;
    const setActiveDot = (idx) => {
      currentIdx = idx;
      dots.forEach((d, i) => {
        if (i === idx) d.setAttribute('aria-current', 'true');
        else d.removeAttribute('aria-current');
      });
    };

    bindHorizontalSnapSync(track, setActiveDot);

    const scrollToSlide = (idx) => {
      const targetIdx = (idx + slides.length) % slides.length;
      track.scrollTo({ left: targetIdx * track.clientWidth, behavior: 'smooth' });
      setActiveDot(targetIdx);
    };

    card.querySelector(`[data-card-prev="${prodId}"]`)?.addEventListener('click', (e) => {
      e.stopPropagation();
      scrollToSlide(currentIdx - 1);
    });

    card.querySelector(`[data-card-next="${prodId}"]`)?.addEventListener('click', (e) => {
      e.stopPropagation();
      scrollToSlide(currentIdx + 1);
    });

    dots.forEach((dot, i) => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        scrollToSlide(i);
      });
    });
  });
}

// Full-screen Multi-Image Gallery Modal
function openProductGalleryModal(productId, startIndex = 0) {
  const product = state.products.find((p) => p.id === productId);
  if (!product) return;

  const images = getProductImages(product);
  const dialog = document.getElementById('dialog-product-gallery');
  const titleEl = document.getElementById('gallery-dialog-title');
  const mainTrack = document.getElementById('gallery-main-track');
  const thumbsNav = document.getElementById('gallery-thumbs-nav');
  const detailsEl = document.getElementById('gallery-product-details');

  titleEl.textContent = `🖼️ ${product.name} (${images.length} รูปภาพ)`;

  mainTrack.innerHTML = images.map((src, idx) => `
    <div class="gallery-main-slide" data-gallery-slide="${idx}">
      <img src="${src}" alt="${escapeXml(product.name)} รูปที่ ${idx + 1}">
    </div>
  `).join('');

  thumbsNav.innerHTML = images.map((src, idx) => `
    <button type="button" class="gallery-thumb-btn" data-gallery-thumb="${idx}" aria-label="ดูรูปที่ ${idx + 1}" ${idx === startIndex ? 'aria-current="true"' : ''}>
      <img src="${src}" alt="รูปย่อที่ ${idx + 1}">
    </button>
  `).join('');

  const isReady = product.status === 'ready' && Number(product.stock) > 0;
  const buyBtnHtml = isReady && Number(product.price) > 0
    ? `<button type="button" class="btn btn-primary" id="gallery-buy-btn">🛒 ซื้อขาด ${formatTHB(product.price)}</button>`
    : '';
  const rentBtnHtml = isReady && product.canRent
    ? `<button type="button" class="btn btn-rent" id="gallery-rent-btn">💿 เช่าแผ่นรายวัน (${formatTHB(product.rentPricePerDay)}/วัน + มัดจำ ${formatTHB(product.rentDeposit)})</button>`
    : '';

  detailsEl.innerHTML = `
    <div class="highlight-box" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
      <div style="flex:1; min-inline-size:240px;">
        <span class="platform-pill platform-${escapeXml(product.platform)}">${escapeXml(product.platform)}</span>
        <strong style="margin-inline-start:0.5rem; font-size:1.05rem;">${escapeXml(product.name)}</strong>
        <span class="badge" style="margin-inline-start:0.4rem; background:rgba(56,189,248,0.16); color:#38bdf8;">
          🚚 ค่าส่ง: ${getProductShippingFee(product) === 0 ? 'ส่งฟรี!' : `${formatTHB(getProductShippingFee(product))}/ชิ้น`}
        </span>
        <p style="margin:0.4rem 0 0; font-size:0.88rem; color:var(--text-secondary);">${escapeXml(product.description || '')}</p>
      </div>
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
        ${buyBtnHtml}
        ${rentBtnHtml}
      </div>
    </div>
  `;

  detailsEl.querySelector('#gallery-buy-btn')?.addEventListener('click', () => {
    addToCartBuy(product.id);
    dialog.close();
  });

  detailsEl.querySelector('#gallery-rent-btn')?.addEventListener('click', () => {
    dialog.close();
    openRentalCalculatorModal(product.id);
  });

  let activeIdx = startIndex;
  const thumbBtns = Array.from(thumbsNav.querySelectorAll('.gallery-thumb-btn'));
  const setActiveThumb = (idx) => {
    activeIdx = idx;
    thumbBtns.forEach((btn, i) => {
      if (i === idx) btn.setAttribute('aria-current', 'true');
      else btn.removeAttribute('aria-current');
    });
  };

  bindHorizontalSnapSync(mainTrack, setActiveThumb);

  const goToGallerySlide = (idx, smooth = true) => {
    const targetIdx = (idx + images.length) % images.length;
    mainTrack.scrollTo({
      left: targetIdx * mainTrack.clientWidth,
      behavior: smooth ? 'smooth' : 'instant'
    });
    setActiveThumb(targetIdx);
  };

  const prevBtn = document.getElementById('gallery-prev-btn');
  const nextBtn = document.getElementById('gallery-next-btn');
  prevBtn.hidden = images.length <= 1;
  nextBtn.hidden = images.length <= 1;

  prevBtn.onclick = () => goToGallerySlide(activeIdx - 1);
  nextBtn.onclick = () => goToGallerySlide(activeIdx + 1);

  thumbBtns.forEach((btn, i) => {
    btn.addEventListener('click', () => goToGallerySlide(i));
  });

  dialog.showModal();
  requestAnimationFrame(() => {
    goToGallerySlide(startIndex, false);
  });
}

// ============================================================================
// Daily Game Disc Rental Calculator Modal
// ============================================================================
function openRentalCalculatorModal(productId) {
  const product = state.products.find((p) => p.id === productId);
  if (!product || !product.canRent) return;

  const dialog = document.getElementById('dialog-rental-calc');
  document.getElementById('rent-modal-product-id').value = product.id;

  const summaryEl = document.getElementById('rent-modal-product-summary');
  summaryEl.innerHTML = `
    <img src="${product.image}" alt="${escapeXml(product.name)}" style="inline-size:84px; block-size:64px; object-fit:cover; border-radius:8px;">
    <div>
      <span class="badge badge-purple">${escapeXml(product.platform)} • บริการเช่าแผ่นเกมรายวัน</span>
      <h3 style="margin:0.25rem 0 0; font-size:1.05rem;">${escapeXml(product.name)}</h3>
      <div style="font-size:0.84rem; color:var(--text-secondary);">
        ค่าเช่า <strong>${formatTHB(product.rentPricePerDay)}/วัน</strong> • ค่ามัดจำแผ่น <strong>${formatTHB(product.rentDeposit)}</strong> (ได้มัดจำคืน + <strong style="color:#34d399;">ทางร้านจ่ายค่าส่งของกลับให้!</strong>)
      </div>
    </div>
  `;

  const daysInput = document.getElementById('rent-days-input');
  const startDateInput = document.getElementById('rent-start-date');
  const qtyInput = document.getElementById('rent-qty-input');

  const maxStock = getProductAvailableStock(product);
  const inCartQty = getProductQtyInCart(product.id);
  const remainingStock = Math.max(0, maxStock - inCartQty);

  daysInput.value = '7';
  qtyInput.value = '1';
  qtyInput.max = String(Math.max(1, remainingStock));

  const todayStr = new Date().toISOString().slice(0, 10);
  startDateInput.value = todayStr;
  startDateInput.min = todayStr;

  document.querySelectorAll('#rent-day-presets .preset-chip').forEach((chip) => {
    chip.classList.toggle('active', chip.getAttribute('data-days') === '7');
  });

  updateRentalCalculatorBreakdown();
  dialog.showModal();
}

function updateRentalCalculatorBreakdown() {
  const prodId = document.getElementById('rent-modal-product-id').value;
  const product = state.products.find((p) => p.id === prodId);
  if (!product) return;

  const days = Math.max(1, Number(document.getElementById('rent-days-input').value) || 1);
  const qty = Math.max(1, Number(document.getElementById('rent-qty-input').value) || 1);
  const startDate = document.getElementById('rent-start-date').value || new Date().toISOString().slice(0, 10);
  const returnDate = addDaysToDateStr(startDate, days);

  const rentFee = Number(product.rentPricePerDay || 0) * days * qty;
  const depositFee = Number(product.rentDeposit || 0) * qty;
  const unitShipFee = getProductShippingFee(product);
  const shipFee = unitShipFee;
  const total = rentFee + depositFee + shipFee;

  document.getElementById('calc-rate-display').textContent = `${formatTHB(product.rentPricePerDay)} / วัน`;
  document.getElementById('calc-days-display').textContent = `${days} วัน × ${qty} แผ่น`;
  document.getElementById('calc-rent-fee-display').textContent = formatTHB(rentFee);
  document.getElementById('calc-deposit-display').textContent = formatTHB(depositFee);
  const shipEl = document.getElementById('calc-shipping-display');
  if (shipEl) {
    shipEl.textContent = shipFee === 0 ? 'ส่งฟรี! (฿0)' : `${formatTHB(shipFee)} (คิดครั้งเดียว ไม่บวกเพิ่มตามจำนวนชิ้น)`;
  }
  document.getElementById('calc-return-date-display').textContent = `${formatThaiDate(returnDate)} (เริ่ม ${formatThaiDate(startDate)})`;
  document.getElementById('calc-total-display').textContent = formatTHB(total);
}

// ============================================================================
// Cart & Guest Checkout Logic
// ============================================================================
function getProductAvailableStock(product) {
  if (!product || product.status !== 'ready') return 0;
  return Math.max(0, Number(product.stock || 0));
}

function getProductQtyInCart(productId) {
  return (state.cart || []).reduce((sum, item) => (
    item.productId === productId ? sum + Math.max(1, Number(item.qty || 1)) : sum
  ), 0);
}

function addToCartBuy(productId) {
  const product = state.products.find((p) => p.id === productId);
  if (!product) return;

  const maxStock = getProductAvailableStock(product);
  const inCart = getProductQtyInCart(productId);
  if (maxStock <= 0 || inCart >= maxStock) {
    showToast(`⚠️ ไม่สามารถเพิ่ม "${product.name}" ได้อีก (สินค้าในสต็อกครบจำนวน ${maxStock} ชิ้นแล้ว — รอแอดมินเพิ่มสต็อก)`, 'warning');
    return;
  }

  const unitShippingFee = getProductShippingFee(product);
  const existing = state.cart.find((item) => item.productId === productId && item.mode === 'buy');
  if (existing) {
    existing.qty += 1;
    existing.shippingFee = unitShippingFee;
  } else {
    state.cart.push({
      cartItemId: 'CI-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      productId: product.id,
      name: product.name,
      platform: product.platform,
      image: product.image,
      mode: 'buy',
      price: Number(product.price || 0),
      shippingFee: unitShippingFee,
      qty: 1
    });
  }

  saveStateLocally();
  renderCartBadge();
  showToast(`🛒 เพิ่ม "${product.name}" (ซื้อขาด) ลงในตะกร้าแล้ว!`);
}

function addToCartRent(productId, rentDays, rentStartDate, qty) {
  const product = state.products.find((p) => p.id === productId);
  if (!product) return false;

  const addQty = Math.max(1, Number(qty || 1));
  const maxStock = getProductAvailableStock(product);
  const inCart = getProductQtyInCart(productId);
  if (maxStock <= 0 || inCart >= maxStock) {
    showToast(`⚠️ ไม่สามารถเพิ่ม "${product.name}" ได้อีก (สินค้าในสต็อกครบจำนวน ${maxStock} ชิ้นแล้ว — รอแอดมินเพิ่มสต็อก)`, 'warning');
    return false;
  }
  if (inCart + addQty > maxStock) {
    const remaining = maxStock - inCart;
    showToast(`⚠️ "${product.name}" เพิ่มได้อีกสูงสุด ${remaining} ชิ้น (สต็อกมี ${maxStock} ชิ้น / ในตะกร้ามี ${inCart} ชิ้น)`, 'warning');
    return false;
  }

  const rentEndDate = addDaysToDateStr(rentStartDate, rentDays);
  const unitShippingFee = getProductShippingFee(product);
  const existing = state.cart.find(
    (item) => item.productId === productId && item.mode === 'rent' && Number(item.rentDays) === Number(rentDays) && item.rentStartDate === rentStartDate
  );
  if (existing) {
    existing.qty = Number(existing.qty || 1) + addQty;
    existing.shippingFee = unitShippingFee;
  } else {
    state.cart.push({
      cartItemId: 'CI-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      productId: product.id,
      name: product.name,
      platform: product.platform,
      image: product.image,
      mode: 'rent',
      rentDays: Number(rentDays),
      rentRate: Number(product.rentPricePerDay || 0),
      deposit: Number(product.rentDeposit || 0),
      shippingFee: unitShippingFee,
      rentStartDate,
      rentEndDate,
      qty: addQty
    });
  }

  saveStateLocally();
  renderCartBadge();
  showToast(`💿 เพิ่มรายการเช่าแผ่น "${product.name}" (${rentDays} วัน) ลงตะกร้าแล้ว!`);
  return true;
}

function addToCartHomeInstall(productId) {
  const product = state.products.find((p) => p.id === productId);
  if (!product || !product.canHomeInstall) return;

  const maxStock = getProductAvailableStock(product);
  const inCart = getProductQtyInCart(productId);
  if (maxStock <= 0 || inCart >= maxStock) {
    showToast(`⚠️ ไม่สามารถเพิ่ม "${product.name}" ได้อีก (สินค้าในสต็อกครบจำนวน ${maxStock} ชิ้นแล้ว — รอแอดมินเพิ่มสต็อก)`, 'warning');
    return;
  }

  const installFee = Number(product.installFee ?? 400);
  const hourlyRate = Number(product.hourlyRate ?? 30);
  const esp32DeviceId = product.esp32DeviceId || `ESP32-${String(product.platform || 'CON').toUpperCase()}-01`;

  const existing = state.cart.find((item) => item.productId === productId && item.mode === 'home_install');
  if (existing) {
    existing.qty += 1;
    existing.installFee = installFee;
    existing.hourlyRate = hourlyRate;
    existing.esp32DeviceId = esp32DeviceId;
  } else {
    state.cart.push({
      cartItemId: 'CI-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      productId: product.id,
      name: product.name,
      platform: product.platform,
      image: product.image,
      mode: 'home_install',
      installFee,
      hourlyRate,
      esp32DeviceId,
      shippingFee: 0,
      qty: 1
    });
  }

  saveStateLocally();
  renderCartBadge();
  showToast(`🏠 เพิ่มรายการเช่าติดตั้งที่บ้าน "${product.name}" (ค่าติดตั้ง ${formatTHB(installFee)} | เรท ${formatTHB(hourlyRate)}/ชม.) ลงตะกร้าแล้ว!`);
  openCartModal();
}

function updateCartItemQty(cartItemId, delta) {
  const item = (state.cart || []).find((c) => c.cartItemId === cartItemId);
  if (!item) return;

  const currentQty = Math.max(1, Number(item.qty || 1));
  if (delta < 0) {
    if (currentQty <= 1) return;
    item.qty = currentQty - 1;
    saveStateLocally();
    renderCartBadge();
    renderCartModalContents();
    return;
  }

  if (delta > 0) {
    const prod = (state.products || []).find((p) => p.id === item.productId);
    const maxStock = getProductAvailableStock(prod);
    const totalInCart = getProductQtyInCart(item.productId);
    if (!prod || maxStock <= 0 || totalInCart >= maxStock) {
      showToast(
        `⚠️ เพิ่มจำนวน "${item.name}" ไม่ได้อีก (สต็อกคงเหลือ ${maxStock} ชิ้น — เว้นแต่แอดมินจะเพิ่มสต็อกภายหลัง)`,
        'warning'
      );
      renderCartModalContents();
      return;
    }

    item.qty = currentQty + 1;
    saveStateLocally();
    renderCartBadge();
    renderCartModalContents();
  }
}

function renderCartBadge() {
  const badge = document.getElementById('cart-count-badge');
  if (!badge) return;
  const count = state.cart.reduce((sum, item) => sum + Number(item.qty || 1), 0);
  badge.textContent = String(count);
}

function calculateCartTotals() {
  let buySubtotal = 0;
  let installSubtotal = 0;
  let rentSubtotal = 0;
  let depositSubtotal = 0;
  let shippingFee = 0;

  state.cart.forEach((item) => {
    const qty = Number(item.qty || 1);
    const unitShip = getCartItemShippingFeePerUnit(item);
    item.shippingFee = unitShip;
    if (item.mode === 'rent') {
      rentSubtotal += Number(item.rentRate) * Number(item.rentDays) * qty;
      depositSubtotal += Number(item.deposit) * qty;
    } else if (item.mode === 'home_install') {
      installSubtotal += Number(item.installFee || 0) * qty;
    } else {
      buySubtotal += Number(item.price) * qty;
    }
    // ยึดตามค่าส่งของชิ้นที่แพงที่สุดในตะกร้า คิดค่าส่งครั้งเดียว ไม่บวกทบตามจำนวนชิ้น
    if (unitShip > shippingFee) {
      shippingFee = unitShip;
    }
  });

  const grandTotal = buySubtotal + installSubtotal + rentSubtotal + depositSubtotal + shippingFee;

  return { buySubtotal, installSubtotal, rentSubtotal, depositSubtotal, shippingFee, grandTotal };
}

function openCartModal() {
  const dialog = document.getElementById('dialog-cart');
  renderCartModalContents();
  const nameInput = document.getElementById('cust-name');
  if (nameInput && !nameInput.value.trim() && state.currentUser?.displayName) {
    nameInput.value = state.currentUser.displayName;
  }
  dialog.showModal();
}

function renderCartModalContents() {
  const emptyState = document.getElementById('cart-empty-state');
  const filledState = document.getElementById('cart-filled-state');
  const container = document.getElementById('cart-items-container');

  if (state.cart.length === 0) {
    emptyState.hidden = false;
    filledState.hidden = true;
    return;
  }

  emptyState.hidden = true;
  filledState.hidden = false;

  container.innerHTML = state.cart.map((item) => {
    const qty = Math.max(1, Number(item.qty || 1));
    const unitShip = getCartItemShippingFeePerUnit(item);
    const shipText = unitShip === 0
      ? '<span style="color:#34d399; font-weight:700;">ส่งฟรี! (฿0)</span>'
      : `<strong style="color:#38bdf8;">${formatTHB(unitShip)}</strong> <span style="font-size:0.75rem; color:var(--text-muted);">(คิดเหมาตามชิ้นที่แพงสุดครั้งเดียว)</span>`;

    const prod = state.products.find((p) => p.id === item.productId);
    const itemImg = (prod && prod.image) || item.image || makeProductBannerSvg(item.name || 'TakeIT', item.platform || 'Console', '#1e3a8a', '#0f172a', '🎮');
    const maxStock = getProductAvailableStock(prod);
    const totalInCartForProd = getProductQtyInCart(item.productId);
    const isAtStockLimit = !prod || maxStock <= 0 || totalInCartForProd >= maxStock;

    const stockNoteHtml = !prod || maxStock <= 0
      ? `<div style="font-size:0.75rem; color:#f87171; font-weight:600; margin-block-start:0.2rem;">❌ สินค้าหมดสต็อกชั่วคราว (รอแอดมินเติมสต็อกเพิ่ม)</div>`
      : isAtStockLimit
        ? `<div style="font-size:0.75rem; color:#fbbf24; font-weight:600; margin-block-start:0.2rem;">⚠️ ครบจำนวนสต็อกที่มีแล้ว (${totalInCartForProd}/${maxStock} ชิ้น — เพิ่มอีกไม่ได้จนกว่าแอดมินจะเพิ่มสต็อก)</div>`
        : `<div style="font-size:0.75rem; color:var(--text-muted); margin-block-start:0.2rem;">📦 สต็อกคงเหลือ: ${maxStock} ชิ้น (เลือกอยู่ ${totalInCartForProd}/${maxStock} ชิ้น)</div>`;

    const buildRightCol = (totalAmount, amountColor) => `
      <div class="cart-actions-col" style="text-align:end;">
        <div style="font-weight:800; font-size:1.05rem; color:${amountColor};">
          ${formatTHB(totalAmount)}
        </div>
        <div class="cart-qty-row">
          <div class="cart-qty-controls" role="group" aria-label="ปรับจำนวนสินค้า">
            <button type="button" class="cart-qty-btn" data-cart-dec="${item.cartItemId}" ${qty <= 1 ? 'disabled title="จำนวนขั้นต่ำ 1 ชิ้น"' : 'title="ลดจำนวน"'} aria-label="ลดจำนวน">−</button>
            <span class="cart-qty-val">${qty}</span>
            <button type="button" class="cart-qty-btn" data-cart-inc="${item.cartItemId}" ${isAtStockLimit ? `disabled title="สต็อกคงเหลือเต็มจำนวน (${maxStock} ชิ้น)"` : 'title="เพิ่มจำนวน"'} aria-label="เพิ่มจำนวน">+</button>
          </div>
          <button type="button" class="btn btn-danger btn-sm" data-remove-cart="${item.cartItemId}">ลบ</button>
        </div>
      </div>
    `;

    if (item.mode === 'rent') {
      const rentCost = item.rentRate * item.rentDays * qty;
      const depCost = item.deposit * qty;
      return `
        <div class="cart-item">
          <img src="${itemImg}" alt="${escapeXml(item.name)}">
          <div>
            <span class="badge badge-purple">💿 เช่าแผ่นเกมรายวัน (${item.rentDays} วัน)</span>
            <h4 style="margin:0.25rem 0 0.15rem;">${escapeXml(item.name)} (${escapeXml(item.platform)})</h4>
            <div style="font-size:0.82rem; color:var(--text-secondary);">
              ค่าเช่า: ${formatTHB(item.rentRate)}/วัน × ${item.rentDays} วัน × ${qty} แผ่น = <strong>${formatTHB(rentCost)}</strong>
              | ค่ามัดจำแผ่น: <strong style="color:#fcd34d;">${formatTHB(depCost)}</strong>
              | 🚚 ค่าส่งขาไป: ${shipText}
            </div>
            <div style="font-size:0.78rem; color:#34d399;">
              📅 วันเริ่มเช่า: ${formatThaiDate(item.rentStartDate)} → กำหนดส่งคืน: ${formatThaiDate(item.rentEndDate)} (🚚 ทางร้านจ่ายเงินค่าส่งของกลับให้)
            </div>
            ${stockNoteHtml}
          </div>
          ${buildRightCol(rentCost + depCost, '#e9d5ff')}
        </div>
      `;
    } else if (item.mode === 'home_install') {
      const installCost = Number(item.installFee || 0) * qty;
      return `
        <div class="cart-item">
          <img src="${itemImg}" alt="${escapeXml(item.name)}">
          <div>
            <span class="badge badge-emerald">🏠 เช่าเครื่องติดตั้งที่บ้าน + คิดรายชั่วโมงตามจริง (ESP32)</span>
            <h4 style="margin:0.25rem 0 0.15rem;">${escapeXml(item.name)} (${escapeXml(item.platform)})</h4>
            <div style="font-size:0.82rem; color:var(--text-secondary);">
              ค่าติดตั้งเครื่องที่บ้าน: <strong style="color:#34d399;">${formatTHB(item.installFee)}</strong> × ${qty} เครื่อง = <strong>${formatTHB(installCost)}</strong>
            </div>
            <div style="font-size:0.78rem; color:#38bdf8;">
              📡 เรทรายชั่วโมง: <strong>${formatTHB(item.hourlyRate)}/ชั่วโมง</strong> (คิดตามเวลาเปิดเครื่องจริงผ่านบอร์ด ESP32 แบบ Postpaid เล่นก่อนจ่ายทีหลัง)
            </div>
            ${stockNoteHtml}
          </div>
          ${buildRightCol(installCost, '#34d399')}
        </div>
      `;
    } else {
      const lineTotal = item.price * qty;
      return `
        <div class="cart-item">
          <img src="${itemImg}" alt="${escapeXml(item.name)}">
          <div>
            <span class="badge badge-cyan">🛒 ซื้อขาด</span>
            <h4 style="margin:0.25rem 0 0.15rem;">${escapeXml(item.name)} (${escapeXml(item.platform)})</h4>
            <div style="font-size:0.84rem; color:var(--text-secondary);">
              ราคา ${formatTHB(item.price)} × ${qty} ชิ้น | 🚚 ค่าส่ง: ${shipText}
            </div>
            ${stockNoteHtml}
          </div>
          ${buildRightCol(lineTotal, 'var(--accent-cyan)')}
        </div>
      `;
    }
  }).join('');

  container.querySelectorAll('[data-cart-dec]').forEach((btn) => {
    btn.addEventListener('click', () => {
      updateCartItemQty(btn.getAttribute('data-cart-dec'), -1);
    });
  });

  container.querySelectorAll('[data-cart-inc]').forEach((btn) => {
    btn.addEventListener('click', () => {
      updateCartItemQty(btn.getAttribute('data-cart-inc'), 1);
    });
  });

  container.querySelectorAll('[data-remove-cart]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-remove-cart');
      state.cart = state.cart.filter((c) => c.cartItemId !== id);
      saveStateLocally();
      renderCartBadge();
      renderCartModalContents();
    });
  });

  const totals = calculateCartTotals();
  document.getElementById('cart-buy-subtotal').textContent = formatTHB(totals.buySubtotal);
  const homeInstallLine = document.getElementById('cart-home-install-line');
  const installSubEl = document.getElementById('cart-install-subtotal');
  if (homeInstallLine && installSubEl) {
    homeInstallLine.hidden = totals.installSubtotal === 0;
    installSubEl.textContent = formatTHB(totals.installSubtotal);
  }
  document.getElementById('cart-rent-subtotal').textContent = formatTHB(totals.rentSubtotal);
  document.getElementById('cart-deposit-subtotal').textContent = formatTHB(totals.depositSubtotal);
  document.getElementById('cart-shipping-fee').textContent = totals.shippingFee === 0
    ? 'ส่งฟรี! (฿0)'
    : `${formatTHB(totals.shippingFee)} (ยึดตามชิ้นที่ค่าส่งสูงสุด คิดครั้งเดียว)`;
  document.getElementById('cart-grand-total').textContent = formatTHB(totals.grandTotal);

  // Payment QR & Bank details (using owner's actual MAKE by KBank QR image)
  const qrImg = document.getElementById('checkout-promptpay-qr');
  if (qrImg) {
    qrImg.src = state.settings.qrImageUrl || 'payment-qr.jpg';
  }
  document.getElementById('checkout-qr-amount').textContent = `ยอดที่ต้องโอนสุทธิ ${formatTHB(totals.grandTotal)}`;
  document.getElementById('checkout-bank-display').textContent = state.settings.bankInfo || DEFAULT_SETTINGS.bankInfo;
  document.getElementById('checkout-promptpay-display').textContent = state.settings.promptPayId || DEFAULT_SETTINGS.promptPayId;
}

// ============================================================================
// Admin Panel Logic (Products CRUD, Orders Management, Settings)
// ============================================================================
function renderAdminVisibility() {
  const adminSec = document.getElementById('admin-dashboard-section');
  const toggleBtn = document.getElementById('btn-admin-toggle');
  const roleBadge = document.getElementById('user-role-badge');

  if (state.isAdmin) {
    adminSec.hidden = false;
    toggleBtn.textContent = '🛠️ แผงควบคุม Admin';
    roleBadge.textContent = '👑 โหมดผู้ดูแลระบบ: Admin (takeitcompany2026)';
    roleBadge.style.background = 'rgba(56, 189, 248, 0.16)';
    roleBadge.style.color = '#38bdf8';
  } else {
    adminSec.hidden = true;
    toggleBtn.textContent = '🔐 เข้าสู่ระบบ Admin';
    roleBadge.textContent = '👤 โหมดลูกค้า: Guest (สั่งซื้อ/เช่าได้ทันที)';
    roleBadge.style.background = 'rgba(16, 185, 129, 0.12)';
    roleBadge.style.color = '#34d399';
  }
}

function renderAdminStats() {
  const activeOrders = state.orders.filter((o) => !o.isDeletedByAdmin && !o.permanentlyErased);
  document.getElementById('stat-total-products').textContent = String(state.products.length);
  document.getElementById('stat-rentable-products').textContent = String(state.products.filter((p) => p.canRent).length);
  document.getElementById('stat-total-orders').textContent = String(activeOrders.length);
  const totalRev = activeOrders
    .filter((o) => o.status !== 'ยกเลิกรายการ')
    .reduce((sum, o) => sum + Number(o.grandTotal || 0), 0);
  document.getElementById('stat-total-revenue').textContent = formatTHB(totalRev);
}

function renderAdminOrdersTable() {
  const tbody = document.getElementById('admin-orders-tbody');
  if (!tbody) return;

  const statusFilter = document.getElementById('admin-order-filter')?.value || 'all';
  const activeOrders = state.orders.filter((o) => !o.isDeletedByAdmin && !o.permanentlyErased);
  const list = activeOrders.filter((o) => statusFilter === 'all' || o.status === statusFilter);

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <th scope="row">ยังไม่มีรายการ</th>
        <td colspan="6" style="color:var(--text-muted);">ยังไม่มีคำสั่งซื้อในสถานะที่เลือก เมื่อลูกค้า Guest สั่งซื้อหรือเช่าแผ่น ข้อมูลจะแสดงที่นี่และส่งเข้า Sheet อัตโนมัติ</td>
      </tr>
    `;
    return;
  }

  const statuses = [
    'รอตรวจสอบสลิป',
    'ชำระเงินแล้ว / กำลังจัดส่ง',
    'กำลังเช่าแผ่นเกม',
    'คืนแผ่นแล้ว / คืนมัดจำเรียบร้อย',
    'สำเร็จเรียบร้อย',
    'ยกเลิกรายการ'
  ];

  tbody.innerHTML = list.map((o) => {
    const itemsHtml = (o.items || []).map((item) => {
      if (item.mode === 'rent') {
        return `<div style="margin-block-end:0.35rem;">
          <span class="badge badge-purple">เช่า ${item.rentDays} วัน</span>
          <strong>${escapeXml(item.name)}</strong> (${escapeXml(item.platform)}) x${item.qty}<br>
          <span style="font-size:0.78rem; color:var(--text-muted);">
            ค่าเช่า ${formatTHB(item.rentRate * item.rentDays * item.qty)} + มัดจำ ${formatTHB(item.deposit * item.qty)} | คืน: ${formatThaiDate(item.rentEndDate)}
          </span>
        </div>`;
      }
      if (item.mode === 'home_install') {
        return `<div style="margin-block-end:0.35rem;">
          <span class="badge badge-emerald">🏠 เช่าติดบ้าน (ESP32)</span>
          <strong>${escapeXml(item.name)}</strong> (${escapeXml(item.platform)}) x${item.qty}<br>
          <span style="font-size:0.78rem; color:#34d399;">
            ค่าติดตั้งที่บ้าน ${formatTHB((item.installFee || 0) * item.qty)} | เรทคิดตามจริง <strong>${formatTHB(item.hourlyRate || 0)}/ชม.</strong> (${escapeXml(item.esp32DeviceId || 'ESP32')})
          </span>
        </div>`;
      }
      return `<div style="margin-block-end:0.35rem;">
        <span class="badge badge-cyan">ซื้อขาด</span>
        <strong>${escapeXml(item.name)}</strong> (${escapeXml(item.platform)}) x${item.qty} = ${formatTHB(item.price * item.qty)}
      </div>`;
    }).join('');

    const slipBtnHtml = o.slipDataUrl
      ? `<button type="button" class="btn btn-outline btn-sm" data-view-slip="${o.id}">🖼️ ดูสลิปโอนเงิน</button>`
      : `<span style="color:var(--text-muted); font-size:0.8rem;">ไม่มีรูป</span>`;

    const statusOptionsHtml = statuses.map((st) =>
      `<option value="${st}" ${o.status === st ? 'selected' : ''}>${st}</option>`
    ).join('');

    return `
      <tr>
        <th scope="row">
          <div style="color:var(--accent-cyan); font-weight:800;">${escapeXml(o.id)}</div>
          <div style="font-size:0.76rem; color:var(--text-muted);">${escapeXml(o.createdAtFormatted || '')}</div>
        </th>
        <td>
          <strong>${escapeXml(o.customer?.name || '-')}</strong><br>
          <span style="font-size:0.82rem; color:var(--accent-cyan);">📞 ${escapeXml(o.customer?.phone || '-')}</span><br>
          <span style="font-size:0.78rem; color:var(--text-muted);">Line: ${escapeXml(o.customer?.lineId || '-')}</span><br>
          <span style="font-size:0.78rem; color:var(--text-secondary);">${escapeXml(o.customer?.address || '-')}</span>
        </td>
        <td>${itemsHtml}</td>
        <td>
          <div style="font-weight:800; font-size:1rem; color:#34d399;">สุทธิ: ${formatTHB(o.grandTotal)}</div>
          <div style="font-size:0.76rem; color:var(--text-muted);">
            ซื้อ: ${formatTHB(o.buySubtotal)} | เช่า: ${formatTHB(o.rentSubtotal)}<br>
            มัดจำแผ่น: <strong style="color:#fcd34d;">${formatTHB(o.depositSubtotal)}</strong> | ค่าส่ง: <strong style="color:#38bdf8;">${formatTHB(o.shippingFee || 0)}</strong>
          </div>
        </td>
        <td>${slipBtnHtml}</td>
        <td>
          <select class="order-status-select" data-order-id="${o.id}" aria-label="เปลี่ยนสถานะออเดอร์ ${o.id}" style="min-inline-size:170px; font-size:0.82rem; padding:0.4rem;">
            ${statusOptionsHtml}
          </select>
        </td>
        <td>
          <div style="display:flex; gap:0.35rem; flex-wrap:wrap;">
            <button type="button" class="btn btn-primary btn-sm" data-admin-contract="${o.id}" title="เปิดดูหรือพิมพ์สัญญาเช่า/ซื้อขายของออเดอร์นี้">📜 ดู/พิมพ์สัญญา</button>
            <button type="button" class="btn btn-outline btn-sm" data-resync-order="${o.id}" title="ส่งข้อมูลออเดอร์นี้เข้า Google Sheets">📊 ส่งเข้า Sheet</button>
            <button type="button" class="btn btn-danger btn-sm" data-delete-order="${o.id}">ลบ</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Event listeners for order actions
  tbody.querySelectorAll('.order-status-select').forEach((sel) => {
    sel.addEventListener('change', async () => {
      const id = sel.getAttribute('data-order-id');
      const ord = state.orders.find((o) => o.id === id);
      if (!ord) return;
      ord.status = sel.value;
      ord.statusLabel = sel.value;
      saveStateLocally();
      await saveOrderToCloud(ord);
      await sendOrderToGoogleSheet(ord, 'sync_order');
      renderAdminStats();
      showToast(`✅ อัปเดตสถานะออเดอร์ ${id} เป็น "${sel.value}" แล้ว`);
    });
  });

  tbody.querySelectorAll('[data-admin-contract]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-admin-contract');
      const ord = state.orders.find((o) => o.id === id);
      if (!ord) return;
      openOrderContractModal(ord, { unmasked: true, isDraft: false });
    });
  });

  tbody.querySelectorAll('[data-view-slip]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-view-slip');
      const ord = state.orders.find((o) => o.id === id);
      if (!ord || !ord.slipDataUrl) return;
      openInfoViewerModal(
        `🖼️ สลิปโอนเงินของออเดอร์ ${ord.id}`,
        `<div style="text-align:center;">
          <p style="margin-top:0; color:var(--text-secondary);">ลูกค้า: <strong>${escapeXml(ord.customer?.name)}</strong> | ยอดชำระสุทธิ: <strong style="color:#34d399;">${formatTHB(ord.grandTotal)}</strong></p>
          <img src="${ord.slipDataUrl}" alt="สลิปโอนเงิน ${ord.id}" style="max-inline-size:100%; max-block-size:65vh; border-radius:12px; border:1px solid var(--border-highlight);">
        </div>`
      );
    });
  });

  tbody.querySelectorAll('[data-resync-order]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-resync-order');
      const ord = state.orders.find((o) => o.id === id);
      if (!ord) return;
      if (!state.settings.sheetWebhookUrl) {
        showToast('⚠️ กรุณาตั้งค่า Google Apps Script Web App URL ในเมนูตั้งค่าก่อนครับ', 'warning');
        switchAdminTab('settings');
        return;
      }
      await sendOrderToGoogleSheet(ord, 'sync_order');
      showToast(`📊 ส่งข้อมูลออเดอร์ ${id} เข้า Google Sheets เรียบร้อย!`);
    });
  });

  tbody.querySelectorAll('[data-delete-order]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-delete-order');
      openAdminDeleteOrderModal(id);
    });
  });
}

function openAdminDeleteOrderModal(orderId) {
  const ord = state.orders.find((o) => o.id === orderId);
  if (!ord) return;

  const dlg = document.getElementById('dialog-delete-order');
  const idInput = document.getElementById('delete-order-id');
  const summaryBox = document.getElementById('delete-order-summary-box');
  const reasonInput = document.getElementById('delete-order-reason');
  const restoreCheck = document.getElementById('delete-order-restore-stock');

  if (idInput) idInput.value = ord.id;
  if (reasonInput) reasonInput.value = '';
  if (restoreCheck) restoreCheck.checked = true;

  document.querySelectorAll('#delete-reason-presets .preset-chip').forEach((chip) => {
    chip.classList.remove('active');
  });

  if (summaryBox) {
    const itemNames = (ord.items || []).map((i) => `${i.name} (x${i.qty})`).join(', ');
    summaryBox.innerHTML = `
      <div style="font-weight:800; color:#fda4af; font-size:0.95rem; margin-block-end:0.25rem;">
        คำสั่งซื้อรหัส: ${escapeXml(ord.id)} (${escapeXml(ord.contractNo || ('CTR-' + ord.id))})
      </div>
      <div style="font-size:0.84rem; color:var(--text-primary);">
        👤 ลูกค้า: <strong>${escapeXml(ord.customer?.name || '-')}</strong> (${escapeXml(ord.customer?.phone || '-')})<br>
        🎮 รายการ: ${escapeXml(itemNames || '-')}<br>
        💰 ยอดชำระสุทธิ: <strong style="color:#34d399;">${formatTHB(ord.grandTotal)}</strong>
      </div>
    `;
  }

  dlg?.showModal();
}

function renderAdminProductsTable() {
  const tbody = document.getElementById('admin-products-tbody');
  if (!tbody) return;

  tbody.innerHTML = state.products.map((p) => {
    const imgs = getProductImages(p);
    const rentParts = [];
    if (p.canRent) {
      rentParts.push(`<span class="badge badge-purple">💿 เช่าแผ่น ${formatTHB(p.rentPricePerDay)}/วัน</span><br><span style="font-size:0.76rem; color:#fcd34d;">มัดจำ ${formatTHB(p.rentDeposit)}</span>`);
    }
    if (p.canHomeInstall) {
      rentParts.push(`<div style="margin-top:0.25rem;"><span class="badge badge-emerald">🏠 ติดบ้าน ${formatTHB(p.hourlyRate)}/ชม.</span><br><span style="font-size:0.76rem; color:#6ee7b7;">ค่าติดตั้ง ${formatTHB(p.installFee)} (${escapeXml(p.esp32DeviceId || 'ESP32')})</span></div>`);
    }
    const rentInfo = rentParts.length > 0
      ? rentParts.join('')
      : `<span style="color:var(--text-muted); font-size:0.82rem;">ไม่เปิดเช่า (ขายอย่างเดียว)</span>`;

    let statusText = '✅ พร้อมขาย/เช่า';
    if (p.status === 'coming_soon') statusText = '⏳ เร็วๆ นี้ (Coming Soon)';
    if (p.status === 'out_of_stock') statusText = '❌ สินค้าหมด';

    return `
      <tr>
        <th scope="row">
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <img src="${imgs[0]}" alt="${escapeXml(p.name)}" style="inline-size:52px; block-size:40px; object-fit:cover; border-radius:6px;">
            <div>
              <div style="font-weight:700;">${escapeXml(p.name)}</div>
              <div style="font-size:0.74rem; color:var(--text-muted);">${escapeXml(p.id)} • <span style="color:var(--accent-cyan);">🖼️ ${imgs.length} รูป</span></div>
            </div>
          </div>
        </th>
        <td>
          ${getCategoryLabel(p.category)}<br>
          <span class="platform-pill platform-${escapeXml(p.platform)}" style="display:inline-block; margin-top:4px;">${escapeXml(p.platform)}</span>
        </td>
        <td>
          <strong style="color:var(--accent-cyan);">${Number(p.price) > 0 ? formatTHB(p.price) : '-'}</strong><br>
          <span style="font-size:0.76rem; color:${getProductShippingFee(p) === 0 ? '#34d399' : '#38bdf8'};">
            🚚 ค่าส่ง: ${getProductShippingFee(p) === 0 ? 'ส่งฟรี' : `${formatTHB(getProductShippingFee(p))}/ชิ้น`}
          </span>
        </td>
        <td>${rentInfo}</td>
        <td><strong>${p.stock}</strong> ชิ้น</td>
        <td>${statusText}</td>
        <td>
          <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
            <button type="button" class="btn btn-outline btn-sm" data-edit-prod="${p.id}">✏️ แก้ไข / เพิ่มรูป</button>
            <button type="button" class="btn btn-danger btn-sm" data-del-prod="${p.id}">🗑️ ลบ</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-edit-prod]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openProductFormModal(btn.getAttribute('data-edit-prod'));
    });
  });

  tbody.querySelectorAll('[data-del-prod]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-del-prod');
      const prod = state.products.find((p) => p.id === id);
      if (!prod) return;
      const nowMs = Date.now();
      if (!state.deletedProductsMap || typeof state.deletedProductsMap !== 'object') {
        state.deletedProductsMap = {};
      }
      state.deletedProductsMap[id] = nowMs;
      state.products = state.products.filter((p) => p.id !== id);
      state.cart = (state.cart || []).filter((c) => c.productId !== id);
      saveStateLocally();
      renderAll();
      await deleteProductFromCloud(id, nowMs);
      showToast(`🗑️ ลบสินค้า "${prod.name}" ออกจากระบบและฐานข้อมูลถาวรเรียบร้อยแล้ว`);
    });
  });
}

function renderAdminProductImagesPreview() {
  const container = document.getElementById('admin-prod-images-preview');
  const clearAllBtn = document.getElementById('btn-clear-all-images');
  if (!container) return;

  if (!Array.isArray(state.editingProductImages)) {
    state.editingProductImages = [];
  }

  if (clearAllBtn) {
    clearAllBtn.hidden = state.editingProductImages.length === 0;
  }

  if (state.editingProductImages.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; font-size:0.84rem; color:var(--text-muted); padding:0.5rem 0;">
        ยังไม่ได้เพิ่มรูปภาพ (คลิก "📁 เลือกรูปภาพเพิ่ม" หรือวางลิงก์รูปภาพด้านบนได้เลยครับ หากไม่เพิ่ม ระบบจะสร้างภาพปกอัตโนมัติให้)
      </div>
    `;
    return;
  }

  container.innerHTML = state.editingProductImages.map((src, idx) => `
    <div class="admin-image-card ${idx === 0 ? 'is-cover' : ''}">
      <img src="${escapeXml(src)}" alt="รูปสินค้าที่ ${idx + 1}">
      <div style="font-size:0.74rem; font-weight:700; color:${idx === 0 ? 'var(--accent-cyan)' : 'var(--text-secondary)'};">
        ${idx === 0 ? '⭐ รูปปกหลัก (รูปที่ 1)' : `รูปที่ ${idx + 1}`}
      </div>
      <div style="display:flex; gap:0.3rem; flex-wrap:wrap; margin-block-start:auto;">
        ${idx > 0 ? `<button type="button" class="btn btn-outline btn-sm" data-make-cover-idx="${idx}" style="font-size:0.72rem; padding:0.25rem 0.45rem;">⬆️ ตั้งเป็นปก</button>` : ''}
        <button type="button" class="btn btn-danger btn-sm" data-remove-img-idx="${idx}" style="font-size:0.72rem; padding:0.25rem 0.45rem;">🗑️ ลบ</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('[data-make-cover-idx]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const idx = Number(btn.getAttribute('data-make-cover-idx'));
      if (idx > 0 && idx < state.editingProductImages.length) {
        const [picked] = state.editingProductImages.splice(idx, 1);
        state.editingProductImages.unshift(picked);
        renderAdminProductImagesPreview();
      }
    });
  });

  container.querySelectorAll('[data-remove-img-idx]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const idx = Number(btn.getAttribute('data-remove-img-idx'));
      if (idx >= 0 && idx < state.editingProductImages.length) {
        state.editingProductImages.splice(idx, 1);
      }
      // Reset file input so selecting the same or new image file works immediately after deletion
      const fileInput = document.getElementById('prod-image-file');
      if (fileInput) fileInput.value = '';
      renderAdminProductImagesPreview();
    });
  });
}

function openProductFormModal(productId = null) {
  const dialog = document.getElementById('dialog-product-form');
  const titleEl = document.getElementById('product-form-title');

  const prod = productId ? state.products.find((p) => p.id === productId) : null;
  titleEl.textContent = prod ? `✏️ แก้ไขสินค้า: ${prod.name}` : '➕ เพิ่มสินค้า / แผ่นเกมใหม่เข้าร้าน TakeIT';

  // Only pre-populate real uploaded/URL images; filter out auto-generated SVG placeholders so any new photo Admin adds immediately becomes the cover
  state.editingProductImages = prod
    ? getProductImages(prod).filter((img) => !isAutoGeneratedBannerSvg(img))
    : [];

  document.getElementById('prod-id').value = prod ? prod.id : '';
  document.getElementById('prod-name').value = prod ? prod.name : '';
  document.getElementById('prod-category').value = prod ? prod.category : 'disc';
  document.getElementById('prod-platform').value = prod ? prod.platform : 'PS5';
  document.getElementById('prod-status').value = prod ? prod.status : 'ready';
  document.getElementById('prod-price').value = prod ? prod.price : 1890;
  document.getElementById('prod-stock').value = prod ? prod.stock : 5;
  const shipVal = prod ? getProductShippingFee(prod) : 50;
  const shipInput = document.getElementById('prod-shipping-fee');
  if (shipInput) shipInput.value = shipVal;
  document.querySelectorAll('#prod-shipping-presets .preset-chip').forEach((chip) => {
    chip.classList.toggle('active', Number(chip.getAttribute('data-ship-preset')) === Number(shipVal));
  });
  document.getElementById('prod-can-rent').checked = prod ? Boolean(prod.canRent) : true;
  document.getElementById('prod-rent-rate').value = prod ? (prod.rentPricePerDay || 45) : 45;
  document.getElementById('prod-rent-deposit').value = prod ? (prod.rentDeposit || 500) : 500;

  const canHome = prod ? Boolean(prod.canHomeInstall) : false;
  const installVal = prod ? (prod.installFee ?? 400) : 400;
  const hourlyVal = prod ? (prod.hourlyRate ?? 30) : 30;
  const devIdVal = prod ? (prod.esp32DeviceId || '') : '';
  const canHomeCheck = document.getElementById('prod-can-home-install');
  if (canHomeCheck) canHomeCheck.checked = canHome;
  const installInput = document.getElementById('prod-install-fee');
  if (installInput) installInput.value = installVal;
  const hourlyInput = document.getElementById('prod-hourly-rate');
  if (hourlyInput) hourlyInput.value = hourlyVal;
  const devIdInput = document.getElementById('prod-esp32-device-id');
  if (devIdInput) devIdInput.value = devIdVal;

  document.querySelectorAll('#prod-install-presets .preset-chip').forEach((chip) => {
    chip.classList.toggle('active', Number(chip.getAttribute('data-install-preset')) === Number(installVal));
  });
  document.querySelectorAll('#prod-hourly-presets .preset-chip').forEach((chip) => {
    chip.classList.toggle('active', Number(chip.getAttribute('data-hourly-preset')) === Number(hourlyVal));
  });

  document.getElementById('prod-desc').value = prod ? (prod.description || '') : '';
  document.getElementById('prod-image-url').value = '';
  document.getElementById('prod-image-file').value = '';

  document.getElementById('prod-rent-fields').style.opacity = document.getElementById('prod-can-rent').checked ? '1' : '0.45';
  const homeFields = document.getElementById('prod-home-install-fields');
  if (homeFields) homeFields.style.opacity = canHome ? '1' : '0.45';
  renderAdminProductImagesPreview();
  dialog.showModal();
}

function populateSettingsForm() {
  document.getElementById('setting-sheet-url').value = state.settings.sheetWebhookUrl || '';
  document.getElementById('setting-promptpay').value = state.settings.promptPayId || '';
  document.getElementById('setting-bank-info').value = state.settings.bankInfo || '';
  document.getElementById('setting-shipping-fee').value = state.settings.shippingFee ?? 60;
  document.getElementById('setting-cloud-provider').value = state.settings.cloudProvider || 'local';
  document.getElementById('setting-firebase-json').value = state.settings.firebaseConfigJson || '';
  document.getElementById('setting-supabase-url').value = state.settings.supabaseUrl || '';
  document.getElementById('setting-supabase-key').value = state.settings.supabaseKey || '';
  toggleCloudProviderFields();
}

function toggleCloudProviderFields() {
  const provider = document.getElementById('setting-cloud-provider')?.value || 'local';
  const fbBox = document.getElementById('firebase-config-fields');
  const sbBox = document.getElementById('supabase-config-fields');
  if (fbBox) fbBox.hidden = provider !== 'firebase';
  if (sbBox) sbBox.hidden = provider !== 'supabase';
}

function switchAdminTab(tabName) {
  document.querySelectorAll('[data-admin-tab]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-admin-tab') === tabName);
  });
  document.getElementById('admin-tab-orders').hidden = tabName !== 'orders';
  document.getElementById('admin-tab-products').hidden = tabName !== 'products';
  document.getElementById('admin-tab-settings').hidden = tabName !== 'settings';
  const supTab = document.getElementById('admin-tab-support');
  if (supTab) supTab.hidden = tabName !== 'support';
  const espTab = document.getElementById('admin-tab-esp32');
  if (espTab) {
    espTab.hidden = tabName !== 'esp32';
    if (tabName === 'esp32') renderAdminEsp32Sessions();
  }
}

function openInfoViewerModal(title, bodyHtml) {
  const dialog = document.getElementById('dialog-info-viewer');
  document.getElementById('info-viewer-title').textContent = title;
  document.getElementById('info-viewer-body').innerHTML = bodyHtml;
  dialog.showModal();
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  if (type === 'warning') toast.style.borderInlineStartColor = '#f59e0b';
  if (type === 'error') toast.style.borderInlineStartColor = '#f43f5e';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4200);
}

// ============================================================================
// Event Wiring on DOMContentLoaded
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  initDialogBestPractices();
  UserInvalidFallback.init(document);
  loadInitialData();

  // Category Tabs
  document.querySelectorAll('[data-category]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-category]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeCategory = btn.getAttribute('data-category');
      renderStorefront();
    });
  });

  // Platform & Mode Filters + Search
  document.getElementById('filter-platform')?.addEventListener('change', (e) => {
    state.activePlatform = e.target.value;
    renderStorefront();
  });

  document.getElementById('filter-mode')?.addEventListener('change', (e) => {
    state.activeMode = e.target.value;
    renderStorefront();
  });

  document.getElementById('search-input')?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderStorefront();
  });

  document.getElementById('btn-view-upcoming')?.addEventListener('click', () => {
    state.activeCategory = 'it_other';
    document.querySelectorAll('[data-category]').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-category') === 'it_other');
    });
    renderStorefront();
    document.getElementById('product-grid')?.scrollIntoView({ behavior: 'smooth' });
  });

  // Rental Calculator Modal interactions
  document.querySelectorAll('#rent-day-presets .preset-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#rent-day-presets .preset-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      document.getElementById('rent-days-input').value = chip.getAttribute('data-days');
      updateRentalCalculatorBreakdown();
    });
  });

  ['rent-days-input', 'rent-start-date', 'rent-qty-input'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', updateRentalCalculatorBreakdown);
    document.getElementById(id)?.addEventListener('change', updateRentalCalculatorBreakdown);
  });

  document.getElementById('rental-calc-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const prodId = document.getElementById('rent-modal-product-id').value;
    const days = Math.max(1, Number(document.getElementById('rent-days-input').value) || 7);
    const startDate = document.getElementById('rent-start-date').value;
    const qty = Math.max(1, Number(document.getElementById('rent-qty-input').value) || 1);
    const added = addToCartRent(prodId, days, startDate, qty);
    if (added) {
      document.getElementById('dialog-rental-calc').close();
    }
  });

  // Cart & Guest Checkout
  document.getElementById('btn-open-cart')?.addEventListener('click', openCartModal);

  document.getElementById('btn-clear-cart')?.addEventListener('click', () => {
    state.cart = [];
    saveStateLocally();
    renderCartBadge();
    renderCartModalContents();
  });

  document.getElementById('cust-slip-file')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 720, 0.78);
      state.pendingSlipDataUrl = dataUrl;
      const previewWrap = document.getElementById('slip-preview-wrap');
      const previewImg = document.getElementById('slip-preview-img');
      previewImg.src = dataUrl;
      previewWrap.hidden = false;
    } catch (err) {
      console.error('Slip image read error:', err);
    }
  });

  document.getElementById('btn-preview-draft-contract')?.addEventListener('click', () => {
    openDraftContractFromCart();
  });

  document.getElementById('btn-contract-print')?.addEventListener('click', () => {
    printActiveContract();
  });

  document.getElementById('btn-contract-download')?.addEventListener('click', () => {
    downloadActiveContractHtml();
  });

  document.getElementById('btn-contract-copy')?.addEventListener('click', () => {
    copyActiveContractText();
  });

  document.getElementById('guest-checkout-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state.cart.length === 0) return;

    // Validate stock availability per product across all cart modes
    const requestedByProd = new Map();
    for (const item of state.cart) {
      requestedByProd.set(item.productId, (requestedByProd.get(item.productId) || 0) + Math.max(1, Number(item.qty || 1)));
    }
    for (const [prodId, neededQty] of requestedByProd.entries()) {
      const prod = state.products.find((p) => p.id === prodId);
      const availStock = getProductAvailableStock(prod);
      if (!prod || availStock < neededQty) {
        const prodName = prod?.name || 'สินค้า';
        showToast(`⚠️ ไม่สามารถสั่งซื้อได้: "${prodName}" มีสต็อกคงเหลือ ${availStock} ชิ้น (ในตะกร้าเลือกไว้ ${neededQty} ชิ้น) กรุณาลดจำนวนหรือรอแอดมินเพิ่มสต็อก`, 'warning');
        renderCartModalContents();
        return;
      }
    }

    const totals = calculateCartTotals();
    const hasBuy = state.cart.some((i) => i.mode === 'buy');
    const hasRent = state.cart.some((i) => i.mode === 'rent');
    const hasHomeInstall = state.cart.some((i) => i.mode === 'home_install');
    const typeParts = [];
    if (hasBuy) typeParts.push('ซื้อสินค้า');
    if (hasHomeInstall) typeParts.push('เช่าเครื่องติดบ้าน (ESP32)');
    if (hasRent) typeParts.push('เช่าแผ่นเกมรายวัน');
    const orderTypeLabel = typeParts.join(' + ') || 'ซื้อสินค้า';

    const now = new Date();
    const orderId = 'TK-' + now.toISOString().slice(2, 10).replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000);
    const contractNo = 'CTR-' + orderId;

    const newOrder = {
      id: orderId,
      contractNo,
      contractAccepted: true,
      contractAcceptedAt: now.toLocaleString('th-TH'),
      createdAt: now.toISOString(),
      createdAtFormatted: now.toLocaleString('th-TH'),
      orderTypeLabel,
      customer: {
        name: document.getElementById('cust-name').value.trim(),
        phone: document.getElementById('cust-phone').value.trim(),
        lineId: document.getElementById('cust-line').value.trim(),
        address: document.getElementById('cust-address').value.trim(),
        note: document.getElementById('cust-note').value.trim(),
        email: state.currentUser?.email || '',
        uid: state.currentUser?.uid || ''
      },
      customerUid: state.currentUser?.uid || '',
      customerEmail: state.currentUser?.email || '',
      items: [...state.cart],
      buySubtotal: totals.buySubtotal,
      installSubtotal: totals.installSubtotal,
      rentSubtotal: totals.rentSubtotal,
      depositSubtotal: totals.depositSubtotal,
      shippingFee: totals.shippingFee,
      grandTotal: totals.grandTotal,
      slipDataUrl: state.pendingSlipDataUrl || '',
      status: 'รอตรวจสอบสลิป',
      statusLabel: 'รอตรวจสอบสลิป'
    };

    // Reduce product stock & create ESP32 Console Session if home_install was ordered
    for (const item of newOrder.items) {
      const p = state.products.find((prod) => prod.id === item.productId);
      if (p && p.stock >= item.qty) {
        p.stock -= item.qty;
        saveProductToCloud(p);
      }
      if (item.mode === 'home_install') {
        await createOrUpdateEsp32SessionFromOrder(newOrder, item);
      }
    }

    state.orders.unshift(newOrder);
    state.cart = [];
    state.pendingSlipDataUrl = '';
    saveStateLocally();
    await saveOrderToCloud(newOrder);

    // Send to Google Sheets
    const sentToSheet = await sendOrderToGoogleSheet(newOrder, 'create_order');

    // Reset form & close cart
    e.target.reset();
    document.getElementById('slip-preview-wrap').hidden = true;
    document.getElementById('dialog-cart').close();
    renderAll();

    // Show Order Receipt in Order Lookup Modal
    showOrderReceiptModal(newOrder, sentToSheet);
  });

  // Order Lookup Modal
  document.getElementById('btn-check-order')?.addEventListener('click', () => {
    const dlg = document.getElementById('dialog-order-lookup');
    const input = document.getElementById('order-lookup-input');
    if (input) input.value = '';
    const container = document.getElementById('order-lookup-results');
    if (!container) return;

    if (state.currentUser) {
      // Find orders belonging to the logged-in user (including deleted orders so customer sees the Admin's reason)
      const myOrders = state.orders.filter((o) =>
        !o.permanentlyErased && (
          (o.customerUid && o.customerUid === state.currentUser.uid) ||
          (o.customerEmail && o.customerEmail.toLowerCase() === state.currentUser.email.toLowerCase())
        )
      );

      if (myOrders.length > 0) {
        renderOrderLookupList(myOrders, false, false, '', true);
      } else {
        container.innerHTML = `
          <div style="text-align:center; padding:2rem 1rem; color:var(--text-secondary); background:rgba(15,23,42,0.5); border-radius:var(--radius-md); border:1px dashed var(--border-subtle);">
            <div style="font-size:2.2rem; margin-block-end:0.5rem;">🎮</div>
            <h4 style="margin:0 0 0.35rem; color:#34d399;">ยินดีต้อนรับคุณ ${escapeXml(state.currentUser.displayName)}</h4>
            <p style="margin:0 0 1rem; font-size:0.88rem; color:var(--text-muted);">
              ยังไม่พบประวัติการสั่งซื้อด้วยบัญชี (${escapeXml(state.currentUser.email)})
            </p>
            <p style="margin:0; font-size:0.84rem; color:var(--text-secondary);">
              หากคุณเคยสั่งซื้อในโหมดทั่วไป สามารถพิมพ์ <strong>รหัสคำสั่งซื้อ (TK-...)</strong> หรือ <strong>เบอร์โทรศัพท์</strong> ในช่องด้านบนเพื่อค้นหาได้ครับ
            </p>
          </div>
        `;
      }
    } else {
      container.innerHTML = `
        <div style="text-align:center; padding:2rem 1rem; color:var(--text-secondary); background:rgba(15,23,42,0.5); border-radius:var(--radius-md); border:1px dashed var(--border-subtle);">
          <div style="font-size:2.4rem; margin-block-end:0.6rem;">🔍</div>
          <h4 style="margin:0 0 0.35rem; color:var(--accent-cyan);">ค้นหาสถานะคำสั่งซื้อของคุณ</h4>
          <p style="margin:0 0 1rem; font-size:0.88rem; color:var(--text-muted); max-inline-size:380px; margin-inline:auto;">
            กรุณากรอก <strong>รหัสคำสั่งซื้อ (Order ID)</strong> หรือ <strong>เบอร์โทรศัพท์</strong> ในช่องด้านบน แล้วกดค้นหา
          </p>
          <div style="border-block-start:1px solid var(--border-subtle); padding-block-start:0.85rem; margin-block-start:0.85rem;">
            <button type="button" class="btn btn-outline btn-sm btn-google-auth" id="btn-modal-google-login">
              <svg width="15" height="15" viewBox="0 0 24 24" style="vertical-align:middle; margin-inline-end:3px;"><path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.3l3.7 2.9C6.2 7.4 8.9 5 12 5z"/><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/><path fill="#FBBC05" d="M5.3 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.2-1.6.4-2.3L1.6 7.3C.6 9.3 0 10.6 0 12s.6 2.7 1.6 4.7l3.7-1.9z"/><path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.4-6.7-5.2L1.6 16c1.9 3.7 5.8 7 10.4 7z"/></svg>
              เข้าสู่ระบบด้วย Gmail เพื่อดูออเดอร์ทั้งหมดของคุณอัตโนมัติ
            </button>
          </div>
        </div>
      `;
      document.getElementById('btn-modal-google-login')?.addEventListener('click', loginWithGoogle);
    }
    dlg.showModal();
  });

  document.getElementById('order-lookup-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const rawQ = document.getElementById('order-lookup-input').value.trim();
    if (!rawQ || rawQ.length < 3) {
      showToast('กรุณากรอกรหัสออเดอร์หรือเบอร์โทรศัพท์อย่างน้อย 3 ตัวอักษร', 'warning');
      return;
    }
    const qLower = rawQ.toLowerCase();
    const qDigits = rawQ.replace(/\D/g, '');

    const matches = state.orders.filter((o) => {
      if (o.permanentlyErased) return false;
      const idMatch = o.id && o.id.toLowerCase().includes(qLower);
      const phoneDigits = (o.customer?.phone || '').replace(/\D/g, '');
      const phoneMatch = qDigits.length >= 3 && phoneDigits.includes(qDigits);
      return idMatch || phoneMatch;
    });

    renderOrderLookupList(matches, false, false, rawQ);
  });

  // Admin Delete Order Modal preset chips & form submission
  document.querySelectorAll('#delete-reason-presets [data-reason-preset]').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#delete-reason-presets .preset-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      const reasonInput = document.getElementById('delete-order-reason');
      if (reasonInput) {
        reasonInput.value = chip.getAttribute('data-reason-preset') || '';
        reasonInput.focus();
      }
    });
  });

  document.getElementById('admin-delete-order-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const orderId = document.getElementById('delete-order-id')?.value;
    const reason = (document.getElementById('delete-order-reason')?.value || '').trim();
    const restoreStock = document.getElementById('delete-order-restore-stock')?.checked;

    if (!orderId || !reason) {
      showToast('กรุณาระบุเหตุผลการลบคำสั่งซื้อเพื่อแจ้งให้ลูกค้าทราบครับ', 'warning');
      return;
    }

    const ord = state.orders.find((o) => o.id === orderId);
    if (!ord) return;

    // 1. Restore product stock if requested and not already restored
    if (restoreStock && !ord.stockRestored) {
      for (const item of (ord.items || [])) {
        const prod = state.products.find((p) => p.id === item.productId);
        if (prod) {
          prod.stock = Number(prod.stock || 0) + Number(item.qty || 1);
          prod.updatedAtMs = Date.now();
          await saveProductToCloud(prod);
        }
      }
      ord.stockRestored = true;
    }

    // 2. Mark order as deleted by Admin, wipe sensitive personal data (address/slip/line/notes), and attach deletion reason for customer's order lookup
    const nowStr = new Date().toLocaleString('th-TH');
    ord.isDeletedByAdmin = true;
    ord.deleteReason = reason;
    ord.deletedAt = nowStr;
    ord.updatedAtMs = Date.now();
    ord.status = 'คำสั่งซื้อถูกลบ/ยกเลิกโดยแอดมิน';
    ord.statusLabel = `ลบคำสั่งซื้อแล้ว (${reason})`;
    ord.slipDataUrl = '';
    if (ord.customer) {
      ord.customer.address = '[ลบข้อมูลที่อยู่จัดส่งออกจากระบบแล้ว]';
      ord.customer.lineId = '-';
      ord.customer.note = '';
    }

    // 3. Persist to LocalStorage, Firebase Firestore, and delete from Google Sheets
    saveStateLocally();
    await saveOrderToCloud(ord);
    await deleteOrderFromGoogleSheet(orderId, reason);

    document.getElementById('dialog-delete-order')?.close();
    renderAll();
    showToast(`🗑️ ลบออเดอร์ ${orderId} ออกจากระบบและชีต พร้อมส่งเหตุผลแจ้งเตือนไปที่หน้าออเดอร์ลูกค้าแล้ว!`);
  });

  // Admin Login & Logout
  document.getElementById('btn-admin-toggle')?.addEventListener('click', () => {
    if (state.isAdmin) {
      document.getElementById('admin-dashboard-section')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    document.getElementById('admin-login-error').hidden = true;
    document.getElementById('dialog-admin-login').showModal();
  });

  document.getElementById('btn-toggle-password')?.addEventListener('click', () => {
    const pwInput = document.getElementById('admin-password');
    const btn = document.getElementById('btn-toggle-password');
    if (pwInput.type === 'password') {
      pwInput.type = 'text';
      btn.textContent = '🙈 ซ่อน';
    } else {
      pwInput.type = 'password';
      btn.textContent = '👁️ แสดง';
    }
  });

  document.getElementById('admin-login-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = document.getElementById('admin-username').value.trim();
    const pass = document.getElementById('admin-password').value;

    if (user === ADMIN_CREDENTIALS.username && pass === ADMIN_CREDENTIALS.password) {
      state.isAdmin = true;
      sessionStorage.setItem(STORAGE_KEYS.ADMIN_SESSION, 'true');
      document.getElementById('dialog-admin-login').close();
      e.target.reset();
      renderAll();
      showToast('🔓 เข้าสู่ระบบ Admin ร้าน TakeIT สำเร็จ!');
      document.getElementById('admin-dashboard-section')?.scrollIntoView({ behavior: 'smooth' });
    } else {
      document.getElementById('admin-login-error').hidden = false;
    }
  });

  document.getElementById('btn-admin-logout')?.addEventListener('click', () => {
    state.isAdmin = false;
    sessionStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION);
    renderAll();
    showToast('ออกจากระบบ Admin เรียบร้อยแล้ว');
  });

  // Admin Sub-navigation
  document.querySelectorAll('[data-admin-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      switchAdminTab(btn.getAttribute('data-admin-tab'));
    });
  });

  document.getElementById('admin-order-filter')?.addEventListener('change', renderAdminOrdersTable);
  document.getElementById('btn-export-csv')?.addEventListener('click', exportOrdersToCsvSheet);
  document.getElementById('btn-sync-orders-sheet')?.addEventListener('click', syncAllOrdersToGoogleSheet);

  // Admin Add/Edit Product
  document.getElementById('btn-add-product-modal')?.addEventListener('click', () => openProductFormModal(null));

  document.querySelectorAll('#prod-shipping-presets .preset-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const val = Number(chip.getAttribute('data-ship-preset') || 0);
      const shipInput = document.getElementById('prod-shipping-fee');
      if (shipInput) shipInput.value = val;
      document.querySelectorAll('#prod-shipping-presets .preset-chip').forEach((c) => {
        c.classList.toggle('active', c === chip);
      });
    });
  });

  document.getElementById('prod-shipping-fee')?.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    document.querySelectorAll('#prod-shipping-presets .preset-chip').forEach((c) => {
      c.classList.toggle('active', Number(c.getAttribute('data-ship-preset')) === val);
    });
  });

  document.getElementById('prod-category')?.addEventListener('change', (e) => {
    const isNew = !document.getElementById('prod-id')?.value;
    if (!isNew) return;
    const cat = e.target.value;
    const suggestedShip = cat === 'console' ? 200 : (cat === 'disc' ? 50 : 80);
    const shipInput = document.getElementById('prod-shipping-fee');
    if (shipInput) {
      shipInput.value = suggestedShip;
      document.querySelectorAll('#prod-shipping-presets .preset-chip').forEach((c) => {
        c.classList.toggle('active', Number(c.getAttribute('data-ship-preset')) === suggestedShip);
      });
    }
  });

  document.getElementById('prod-can-rent')?.addEventListener('change', (e) => {
    document.getElementById('prod-rent-fields').style.opacity = e.target.checked ? '1' : '0.45';
  });

  document.getElementById('prod-can-home-install')?.addEventListener('change', (e) => {
    const homeFields = document.getElementById('prod-home-install-fields');
    if (homeFields) homeFields.style.opacity = e.target.checked ? '1' : '0.45';
  });

  document.querySelectorAll('#prod-install-presets .preset-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const val = Number(chip.getAttribute('data-install-preset') || 0);
      const input = document.getElementById('prod-install-fee');
      if (input) input.value = val;
      document.querySelectorAll('#prod-install-presets .preset-chip').forEach((c) => {
        c.classList.toggle('active', c === chip);
      });
    });
  });

  document.querySelectorAll('#prod-hourly-presets .preset-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const val = Number(chip.getAttribute('data-hourly-preset') || 0);
      const input = document.getElementById('prod-hourly-rate');
      if (input) input.value = val;
      document.querySelectorAll('#prod-hourly-presets .preset-chip').forEach((c) => {
        c.classList.toggle('active', c === chip);
      });
    });
  });

  document.getElementById('btn-trigger-image-file')?.addEventListener('click', (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('prod-image-file');
    if (fileInput) {
      fileInput.value = '';
      fileInput.click();
    }
  });

  document.getElementById('btn-clear-all-images')?.addEventListener('click', (e) => {
    e.preventDefault();
    state.editingProductImages = [];
    const fileInput = document.getElementById('prod-image-file');
    if (fileInput) fileInput.value = '';
    const urlInput = document.getElementById('prod-image-url');
    if (urlInput) urlInput.value = '';
    renderAdminProductImagesPreview();
    showToast('🗑️ ลบรูปภาพสินค้าทั้งหมดแล้ว สามารถเลือกรูปใหม่ได้เลยครับ');
  });

  document.getElementById('prod-image-file')?.addEventListener('click', (e) => {
    // Always clear previous FileList on click so re-selecting the exact same file after deleting fires 'change'
    e.target.value = '';
  });

  document.getElementById('prod-image-file')?.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    // Reset input value immediately so another selection always triggers 'change'
    e.target.value = '';
    if (files.length === 0) return;

    if (!Array.isArray(state.editingProductImages)) {
      state.editingProductImages = [];
    }
    // Remove any auto-generated placeholder SVG when real photos are added
    state.editingProductImages = state.editingProductImages.filter((img) => !isAutoGeneratedBannerSvg(img));

    let addedCount = 0;
    for (const file of files) {
      try {
        const compressed = await compressImageFileToDataUrl(file, 560, 0.72);
        if (compressed) {
          state.editingProductImages.push(compressed);
          addedCount++;
        }
      } catch (err) {
        console.error('Product image upload error:', err);
        showToast(`⚠️ ${err.message || `ไม่สามารถอ่านไฟล์รูป "${file.name}" ได้`}`, 'warning');
      }
    }

    renderAdminProductImagesPreview();
    if (addedCount > 0) {
      showToast(`🖼️ เพิ่มรูปภาพเรียบร้อย ${addedCount} รูป! (รวม ${state.editingProductImages.length} รูป)`);
    }
  });

  const addImageFromUrlInput = () => {
    const urlInput = document.getElementById('prod-image-url');
    const url = normalizeImageUrl(urlInput?.value || '');
    if (!url) {
      showToast('กรุณาวางลิงก์รูปภาพ (URL) ก่อนกดเพิ่มรูปครับ', 'warning');
      return;
    }
    if (!Array.isArray(state.editingProductImages)) {
      state.editingProductImages = [];
    }
    state.editingProductImages = state.editingProductImages.filter((img) => !isAutoGeneratedBannerSvg(img));
    state.editingProductImages.push(url);
    if (urlInput) urlInput.value = '';
    renderAdminProductImagesPreview();
    showToast(`🖼️ เพิ่มลิงก์รูปภาพแล้ว! (รวม ${state.editingProductImages.length} รูป)`);
  };

  document.getElementById('btn-add-image-url')?.addEventListener('click', (e) => {
    e.preventDefault();
    addImageFromUrlInput();
  });

  document.getElementById('prod-image-url')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addImageFromUrlInput();
    }
  });

  document.getElementById('admin-product-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const existingId = document.getElementById('prod-id').value;
    const name = document.getElementById('prod-name').value.trim();
    const category = document.getElementById('prod-category').value;
    const platform = document.getElementById('prod-platform').value;
    const status = document.getElementById('prod-status').value;
    const price = Number(document.getElementById('prod-price').value || 0);
    const stock = Number(document.getElementById('prod-stock').value || 0);
    const shippingFee = Math.max(0, Number(document.getElementById('prod-shipping-fee')?.value ?? 50));
    const canRent = document.getElementById('prod-can-rent').checked;
    const rentPricePerDay = canRent ? Number(document.getElementById('prod-rent-rate').value || 0) : 0;
    const rentDeposit = canRent ? Number(document.getElementById('prod-rent-deposit').value || 0) : 0;
    const canHomeInstall = Boolean(document.getElementById('prod-can-home-install')?.checked);
    const installFee = canHomeInstall ? Math.max(0, Number(document.getElementById('prod-install-fee')?.value || 0)) : 0;
    const hourlyRate = canHomeInstall ? Math.max(0, Number(document.getElementById('prod-hourly-rate')?.value || 0)) : 0;
    const esp32DeviceId = canHomeInstall
      ? (document.getElementById('prod-esp32-device-id')?.value.trim() || `ESP32-${String(platform || 'CON').toUpperCase()}-01`)
      : '';
    const description = document.getElementById('prod-desc').value.trim();
    const pendingUrl = normalizeImageUrl(document.getElementById('prod-image-url').value);

    if (!Array.isArray(state.editingProductImages)) {
      state.editingProductImages = [];
    }

    if (pendingUrl) {
      state.editingProductImages = state.editingProductImages.filter((img) => !isAutoGeneratedBannerSvg(img));
      state.editingProductImages.push(pendingUrl);
      document.getElementById('prod-image-url').value = '';
    }

    const cleanedEditingImages = state.editingProductImages.filter(Boolean).filter((img) => !isAutoGeneratedBannerSvg(img));
    const finalImages = cleanedEditingImages.length > 0
      ? [...cleanedEditingImages]
      : [makeProductBannerSvg(name, `${platform} • TakeIT`, '#1e3a8a', '#4c1d95', category === 'console' ? '🕹️' : '💿')];

    const nowMs = Date.now();
    const existingProd = existingId ? state.products.find((p) => p.id === existingId) : null;
    const prodObj = {
      id: existingId || 'PROD-' + nowMs,
      name,
      category,
      platform,
      status,
      price,
      stock,
      shippingFee,
      canRent,
      rentPricePerDay,
      rentDeposit,
      canHomeInstall,
      installFee,
      hourlyRate,
      esp32DeviceId,
      description,
      image: finalImages[0],
      images: finalImages,
      isCustom: true,
      isDeleted: false,
      createdAtMs: existingProd?.createdAtMs || nowMs,
      updatedAtMs: nowMs
    };

    if (state.deletedProductsMap && state.deletedProductsMap[prodObj.id]) {
      delete state.deletedProductsMap[prodObj.id];
    }

    if (existingId) {
      const idx = state.products.findIndex((p) => p.id === existingId);
      if (idx > -1) state.products[idx] = prodObj;
    } else {
      state.products.unshift(prodObj);
    }

    // Reset filters to ensure the newly added product is immediately visible
    state.activeCategory = 'all';
    state.activePlatform = 'all';
    state.activeMode = 'all';
    state.searchQuery = '';
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    const platformFilter = document.getElementById('filter-platform');
    if (platformFilter) platformFilter.value = 'all';
    const modeFilter = document.getElementById('filter-mode');
    if (modeFilter) modeFilter.value = 'all';
    document.querySelectorAll('[data-category]').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-category') === 'all');
    });

    saveStateLocally();
    await saveProductToCloud(prodObj);
    document.getElementById('dialog-product-form').close();
    renderAll();
    showToast(`💾 บันทึกสินค้า "${prodObj.name}" เรียบร้อยแล้ว!`);
  });

  // Admin Settings Form
  document.getElementById('setting-cloud-provider')?.addEventListener('change', toggleCloudProviderFields);

  document.getElementById('setting-qr-file')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      state.settings.qrImageUrl = await compressImageFileToDataUrl(file, 700, 0.85);
      showToast('📲 อัปเดตรูป QR Code รับเงินเรียบร้อยแล้ว กดบันทึกการตั้งค่าเพื่อยืนยัน');
    } catch (err) {
      console.error('QR image read error:', err);
    }
  });

  document.getElementById('admin-settings-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    state.settings = {
      ...state.settings,
      sheetWebhookUrl: document.getElementById('setting-sheet-url').value.trim(),
      promptPayId: document.getElementById('setting-promptpay').value.trim(),
      bankInfo: document.getElementById('setting-bank-info').value.trim(),
      qrImageUrl: state.settings.qrImageUrl || 'payment-qr.jpg',
      shippingFee: Number(document.getElementById('setting-shipping-fee').value || 0),
      cloudProvider: document.getElementById('setting-cloud-provider').value,
      firebaseConfigJson: document.getElementById('setting-firebase-json').value.trim(),
      supabaseUrl: document.getElementById('setting-supabase-url').value.trim(),
      supabaseKey: document.getElementById('setting-supabase-key').value.trim()
    };

    saveStateLocally();
    await initCloudConnection();
    renderAll();
    showToast('⚙️ บันทึกการตั้งค่าระบบเรียบร้อยแล้ว!');
  });

  document.getElementById('btn-test-sheet')?.addEventListener('click', async () => {
    const url = document.getElementById('setting-sheet-url').value.trim();
    if (!url) {
      showToast('⚠️ กรุณาวาง Google Apps Script Web App URL ก่อนกดทดสอบครับ', 'warning');
      return;
    }
    state.settings.sheetWebhookUrl = url;
    saveStateLocally();

    const sampleOrder = {
      id: 'TK-TEST-' + Math.floor(100 + Math.random() * 900),
      createdAtFormatted: new Date().toLocaleString('th-TH'),
      orderTypeLabel: '[ทดสอบระบบ] เช่าแผ่นเกม + ซื้อสินค้า',
      customer: {
        name: 'ลูกค้าทดสอบ (Test Guest)',
        phone: '0899999999',
        lineId: '@takeit_test',
        address: '99/9 ถ.พระราม 9 เขตห้วยขวาง กรุงเทพฯ 10310',
        note: 'ทดสอบการส่งข้อมูลเข้า Google Sheets จากเว็บ TakeIT'
      },
      items: [
        {
          name: 'Monster Hunter Wilds (PS5)',
          platform: 'PS5',
          mode: 'rent',
          qty: 1,
          rentDays: 7,
          rentRate: 50,
          deposit: 600,
          rentStartDate: new Date().toISOString().slice(0, 10),
          rentEndDate: addDaysToDateStr(new Date().toISOString().slice(0, 10), 7)
        }
      ],
      buySubtotal: 0,
      rentSubtotal: 350,
      depositSubtotal: 600,
      shippingFee: 60,
      grandTotal: 1010,
      statusLabel: 'ทดสอบการเชื่อมต่อสำเร็จ'
    };

    await sendOrderToGoogleSheet(sampleOrder, 'create_order');
    showToast('✅ ส่งแถวข้อมูลทดสอบไปยัง Google Sheets แล้ว! กรุณาเปิดดูในชีตของคุณ');
  });

  document.getElementById('btn-show-script-guide')?.addEventListener('click', async () => {
    let scriptText = 'โปรดเปิดดูไฟล์ google-apps-script.gs ในโฟลเดอร์โปรเจกต์';
    try {
      const res = await fetch('google-apps-script.gs');
      if (res.ok) scriptText = await res.text();
    } catch (e) {}

    openInfoViewerModal(
      '📜 วิธีเชื่อมต่อ Google Sheets อัตโนมัติ (ใช้เวลา 1 นาที)',
      `
        <ol style="line-height:1.75; color:var(--text-secondary); padding-inline-start:1.2rem; margin-top:0;">
          <li>สร้างไฟล์ <strong>Google Sheets</strong> ใหม่ในบัญชี Google ของคุณ</li>
          <li>ไปที่เมนูด้านบน <strong>Extensions (ส่วนขยาย) &gt; Apps Script</strong></li>
          <li>คัดลอกโค้ดด้านล่างนี้ (หรือจากไฟล์ <code>google-apps-script.gs</code>) ไปวางแทนที่โค้ดเดิมทั้งหมด แล้วกด <strong>Save</strong></li>
          <li>กดปุ่ม <strong>Deploy &gt; New deployment</strong> เลือกชนิดเป็น <strong>Web app</strong></li>
          <li>ตั้งค่า <em>Execute as: Me</em> และ <em>Who has access: Anyone (ทุกคน)</em> แล้วกด Deploy</li>
          <li>คัดลอก <strong>Web app URL</strong> ที่ได้ มาวางในช่อง <em>Google Apps Script Web App URL</em> ในหน้าตั้งค่าของเว็บ TakeIT</li>
        </ol>
        <div class="code-block">${escapeXml(scriptText)}</div>
      `
    );
  });

  document.getElementById('btn-push-local-to-cloud')?.addEventListener('click', pushAllToCloud);

  document.getElementById('btn-reset-demo-data')?.addEventListener('click', () => {
    const nowMs = Date.now();
    state.deletedProductsMap = {};
    state.products = DEFAULT_PRODUCTS.map((p) => ({ ...p, isDeleted: false, updatedAtMs: nowMs }));
    saveStateLocally();
    renderAll();
    showToast('🔄 รีเซ็ตรายการสินค้าตัวอย่างเริ่มต้นเรียบร้อยแล้ว');
  });

  // Customer Support & Product Wishlist interactions
  document.getElementById('btn-open-support')?.addEventListener('click', () => openSupportModal('wishlist'));
  document.getElementById('btn-banner-request-product')?.addEventListener('click', () => openSupportModal('wishlist'));
  document.getElementById('btn-footer-open-support')?.addEventListener('click', () => openSupportModal('issue'));
  document.getElementById('btn-footer-request-item')?.addEventListener('click', () => openSupportModal('wishlist'));

  document.getElementById('btn-tab-modal-wishlist')?.addEventListener('click', () => {
    document.getElementById('btn-tab-modal-wishlist')?.classList.add('active');
    document.getElementById('btn-tab-modal-issue')?.classList.remove('active');
    const pw = document.getElementById('pane-modal-wishlist');
    const pi = document.getElementById('pane-modal-issue');
    if (pw) pw.hidden = false;
    if (pi) pi.hidden = true;
  });

  document.getElementById('btn-tab-modal-issue')?.addEventListener('click', () => {
    document.getElementById('btn-tab-modal-issue')?.classList.add('active');
    document.getElementById('btn-tab-modal-wishlist')?.classList.remove('active');
    const pw = document.getElementById('pane-modal-wishlist');
    const pi = document.getElementById('pane-modal-issue');
    if (pw) pw.hidden = true;
    if (pi) pi.hidden = false;
  });

  // Issue screenshot file upload
  document.getElementById('issue-image-file')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      showToast('⏳ กำลังประมวลผลรูปภาพ...');
      let fileToCompress = file;
      if (isHeicFile(file)) {
        fileToCompress = await convertHeicToJpegBlob(file);
      }
      const dataUrl = await compressImageFileToDataUrl(fileToCompress, 1200, 0.85);
      state.pendingIssueImageDataUrl = dataUrl;
      const previewImg = document.getElementById('issue-image-preview');
      const previewWrap = document.getElementById('issue-image-preview-wrap');
      if (previewImg && previewWrap) {
        previewImg.src = dataUrl;
        previewWrap.style.display = 'flex';
      }
      showToast('📷 แนบรูปภาพประกอบปัญหาเรียบร้อยแล้ว');
    } catch (err) {
      console.error('Issue image process error:', err);
      showToast('⚠️ ไม่สามารถอ่านไฟล์รูปนี้ได้ กรุณาลองใช้รูป JPG หรือ PNG', 'warning');
    }
  });

  document.getElementById('btn-remove-issue-image')?.addEventListener('click', () => {
    state.pendingIssueImageDataUrl = '';
    const fileInput = document.getElementById('issue-image-file');
    if (fileInput) fileInput.value = '';
    const previewWrap = document.getElementById('issue-image-preview-wrap');
    if (previewWrap) previewWrap.style.display = 'none';
  });

  // Submit Product Wishlist / Request Form
  document.getElementById('form-request-product')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prodName = document.getElementById('req-prod-name')?.value.trim();
    const platform = document.getElementById('req-prod-platform')?.value;
    const intent = document.getElementById('req-prod-intent')?.value;
    const details = document.getElementById('req-prod-details')?.value.trim();
    const custName = document.getElementById('req-cust-name')?.value.trim();
    const custPhone = document.getElementById('req-cust-phone')?.value.trim();
    const custLine = document.getElementById('req-cust-line')?.value.trim();
    const custEmail = document.getElementById('req-cust-email')?.value.trim();

    if (!prodName || !custName || !custPhone || !custLine) {
      showToast('⚠️ กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วนครับ', 'warning');
      return;
    }

    const now = new Date();
    const ticketId = `REQ-${Date.now().toString(36).toUpperCase()}`;
    const newTicket = {
      id: ticketId,
      type: 'wishlist',
      title: prodName,
      category: platform,
      intent: intent,
      intentLabel: intent,
      details: details,
      customerName: custName,
      phone: custPhone,
      lineId: custLine,
      email: custEmail,
      orderId: '',
      screenshotDataUrl: '',
      status: 'pending',
      statusLabel: 'รอแอดมินติดต่อกลับ',
      adminNote: '',
      createdAt: now.toISOString(),
      createdAtThai: now.toLocaleString('th-TH'),
      updatedAtMs: now.getTime(),
      customerUid: state.currentUser?.uid || ''
    };

    // Save contact locally for autofill next time
    try {
      localStorage.setItem(STORAGE_KEYS.SAVED_CONTACT, JSON.stringify({
        name: custName,
        phone: custPhone,
        lineId: custLine,
        email: custEmail
      }));
    } catch (err) {}

    state.supportTickets.unshift(newTicket);
    saveStateLocally();
    await saveSupportTicketToCloud(newTicket);
    await sendSupportTicketToGoogleSheet(newTicket, 'submit_support_ticket');

    document.getElementById('dialog-support-request')?.close();
    e.target.reset();
    updateSupportBadgeCount();
    if (state.isAdmin) renderAdminSupportTicketsTable();

    showToast(`🎉 ส่งคำขอสินค้า "${prodName}" เรียบร้อยแล้ว! (รหัสรายการ: ${ticketId}) ทางร้านจะรีบติดต่อกลับครับ`);
  });

  // Submit Issue Report Form
  document.getElementById('form-report-issue')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const category = document.getElementById('issue-category')?.value;
    const orderId = document.getElementById('issue-order-id')?.value.trim();
    const details = document.getElementById('issue-details')?.value.trim();
    const custName = document.getElementById('issue-cust-name')?.value.trim();
    const custPhone = document.getElementById('issue-cust-phone')?.value.trim();
    const custLine = document.getElementById('issue-cust-line')?.value.trim();
    const custEmail = document.getElementById('issue-cust-email')?.value.trim();

    if (!details || !custName || !custPhone || !custLine) {
      showToast('⚠️ กรุณากรอกข้อมูลและรายละเอียดปัญหาให้ครบถ้วนครับ', 'warning');
      return;
    }

    const now = new Date();
    const ticketId = `TKT-${Date.now().toString(36).toUpperCase()}`;
    const newTicket = {
      id: ticketId,
      type: 'issue',
      title: `[แจ้งปัญหา] ${category}`,
      category: category,
      intent: '',
      intentLabel: '-',
      details: details,
      orderId: orderId,
      customerName: custName,
      phone: custPhone,
      lineId: custLine,
      email: custEmail,
      screenshotDataUrl: state.pendingIssueImageDataUrl || '',
      status: 'pending',
      statusLabel: 'รอแอดมินติดต่อกลับ',
      adminNote: '',
      createdAt: now.toISOString(),
      createdAtThai: now.toLocaleString('th-TH'),
      updatedAtMs: now.getTime(),
      customerUid: state.currentUser?.uid || ''
    };

    // Save contact locally for autofill next time
    try {
      localStorage.setItem(STORAGE_KEYS.SAVED_CONTACT, JSON.stringify({
        name: custName,
        phone: custPhone,
        lineId: custLine,
        email: custEmail
      }));
    } catch (err) {}

    state.supportTickets.unshift(newTicket);
    saveStateLocally();
    await saveSupportTicketToCloud(newTicket);
    await sendSupportTicketToGoogleSheet(newTicket, 'submit_support_ticket');

    state.pendingIssueImageDataUrl = '';
    const fileInput = document.getElementById('issue-image-file');
    if (fileInput) fileInput.value = '';
    const previewWrap = document.getElementById('issue-image-preview-wrap');
    if (previewWrap) previewWrap.style.display = 'none';

    document.getElementById('dialog-support-request')?.close();
    e.target.reset();
    updateSupportBadgeCount();
    if (state.isAdmin) renderAdminSupportTicketsTable();

    showToast(`📨 ส่งแจ้งปัญหาเรียบร้อยแล้ว! (รหัสรายการ: ${ticketId}) เจ้าหน้าที่จะรีบติดต่อกลับเพื่อดูแลให้ครับ`);
  });

  // Admin Support Filters & Actions
  document.getElementById('admin-support-filter-type')?.addEventListener('change', renderAdminSupportTicketsTable);
  document.getElementById('admin-support-filter-status')?.addEventListener('change', renderAdminSupportTicketsTable);
  document.getElementById('btn-export-support-csv')?.addEventListener('click', exportSupportTicketsToCsv);
  document.getElementById('btn-sync-support-sheet')?.addEventListener('click', syncAllSupportTicketsToGoogleSheet);

  // Collapsible Hero / Store Intro Footer Button
  document.getElementById('btn-collapse-hero-intro')?.addEventListener('click', () => {
    const heroDisclosure = document.getElementById('hero-intro-disclosure');
    if (heroDisclosure) {
      heroDisclosure.removeAttribute('open');
      heroDisclosure.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });

  // Home Console Installation & Real-time ESP32 Meter Modal Wiring
  document.getElementById('btn-open-home-console')?.addEventListener('click', () => {
    openHomeConsoleModal('service');
  });

  document.getElementById('btn-tab-home-service')?.addEventListener('click', () => {
    switchHomeConsoleModalTab('service');
  });

  document.getElementById('btn-tab-home-meter')?.addEventListener('click', () => {
    switchHomeConsoleModalTab('meter');
  });

  document.getElementById('btn-switch-to-meter-tab')?.addEventListener('click', () => {
    switchHomeConsoleModalTab('meter');
  });

  document.getElementById('esp32-lookup-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = (document.getElementById('esp32-lookup-input')?.value || '').trim();
    state.esp32SearchQuery = q;
    renderEsp32LiveMeterResults(q);
  });

  document.getElementById('btn-admin-add-esp32-session')?.addEventListener('click', () => {
    openAdminEsp32SessionModal(null);
  });

  document.getElementById('btn-open-esp32-customer-view')?.addEventListener('click', () => {
    openHomeConsoleModal('meter');
  });

  document.getElementById('esp32-console-select')?.addEventListener('change', (e) => {
    const prod = state.products.find((p) => p.id === e.target.value);
    if (prod) {
      const installInput = document.getElementById('esp32-install-fee-input');
      const hourlyInput = document.getElementById('esp32-hourly-rate-input');
      const devIdInput = document.getElementById('esp32-device-id-input');
      if (installInput) installInput.value = prod.installFee ?? 400;
      if (hourlyInput) hourlyInput.value = prod.hourlyRate ?? 30;
      if (devIdInput && !devIdInput.value.trim()) {
        devIdInput.value = prod.esp32DeviceId || `ESP32-${String(prod.platform || 'CON').toUpperCase()}-01`;
      }
    }
  });

  document.getElementById('admin-esp32-session-form')?.addEventListener('submit', handleSaveAdminEsp32Session);

  // Start 1-second real-time stopwatch ticker for active ESP32 consoles
  startEsp32LiveTicker();
});

function refreshOpenOrderLookupModal() {
  const input = document.getElementById('order-lookup-input');
  const rawQ = (input?.value || '').trim();
  if (rawQ.length >= 3) {
    const qLower = rawQ.toLowerCase();
    const qDigits = rawQ.replace(/\D/g, '');
    const matches = state.orders.filter((o) => {
      if (o.permanentlyErased) return false;
      const idMatch = o.id && o.id.toLowerCase().includes(qLower);
      const phoneDigits = (o.customer?.phone || '').replace(/\D/g, '');
      const phoneMatch = qDigits.length >= 3 && phoneDigits.includes(qDigits);
      return idMatch || phoneMatch;
    });
    renderOrderLookupList(matches, false, false, rawQ);
    return;
  }

  if (state.currentUser) {
    const myOrders = state.orders.filter((o) =>
      !o.permanentlyErased && (
        (o.customerUid && o.customerUid === state.currentUser.uid) ||
        (o.customerEmail && o.customerEmail.toLowerCase() === state.currentUser.email.toLowerCase())
      )
    );
    if (myOrders.length > 0) {
      renderOrderLookupList(myOrders, false, false, '', true);
    }
  }
}

function showOrderReceiptModal(order, sentToSheet) {
  const dlg = document.getElementById('dialog-order-lookup');
  document.getElementById('order-lookup-input').value = order.id;
  renderOrderLookupList([order], true, sentToSheet);
  dlg.showModal();
}

function renderOrderLookupList(orders, isNewOrder = false, sentToSheet = false, searchQuery = '', isMyOrders = false) {
  const container = document.getElementById('order-lookup-results');
  if (!container) return;

  const visibleOrders = (orders || []).filter((o) => !o.permanentlyErased);

  if (visibleOrders.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:2rem 1rem; color:var(--text-muted); background:rgba(15,23,42,0.4); border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
        <div style="font-size:2rem; margin-block-end:0.4rem;">❓</div>
        <strong style="display:block; color:var(--text-secondary); margin-block-end:0.25rem;">ไม่พบข้อมูลคำสั่งซื้อที่ค้นหา "${escapeXml(searchQuery)}"</strong>
        <p style="margin:0; font-size:0.84rem;">โปรดตรวจสอบรหัสคำสั่งซื้อ (เช่น TK-26...) หรือเบอร์โทรศัพท์ แล้วลองใหม่อีกครั้งครับ</p>
      </div>
    `;
    return;
  }

  const myOrdersHeader = isMyOrders
    ? `
      <div style="background:rgba(56,189,248,0.12); border:1px solid rgba(56,189,248,0.35); padding:0.85rem 1rem; border-radius:var(--radius-sm); margin-block-end:1rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
        <div>
          <strong style="color:var(--accent-cyan); display:block;">👋 บัญชี: ${escapeXml(state.currentUser?.displayName || '')} (${escapeXml(state.currentUser?.email || '')})</strong>
          <span style="font-size:0.82rem; color:var(--text-secondary);">พบประวัติคำสั่งซื้อและสัญญาอิเล็กทรอนิกส์ของคุณทั้งหมด ${visibleOrders.length} รายการ</span>
        </div>
        <span class="badge badge-cyan">ล็อกอินด้วย Gmail แล้ว</span>
      </div>
    `
    : '';

  const bannerHtml = isNewOrder
    ? `
      <div style="background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.45); padding:1rem; border-radius:var(--radius-sm); margin-block-end:1rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
          <div>
            <h3 style="margin:0 0 0.25rem; color:#34d399;">🎉 สั่งซื้อ / เช่าแผ่นเกม และสร้างสัญญาอัตโนมัติสำเร็จ!</h3>
            <p style="margin:0; font-size:0.86rem; color:var(--text-secondary);">
              รหัสคำสั่งซื้อ: <strong>${escapeXml(visibleOrders[0].id)}</strong> • เลขที่สัญญา: <strong>${escapeXml(visibleOrders[0].contractNo || ('CTR-' + visibleOrders[0].id))}</strong>
              ${sentToSheet ? '(บันทึกข้อมูลลง Google Sheets เรียบร้อยแล้ว)' : '(บันทึกเข้าระบบร้าน TakeIT เรียบร้อยแล้ว)'}
            </p>
          </div>
          <button type="button" class="btn btn-primary btn-sm" data-view-contract="${escapeXml(visibleOrders[0].id)}" data-unmasked="true">
            📜 เปิดดู / พิมพ์สัญญาฉบับเต็ม
          </button>
        </div>
      </div>
    `
    : '';

  container.innerHTML = myOrdersHeader + bannerHtml + visibleOrders.map((o) => {
    const qNorm = String(searchQuery || '').trim().toLowerCase();
    const qDigits = String(searchQuery || '').replace(/\D/g, '');
    const orderPhoneDigits = String(o.customer?.phone || '').replace(/\D/g, '');
    const verifiedByExactQuery = Boolean(
      (o.id && qNorm === o.id.toLowerCase()) ||
      (qDigits.length >= 9 && orderPhoneDigits && qDigits === orderPhoneDigits)
    );

    // Show unmasked info if viewer is Admin, logged-in owner, just placed the order, or entered exact full Order ID / full phone number
    const isOwner = state.isAdmin || isMyOrders || isNewOrder || verifiedByExactQuery || Boolean(state.currentUser && (
      (o.customerUid && o.customerUid === state.currentUser.uid) ||
      (o.customerEmail && state.currentUser.email && o.customerEmail.toLowerCase() === state.currentUser.email.toLowerCase())
    ));

    const displayName = isOwner ? (o.customer?.name || '-') : maskCustomerName(o.customer?.name);
    const displayPhone = isOwner ? (o.customer?.phone || '-') : maskPhone(o.customer?.phone);
    const contractMeta = getContractMetadata(o);
    const isDeleted = Boolean(o.isDeletedByAdmin);

    const itemsList = (o.items || []).map((item) => {
      if (item.mode === 'rent') {
        return `<li>[เช่าแผ่น ${item.rentDays} วัน] <strong>${escapeXml(item.name)}</strong> (${escapeXml(item.platform)}) x${item.qty} — ค่าเช่า ${formatTHB(item.rentRate * item.rentDays * item.qty)} + มัดจำแผ่น ${formatTHB(item.deposit * item.qty)} (คืนแผ่นวันที่ ${formatThaiDate(item.rentEndDate)})</li>`;
      }
      if (item.mode === 'home_install') {
        return `<li>[🏠 เช่าเครื่องติดตั้งที่บ้าน + บอร์ด ESP32] <strong>${escapeXml(item.name)}</strong> (${escapeXml(item.platform)}) x${item.qty} — ค่าติดตั้ง ${formatTHB((item.installFee || 0) * item.qty)} + เรทรายชั่วโมง <strong style="color:#34d399;">${formatTHB(item.hourlyRate || 0)}/ชม.</strong> (คิดตามเวลาเปิดเครื่องจริงผ่านบอร์ด <code>${escapeXml(item.esp32DeviceId || 'ESP32')}</code>)</li>`;
      }
      return `<li>[ซื้อขาด] <strong>${escapeXml(item.name)}</strong> (${escapeXml(item.platform)}) x${item.qty} — ${formatTHB(item.price * item.qty)}</li>`;
    }).join('');

    const deletedNoticeHtml = isDeleted
      ? `
        <div style="background:rgba(244,63,94,0.16); border:1px solid rgba(244,63,94,0.55); border-radius:8px; padding:0.8rem 0.95rem; margin-block-end:0.65rem;">
          <div style="font-weight:800; color:#fda4af; font-size:0.9rem; margin-block-end:0.25rem;">
            ⚠️ คำสั่งซื้อนี้ถูกยกเลิกและลบออกจากระบบโดยผู้ดูแลร้าน (Admin)
          </div>
          <div style="font-size:0.9rem; color:#ffffff; line-height:1.5;">
            📌 <strong>เหตุผลจากแอดมิน:</strong> <span style="color:#fde047; font-weight:700;">"${escapeXml(o.deleteReason || 'ไม่ระบุเหตุผล')}"</span>
          </div>
          <div style="font-size:0.76rem; color:#fda4af; margin-block-start:0.3rem;">
            🕒 ดำเนินการเมื่อ: ${escapeXml(o.deletedAt || '-')} • ข้อมูลคำสั่งซื้อในระบบและสัญญาเช่า/ซื้อขายถูกยกเลิกเรียบร้อยแล้ว
          </div>
        </div>
      `
      : '';

    const hasHomeInstallItem = (o.items || []).some((item) => item.mode === 'home_install');
    const footerActionsHtml = isDeleted
      ? `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; flex-wrap:wrap; margin-block-start:0.65rem; padding-block-start:0.6rem; border-block-start:1px dashed rgba(244,63,94,0.4);">
          <span style="font-size:0.78rem; color:#fda4af;">คุณสามารถกดรับทราบเพื่อลบรายการแจ้งเตือนนี้ออกจากหน้าประวัติได้ทันที</span>
          <button type="button" class="btn btn-danger btn-sm" data-ack-deleted-order="${escapeXml(o.id)}">
            🗑️ รับทราบและลบออกจากประวัติออเดอร์
          </button>
        </div>
      `
      : `
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; flex-wrap:wrap; margin-block-start:0.65rem; padding-block-start:0.6rem; border-block-start:1px dashed var(--border-subtle);">
          ${hasHomeInstallItem ? `<button type="button" class="btn btn-emerald btn-sm" data-lookup-esp32-order="${escapeXml(o.id)}">📡 เช็คชั่วโมงเครื่อง Real-time (ESP32)</button>` : ''}
          <button type="button" class="btn btn-outline btn-sm" data-view-contract="${escapeXml(o.id)}" data-unmasked="${isOwner ? 'true' : 'false'}">
            📜 เปิดดู${escapeXml(contractMeta.shortLabel)}
          </button>
          <button type="button" class="btn btn-primary btn-sm" data-print-contract="${escapeXml(o.id)}" data-unmasked="${isOwner ? 'true' : 'false'}">
            🖨️ พิมพ์สัญญา / บันทึก PDF
          </button>
        </div>
      `;

    return `
      <div class="highlight-box" style="margin-block-end:0.85rem; ${isDeleted ? 'border-color:rgba(244,63,94,0.65); background:rgba(244,63,94,0.06);' : ''}">
        <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:0.5rem; border-block-end:1px solid var(--border-subtle); padding-block-end:0.5rem; margin-block-end:0.6rem;">
          <div>
            <strong>รหัสออเดอร์: <span style="color:${isDeleted ? '#fda4af' : 'var(--accent-cyan)'}; ${isDeleted ? 'text-decoration:line-through;' : ''}">${escapeXml(o.id)}</span></strong>
            <span style="font-size:0.78rem; color:var(--text-muted); margin-inline-start:0.5rem;">(เลขที่สัญญา: ${escapeXml(contractMeta.contractNo)})</span>
          </div>
          <span class="badge" style="${isDeleted ? 'background:rgba(244,63,94,0.22); color:#fda4af; border:1px solid rgba(244,63,94,0.5);' : ''}">${isDeleted ? '❌ ถูกลบ/ยกเลิกโดยแอดมิน' : escapeXml(o.status || 'รอตรวจสอบสลิป')}</span>
        </div>
        ${deletedNoticeHtml}
        <div style="font-size:0.85rem; color:var(--text-secondary); margin-block-end:0.5rem;">
          ผู้ทำสัญญา/ผู้รับ: <strong>${escapeXml(displayName)}</strong> (${escapeXml(displayPhone)}) • วันที่ทำรายการ: ${escapeXml(o.createdAtFormatted)}
        </div>
        <ul style="margin:0 0 0.65rem; padding-inline-start:1.2rem; font-size:0.85rem; ${isDeleted ? 'opacity:0.72;' : ''}">
          ${itemsList}
        </ul>
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; font-size:0.9rem; padding-block-start:0.5rem; border-block-start:1px solid var(--border-subtle);">
          <span>รวมมัดจำแผ่น: <strong style="color:#fcd34d;">${formatTHB(o.depositSubtotal)}</strong> • ค่าจัดส่ง: <strong style="color:#38bdf8;">${Number(o.shippingFee || 0) === 0 ? 'ส่งฟรี' : formatTHB(o.shippingFee)}</strong></span>
          <strong style="color:${isDeleted ? '#fda4af' : '#34d399'}; font-size:1.05rem;">ยอดสุทธิ: ${formatTHB(o.grandTotal)}</strong>
        </div>
        ${footerActionsHtml}
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-ack-deleted-order]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-ack-deleted-order');
      const ord = state.orders.find((o) => o.id === id);
      if (ord) {
        ord.permanentlyErased = true;
        ord.updatedAtMs = Date.now();
        await saveOrderToCloud(ord);
        await deleteOrderFromCloud(id);
      }
      state.orders = state.orders.filter((o) => o.id !== id);
      saveStateLocally();
      const remaining = visibleOrders.filter((o) => o.id !== id);
      renderOrderLookupList(remaining, false, false, searchQuery, isMyOrders);
      showToast('🗑️ ลบรายการออกจากประวัติคำสั่งซื้อเรียบร้อยแล้ว');
    });
  });

  container.querySelectorAll('[data-view-contract]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-view-contract');
      const unmasked = btn.getAttribute('data-unmasked') === 'true';
      const ord = visibleOrders.find((o) => o.id === id) || state.orders.find((o) => o.id === id);
      if (ord) openOrderContractModal(ord, { unmasked, isDraft: false });
    });
  });

  container.querySelectorAll('[data-print-contract]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-print-contract');
      const unmasked = btn.getAttribute('data-unmasked') === 'true';
      const ord = visibleOrders.find((o) => o.id === id) || state.orders.find((o) => o.id === id);
      if (ord) {
        openOrderContractModal(ord, { unmasked, isDraft: false });
        setTimeout(() => printActiveContract(), 150);
      }
    });
  });

  container.querySelectorAll('[data-lookup-esp32-order]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-lookup-esp32-order') || '';
      document.getElementById('dialog-order-lookup')?.close();
      openHomeConsoleModal('meter', id);
    });
  });
}

// ============================================================================
// Automatic Electronic Rental & Sales Contract Engine
// ============================================================================
function getContractMetadata(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const hasRent = items.some((i) => i.mode === 'rent');
  const hasHomeInstall = items.some((i) => i.mode === 'home_install');
  const hasBuy = items.some((i) => i.mode === 'buy' || (!i.mode && i.mode !== 'rent' && i.mode !== 'home_install'));
  const contractNo = order?.contractNo || ('CTR-' + (order?.id || 'DRAFT'));

  let title = 'หนังสือสัญญาซื้อขายสินค้าและใบสำคัญรับเงินอิเล็กทรอนิกส์';
  let subtitle = 'Electronic Sales Agreement & Official Payment Receipt';
  let shortLabel = 'สัญญาซื้อขายสินค้า';
  let typeBadge = 'สัญญาซื้อขายสินค้า (Sales Agreement)';

  if (hasHomeInstall && (hasRent || hasBuy)) {
    title = 'หนังสือสัญญาเช่าเครื่องคอนโซลติดตั้งที่บ้าน (รายชั่วโมง ESP32) และสัญญาเช่า/ซื้อขายอิเล็กทรอนิกส์';
    subtitle = 'Electronic Home Console Installation (ESP32 Hourly Meter) & Rental/Sales Agreement';
    shortLabel = 'สัญญาเช่าเครื่องติดบ้านและซื้อ/เช่า';
    typeBadge = 'สัญญาเช่าเครื่องติดบ้าน (ESP32) + ซื้อ/เช่า';
  } else if (hasHomeInstall) {
    title = 'หนังสือสัญญาเช่าเครื่องเกมคอนโซลติดตั้งที่บ้านและคิดค่าบริการรายชั่วโมงตามจริง (ESP32 Real-time)';
    subtitle = 'Electronic Home Console Installation & Postpaid Hourly Meter Agreement';
    shortLabel = 'สัญญาเช่าเครื่องติดตั้งที่บ้าน';
    typeBadge = 'สัญญาเช่าคอนโซลติดตั้งที่บ้าน (ESP32 Hourly Meter)';
  } else if (hasRent && hasBuy) {
    title = 'หนังสือสัญญาเช่าแผ่นเกมรายวันและสัญญาซื้อขายสินค้าอิเล็กทรอนิกส์';
    subtitle = 'Electronic Game Disc Rental & Merchandise Sales Agreement';
    shortLabel = 'สัญญาเช่าและซื้อขาย';
    typeBadge = 'สัญญาเช่าแผ่นเกม + ซื้อขายสินค้า';
  } else if (hasRent) {
    title = 'หนังสือสัญญาเช่าแผ่นเกมรายวันอิเล็กทรอนิกส์';
    subtitle = 'Electronic Game Disc Daily Rental & Deposit Agreement';
    shortLabel = 'สัญญาเช่าแผ่นเกม';
    typeBadge = 'สัญญาเช่าแผ่นเกมรายวัน (Rental Agreement)';
  }

  return { contractNo, hasRent, hasHomeInstall, hasBuy, title, subtitle, shortLabel, typeBadge };
}

function buildOrderContractHtml(order, options = { unmasked: true, isDraft: false }) {
  const unmasked = options.unmasked !== false;
  const isDraft = Boolean(options.isDraft);
  const meta = getContractMetadata(order);

  const rawName = order?.customer?.name || 'ลูกค้าผู้สั่งซื้อ (ระบุชื่อในฟอร์มชำระเงิน)';
  const rawPhone = order?.customer?.phone || '-';
  const rawLine = order?.customer?.lineId || '-';
  const rawEmail = order?.customer?.email || order?.customerEmail || '-';
  const rawAddress = order?.customer?.address || '-';

  const custName = unmasked ? rawName : maskCustomerName(rawName);
  const custPhone = unmasked ? rawPhone : maskPhone(rawPhone);
  const custLine = unmasked ? rawLine : (rawLine !== '-' ? rawLine.slice(0, 2) + '***' : '-');
  const custAddress = unmasked ? rawAddress : 'ปกปิดที่อยู่ตามนโยบายคุ้มครองข้อมูลส่วนบุคคล (PDPA)';

  const items = Array.isArray(order?.items) ? order.items : [];
  const rowsHtml = items.map((item, idx) => {
    const isRent = item.mode === 'rent';
    const isHomeInstall = item.mode === 'home_install';
    const typeText = isRent
      ? `<strong style="color:#6d28d9;">💿 เช่ารายวัน (${Number(item.rentDays || 1)} วัน)</strong>`
      : isHomeInstall
        ? `<strong style="color:#059669;">🏠 เช่าเครื่องติดบ้าน (ESP32)</strong>`
        : `<strong style="color:#0369a1;">🛒 ซื้อขาด</strong>`;
    const periodText = isRent
      ? `เริ่มเช่า: ${formatThaiDate(item.rentStartDate)}<br><strong>กำหนดส่งคืน: ${formatThaiDate(item.rentEndDate)}</strong>`
      : isHomeInstall
        ? `ติดตั้งที่บ้านลูกค้า<br><strong>คิดตามจริง ${formatTHB(item.hourlyRate || 0)}/ชม.</strong><br><span style="font-size:0.74rem; color:#0284c7;">บอร์ด: ${escapeXml(item.esp32DeviceId || 'ESP32')}</span>`
        : `โอนกรรมสิทธิ์ถาวร`;
    const amountText = isRent
      ? `${formatTHB(Number(item.rentRate || 0) * Number(item.rentDays || 1) * Number(item.qty || 1))}<br><span style="font-size:0.75rem; color:#64748b;">(${formatTHB(item.rentRate)}/วัน × ${item.rentDays} วัน)</span>`
      : isHomeInstall
        ? `${formatTHB(Number(item.installFee || 0) * Number(item.qty || 1))}<br><span style="font-size:0.75rem; color:#059669;">(ค่าติดตั้ง • รายชั่วโมงคิดตามจริง)</span>`
        : `${formatTHB(Number(item.price || 0) * Number(item.qty || 1))}`;
    const depositText = isRent
      ? `<strong>${formatTHB(Number(item.deposit || 0) * Number(item.qty || 1))}</strong><br><span style="font-size:0.74rem; color:#059669;">(ได้รับคืน 100%)</span>`
      : isHomeInstall
        ? `<span style="font-size:0.75rem; color:#0284c7;">นับเวลา Real-time</span>`
        : `-`;

    const unitShip = getCartItemShippingFeePerUnit(item, true);
    const shipBadge = isHomeInstall ? 'ติดตั้งถึงบ้าน' : (unitShip === 0 ? 'ส่งฟรี' : `${formatTHB(unitShip)} (ยึดค่าส่งสูงสุดในออเดอร์)`);

    return `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td>
          <strong>${escapeXml(item.name)}</strong><br>
          <span style="font-size:0.76rem; color:#475569;">แพลตฟอร์ม: ${escapeXml(item.platform || '-')} • 🚚 ค่าส่ง: ${escapeXml(shipBadge)}</span>
        </td>
        <td>${typeText}</td>
        <td style="text-align:center;">${Number(item.qty || 1)}</td>
        <td>${periodText}</td>
        <td style="text-align:end;">${amountText}</td>
        <td style="text-align:end;">${depositText}</td>
      </tr>
    `;
  }).join('');

  let nextClauseNum = 2;
  const computedInstallTotal = Number(order?.installSubtotal ?? items.reduce((sum, i) => (
    i.mode === 'home_install' ? sum + (Number(i.installFee || 0) * Number(i.qty || 1)) : sum
  ), 0));

  const homeInstallClauseTitleNum = meta.hasHomeInstall ? `ข้อที่ ${nextClauseNum++}` : '';
  const rentClauseTitleNum = meta.hasRent ? `ข้อที่ ${nextClauseNum++}` : '';
  const salesClauseNum = `ข้อที่ ${nextClauseNum++}`;
  const sigClauseNum = `ข้อที่ ${nextClauseNum}`;

  const homeInstallClausesHtml = meta.hasHomeInstall
    ? `
      <div class="contract-section-title">${homeInstallClauseTitleNum}: ข้อตกลงการเช่าเครื่องคอนโซลติดตั้งที่บ้านและคิดค่าบริการรายชั่วโมงตามจริงผ่านระบบ ESP32 (Postpaid Hourly Meter)</div>
      <ol class="contract-clauses">
        <li><strong>กรรมสิทธิ์และการติดตั้งเครื่องที่บ้าน:</strong> เครื่องเกมคอนโซล อุปกรณ์เสริม และสมาร์ทบอร์ด <strong>ESP32</strong> ที่นำไปติดตั้ง ณ ที่พักอาศัยของผู้เช่า ถือเป็นกรรมสิทธิ์ของ <strong>ร้าน TakeIT Gaming &amp; Console</strong> ตลอดอายุสัญญา โดยผู้เช่าได้ชำระค่าบริการติดตั้งเครื่องเริ่มต้นจำนวน <strong>${formatTHB(computedInstallTotal)}</strong> เรียบร้อยแล้ว</li>
        <li><strong>การนับชั่วโมงใช้งานจริงแบบ Real-time และการชำระเงินรายวัน (Postpaid Daily Billing):</strong> คู่สัญญาตกลงให้ใช้ข้อมูลเวลาเปิดใช้งานเครื่องจากสมาร์ทบอร์ด <strong>ESP32</strong> ที่เชื่อมต่อกับตัวเครื่องคอนโซลเป็นเกณฑ์ในการคำนวณค่าเช่ารายชั่วโมงตามอัตราที่ระบุไว้ในตารางข้อที่ 1 โดยผู้เช่าสามารถตรวจสอบชั่วโมงใช้งานและยอดเงินสะสมของเครื่องตนเองได้แบบเรียลไทม์ผ่านเว็บไซต์ของร้าน และตกลงชำระค่าบริการรายชั่วโมง<strong>แบบวันต่อวัน โดยทางร้านจะติดต่อไปเก็บค่าบริการจากผู้เช่าในช่วงเวลาประมาณ 20.00 น. ของทุกวัน</strong> (หรือเมื่อสิ้นสุดการเช่า) ตามจำนวนชั่วโมงและนาทีที่ใช้งานจริงในรอบวันนั้นๆ</li>
        <li><strong>การแจ้งขอคืนเครื่องคอนโซลโดยลูกค้า:</strong> <strong>หากลูกค้ามีความประสงค์จะขอคืนเครื่องคอนโซล ให้ติดต่อแจ้งมายังทางร้านผ่านเบอร์โทรศัพท์ <span style="color:#0284c7;">0826716780</span></strong> เพื่อนัดหมายวัน-เวลาในการเข้ารับเครื่องคืนและสรุปยอดค่าบริการรายชั่วโมงสะสมตามจริง</li>
        <li><strong style="color:#b91c1c;">เงื่อนไขกรณีทางร้านขอคืนเครื่องคอนโซล (แจ้งเหตุผลล่วงหน้าและรับคืนที่บ้านฟรี):</strong> <strong>หากทางร้านมีความจำเป็นต้องขอคืนเครื่องคอนโซล ผู้เช่าจะต้องส่งมอบเครื่องคืนให้แก่ทางร้าน โดยทางร้านจะเดินทางไปรับเครื่องคืนถึงบ้านลูกค้าโดยไม่เสียค่าบริการใดๆ ทั้งสิ้น</strong> ทั้งนี้ การขอคืนเครื่องจะมีเหตุผลอันสมควร โดย<strong>ทางร้านจะติดต่อหาลูกค้าเพื่อแจ้งให้ทราบล่วงหน้าว่าจะขอคืนตัวคอนโซล พร้อมอธิบายเหตุผลให้ลูกค้าทราบอย่างชัดเจน</strong> รวมถึงกรณีที่ลูกค้านำเครื่องไปใช้เช่ารายชั่วโมงแล้วหยุดใช้เครื่องติดต่อกันเป็นเวลาเกิน 2 วัน (48 ชั่วโมง) ทางร้านขอติดต่อนำเครื่องคืนเพื่อไม่ให้เสียโอกาสของลูกค้าคนอื่นที่รอเครื่อง โดยอ้างอิงจากเวลาเปิดใช้งานล่าสุด (Last Active) ในระบบสมาร์ทบอร์ด ESP32 และผู้เช่าตกลงให้ความร่วมมือในการส่งมอบเครื่องคืนพร้อมชำระค่าบริการรายชั่วโมงสะสมตามจริง</li>
        <li><strong>การห้ามดัดแปลงหรือถอดอุปกรณ์วัดเวลา (ESP32 Tamper Policy):</strong> ผู้เช่าตกลงจะไม่แกะ ถอด ดัดแปลง หรือรบกวนการทำงานของบอร์ด ESP32 และสายสัญญาณที่เชื่อมต่อกับเครื่องคอนโซล รวมถึงดูแลรักษาเครื่องคอนโซลให้อยู่ในสภาพปกติ</li>
      </ol>
    `
    : '';

  const rentalClausesHtml = meta.hasRent
    ? `
      <div class="contract-section-title">${rentClauseTitleNum}: ข้อตกลงและเงื่อนไขการเช่าแผ่นเกมรายวัน (Rental Terms &amp; Conditions)</div>
      <ol class="contract-clauses">
        <li><strong>กรรมสิทธิ์ในทรัพย์สินที่เช่า:</strong> แผ่นเกมคอนโซลและกล่องบรรจุภัณฑ์ตามรายการเช่า ถือเป็นกรรมสิทธิ์ของ <strong>ร้าน TakeIT Gaming &amp; Console (ผู้ให้เช่า)</strong> ตลอดอายุสัญญา ผู้เช่ามีสิทธิ์ครอบครองเพื่อใช้เล่นเกมตามจำนวนวันที่ตกลงไว้เท่านั้น ห้ามนำไปจำหน่ายต่อ จำนำ ให้เช่าช่วง หรือดัดแปลงแก้ไขโดยเด็ดขาด</li>
        <li><strong>การดูแลรักษาสภาพแผ่นเกม:</strong> ผู้เช่าตกลงจะดูแลรักษาแผ่นเกมและกล่องให้อยู่ในสภาพเรียบร้อย ไม่ให้เกิดรอยขีดข่วนลึก ไม่แตกร้าว ไม่บิดงอ และไม่ถูกความชื้นหรือความร้อนสูง</li>
        <li><strong>กำหนดการส่งคืนและสิทธิ์ส่งคืนฟรี:</strong> ผู้เช่าต้องดำเนินการจัดส่งแผ่นเกมคืนให้แก่ผู้ให้เช่าภายใน <strong>วันครบกำหนดส่งคืน</strong> ที่ระบุไว้ในตารางข้อที่ 1 โดย <strong>ทางร้าน TakeIT เป็นผู้รับผิดชอบออกค่าใช้จ่ายในการจัดส่งพัสดุขากลับให้แก่ผู้เช่าทั้งหมด</strong></li>
        <li><strong>การคืนเงินประกัน/ค่ามัดจำแผ่นเกม (100% Deposit Refund):</strong> เมื่อผู้ให้เช่าได้รับแผ่นเกมคืนและตรวจสอบแล้วว่าแผ่นเกมอยู่ในสภาพปกติ สามารถอ่านข้อมูลและใช้งานได้สมบูรณ์ ผู้ให้เช่าตกลงโอนเงินค่ามัดจำแผ่นเกมจำนวน <strong>${formatTHB(order?.depositSubtotal || 0)}</strong> คืนให้แก่ผู้เช่าเต็มจำนวน 100% ภายใน 24 ชั่วโมง</li>
        <li><strong>กรณีส่งคืนล่าช้าหรือทรัพย์สินเสียหาย:</strong> หากผู้เช่ามีความประสงค์จะเช่าต่อ ต้องแจ้งผู้ให้เช่าล่วงหน้าก่อนครบกำหนด หากส่งคืนล่าช้าโดยไม่แจ้งล่วงหน้า ผู้เช่ายินยอมให้คิดค่าเช่าเพิ่มตามจำนวนวันที่ล่าช้าตามอัตราเช่ารายวันจริงโดยหักจากเงินมัดจำ และหากแผ่นเกมสูญหายหรือเสียหายจนไม่สามารถใช้งานได้ ผู้เช่ายินยอมให้ริบเงินมัดจำและชดใช้ตามมูลค่าสินค้าจริง</li>
      </ol>
    `
    : '';

  return `
    <div class="contract-paper" id="printable-contract-paper">
      <div class="contract-doc-header">
        <div class="contract-doc-badge">
          ${isDraft ? '📝 ร่างสัญญาตัวอย่างก่อนยืนยันคำสั่งซื้อ (DRAFT PREVIEW)' : 'TAKEIT GAMING & CONSOLE • OFFICIAL E-CONTRACT'}
        </div>
        <h3 class="contract-doc-title">${escapeXml(meta.title)}</h3>
        <p class="contract-doc-subtitle">${escapeXml(meta.subtitle)} • ออกโดยระบบอัตโนมัติร้าน TakeIT Gaming &amp; Console</p>
      </div>

      <div class="contract-meta-grid">
        <div>
          <strong>เลขที่สัญญา (Contract No.):</strong><br>
          <span style="color:#0284c7; font-weight:800; font-size:0.95rem;">${escapeXml(meta.contractNo)}</span>
        </div>
        <div>
          <strong>อ้างอิงคำสั่งซื้อ (Order ID):</strong><br>
          <span style="font-weight:700;">${escapeXml(order?.id || 'รอออกรหัสเมื่อกดยืนยัน')}</span>
        </div>
        <div>
          <strong>วันที่ทำสัญญา (Date &amp; Time):</strong><br>
          <span>${escapeXml(order?.createdAtFormatted || new Date().toLocaleString('th-TH'))}</span>
        </div>
        <div>
          <strong>สถานะสัญญา (Status):</strong><br>
          <span style="color:#059669; font-weight:700;">${isDraft ? 'ร่างสัญญา (รอยืนยันคำสั่งซื้อ)' : escapeXml(order?.status || 'มีผลผูกพันสมบูรณ์')}</span>
        </div>
      </div>

      <div class="contract-parties-grid">
        <div class="contract-party-card">
          <h4>🏢 ฝ่ายที่ 1: ผู้ให้เช่า / ผู้ขาย (ร้านค้า)</h4>
          <div><strong>ชื่อร้านค้า:</strong> ร้าน TakeIT Gaming &amp; Console</div>
          <div><strong>ผู้แทน / บัญชีรับชำระ:</strong> ${escapeXml(state.settings.bankInfo || DEFAULT_SETTINGS.bankInfo)}</div>
          <div><strong>อ้างอิงการรับชำระ:</strong> ${escapeXml(state.settings.promptPayId || DEFAULT_SETTINGS.promptPayId)}</div>
          <div><strong>เบอร์โทรติดต่อ / แจ้งคืนเครื่อง:</strong> 0826716780</div>
          <div><strong>เว็บไซต์ทางการ:</strong> https://vidergroup124.github.io/takeit/</div>
        </div>

        <div class="contract-party-card">
          <h4>👤 ฝ่ายที่ 2: ผู้เช่า / ผู้ซื้อ (ลูกค้า)</h4>
          <div><strong>ชื่อ-นามสกุล:</strong> ${escapeXml(custName)}</div>
          <div><strong>เบอร์โทรศัพท์ติดต่อ:</strong> ${escapeXml(custPhone)}</div>
          <div><strong>LINE ID / อีเมล:</strong> ${escapeXml(custLine)}${rawEmail !== '-' ? ` (${escapeXml(rawEmail)})` : ''}</div>
          <div><strong>ที่อยู่จัดส่งและรับ-คืนสินค้า:</strong> ${escapeXml(custAddress)}</div>
        </div>
      </div>

      <div class="contract-section-title">ข้อที่ 1: รายการทรัพย์สินที่ตกลงเช่า / ซื้อขาย และสรุปยอดชำระเงิน</div>
      <table class="contract-items-table">
        <thead>
          <tr>
            <th style="inline-size:44px; text-align:center;">ลำดับ</th>
            <th>รายการสินค้า / แผ่นเกม</th>
            <th style="inline-size:125px;">ประเภทธุรกรรม</th>
            <th style="inline-size:55px; text-align:center;">จำนวน</th>
            <th style="inline-size:165px;">ระยะเวลาเช่า / กำหนดคืน</th>
            <th style="inline-size:115px; text-align:end;">ค่าเช่า / ราคาซื้อ</th>
            <th style="inline-size:110px; text-align:end;">เงินมัดจำแผ่น</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:0.75rem 1rem; margin-block-end:1rem; display:flex; justify-content:space-between; flex-wrap:wrap; gap:0.75rem; font-size:0.84rem;">
        <div>
          รวมค่าซื้อสินค้าขาด: <strong>${formatTHB(order?.buySubtotal || 0)}</strong> |
          ${Number(order?.installSubtotal || 0) > 0 ? `รวมค่าติดตั้งเครื่องที่บ้าน: <strong style="color:#059669;">${formatTHB(order?.installSubtotal || 0)}</strong> | ` : ''}
          รวมค่าเช่าแผ่นเกม: <strong>${formatTHB(order?.rentSubtotal || 0)}</strong> |
          รวมเงินมัดจำแผ่น (ได้รับคืน 100%): <strong style="color:#0284c7;">${formatTHB(order?.depositSubtotal || 0)}</strong> |
          ค่าจัดส่งรวมตามรายการสินค้า: <strong>${Number(order?.shippingFee ?? 0) === 0 ? 'ส่งฟรี (฿0)' : formatTHB(order?.shippingFee ?? 0)}</strong>
        </div>
        <div style="font-size:0.98rem; font-weight:800; color:#059669;">
          รวมยอดชำระสุทธิทั้งสิ้น: ${formatTHB(order?.grandTotal || 0)}
        </div>
      </div>

      ${homeInstallClausesHtml}
      ${rentalClausesHtml}

      <div class="contract-section-title">${salesClauseNum}: ข้อตกลงการซื้อขาย การจัดส่ง และการรับประกันสินค้า</div>
      <ol class="contract-clauses">
        <li>สำหรับรายการสินค้าประเภท <strong>ซื้อขาด</strong> กรรมสิทธิ์ในสินค้าจะโอนไปยังผู้ซื้อเมื่อผู้ขายได้รับชำระเงินครบถ้วนและตรวจสอบหลักฐานการโอนเงินถูกต้องแล้ว</li>
        <li>ผู้ขายรับประกันว่าสินค้าและแผ่นเกมทุกรายการเป็นของแท้ และผ่านการตรวจสอบคุณภาพพร้อมบรรจุกันกระแทกอย่างดีก่อนจัดส่งให้แก่ลูกค้า</li>
        <li>คู่สัญญาทั้งสองฝ่ายตกลงให้เอกสารสัญญาอิเล็กทรอนิกส์ฉบับนี้ ซึ่งสร้างขึ้นโดยอัตโนมัติตามคำสั่งซื้อรหัส <strong>${escapeXml(order?.id || 'DRAFT')}</strong> มีผลผูกพันตามกฎหมายว่าด้วยธุรกรรมทางอิเล็กทรอนิกส์ทุกประการ</li>
      </ol>

      <div class="contract-section-title">${sigClauseNum}: การลงลายมือชื่ออิเล็กทรอนิกส์ของคู่สัญญา (Electronic Signatures)</div>
      <div class="contract-signatures-grid">
        <div class="contract-sig-box">
          <div style="font-weight:700; color:#0f172a;">ลงชื่อ ผู้เช่า / ผู้ซื้อ (Customer)</div>
          <div class="contract-sig-name">${escapeXml(custName)}</div>
          <div style="color:#475569;">(${escapeXml(custName)})</div>
          <div style="font-size:0.75rem; color:#059669; margin-block-start:0.25rem;">
            ✅ ยืนยันทำสัญญาทางอิเล็กทรอนิกส์เมื่อ ${escapeXml(order?.createdAtFormatted || new Date().toLocaleString('th-TH'))}
          </div>
        </div>

        <div class="contract-sig-box">
          <div style="font-weight:700; color:#0f172a;">ลงชื่อ ผู้ให้เช่า / ผู้ขาย (Store Official)</div>
          <div class="contract-official-stamp">TAKEIT GAMING &amp; CONSOLE VERIFIED</div>
          <div style="color:#0f172a; font-weight:700;">นาย ภาณุเดช พุทธบัวงาม</div>
          <div style="font-size:0.75rem; color:#475569;">ผู้มีอำนาจลงนาม • ร้าน TakeIT Gaming &amp; Console</div>
        </div>
      </div>
    </div>
  `;
}

function buildOrderContractPlainText(order, unmasked = true) {
  const meta = getContractMetadata(order);
  const custName = unmasked ? (order?.customer?.name || '-') : maskCustomerName(order?.customer?.name);
  const custPhone = unmasked ? (order?.customer?.phone || '-') : maskPhone(order?.customer?.phone);
  const custAddress = unmasked ? (order?.customer?.address || '-') : 'ปกปิดตาม PDPA';

  const itemLines = (order?.items || []).map((item, idx) => {
    const unitShip = getCartItemShippingFeePerUnit(item, true);
    const shipStr = unitShip === 0 ? 'ส่งฟรี' : `${formatTHB(unitShip)} (คิดค่าส่งครั้งเดียวตามชิ้นที่แพงสุด)`;
    if (item.mode === 'rent') {
      return `${idx + 1}. [เช่าแผ่น ${item.rentDays} วัน] ${item.name} (${item.platform}) x${item.qty} | ค่าเช่า ${formatTHB(item.rentRate * item.rentDays * item.qty)} + มัดจำแผ่น ${formatTHB(item.deposit * item.qty)} + ค่าส่ง ${shipStr} | เริ่มเช่า: ${formatThaiDate(item.rentStartDate)} -> กำหนดส่งคืน: ${formatThaiDate(item.rentEndDate)}`;
    }
    if (item.mode === 'home_install') {
      return `${idx + 1}. [เช่าเครื่องติดตั้งที่บ้าน + บอร์ด ESP32] ${item.name} (${item.platform}) x${item.qty} | ค่าติดตั้ง ${formatTHB((item.installFee || 0) * item.qty)} | เรทรายชั่วโมง ${formatTHB(item.hourlyRate || 0)}/ชม. (คิดตามจริงผ่านบอร์ด ${item.esp32DeviceId || 'ESP32'})`;
    }
    return `${idx + 1}. [ซื้อขาด] ${item.name} (${item.platform}) x${item.qty} | ราคา ${formatTHB(item.price * item.qty)} + ค่าส่ง ${shipStr}`;
  }).join('\n');

  return [
    `📜 ${meta.title}`,
    `ร้าน TakeIT Gaming & Console (https://vidergroup124.github.io/takeit/)`,
    `================================================`,
    `เลขที่สัญญา: ${meta.contractNo}`,
    `อ้างอิงรหัสคำสั่งซื้อ: ${order?.id || 'DRAFT'}`,
    `วันที่ทำสัญญา: ${order?.createdAtFormatted || new Date().toLocaleString('th-TH')}`,
    `ผู้ให้เช่า/ร้านค้า: ร้าน TakeIT Gaming & Console (โทรติดต่อ/แจ้งคืนเครื่อง: 0826716780)`,
    `ผู้เช่า/ผู้ซื้อ: ${custName} (โทร: ${custPhone})`,
    `ที่อยู่จัดส่ง: ${custAddress}`,
    `------------------------------------------------`,
    `รายการสินค้า/แผ่นเกมตามสัญญา:`,
    itemLines,
    `------------------------------------------------`,
    `รวมค่าซื้อสินค้า: ${formatTHB(order?.buySubtotal || 0)}`,
    ...(Number(order?.installSubtotal || 0) > 0 ? [`รวมค่าติดตั้งเครื่องคอนโซลที่บ้าน: ${formatTHB(order?.installSubtotal || 0)}`] : []),
    `รวมค่าเช่าแผ่นเกม: ${formatTHB(order?.rentSubtotal || 0)}`,
    `รวมเงินมัดจำแผ่นเกม (ได้รับคืน 100% เมื่อคืนแผ่นปกติ): ${formatTHB(order?.depositSubtotal || 0)}`,
    `ค่าจัดส่งรวมตามรายการสินค้า: ${formatTHB(order?.shippingFee ?? 0)}`,
    `รวมยอดชำระสุทธิทั้งสิ้น: ${formatTHB(order?.grandTotal || 0)}`,
    `------------------------------------------------`,
    ...(meta.hasHomeInstall ? [
      `เงื่อนไขการเช่าเครื่องติดบ้านรายชั่วโมง (ESP32): คิดค่ารายชั่วโมงตามเวลาเปิดเครื่องจริงแบบวันต่อวัน (Postpaid) โดยทางร้านจะติดต่อไปแจ้งยอดและเก็บค่าเช่ารายชั่วโมงในช่วงเวลาประมาณ 20.00 น. ของทุกวัน`,
      `- การขอคืนเครื่องโดยลูกค้า: หากลูกค้าต้องการขอคืนเครื่องคอนโซล ให้ติดต่อมาทางเบอร์โทรศัพท์ 0826716780`,
      `- การขอคืนเครื่องโดยทางร้าน: หากทางร้านขอคืนเครื่อง ลูกค้าจะต้องคืนเครื่องให้แก่ทางร้าน โดยทางร้านจะเดินทางไปรับคืนที่บ้านลูกค้าโดยไม่เสียค่าบริการใดๆ ทั้งนี้ การขอคืนเครื่องจะมีเหตุผล โดยทางร้านจะติดต่อแจ้งลูกค้าล่วงหน้าพร้อมอธิบายเหตุผลให้ทราบอย่างชัดเจน (รวมถึงกรณีหยุดใช้งานเครื่องเกิน 2 วัน หรือ 48 ชั่วโมง ทางร้านขอติดต่อนำเครื่องคืนเพื่อไม่ให้เสียโอกาสของลูกค้าท่านอื่นที่รอเครื่อง)`
    ] : []),
    `เงื่อนไขสำคัญ: ทางร้านออกค่าส่งแผ่นขากลับให้ฟรี และโอนคืนเงินมัดจำเต็มจำนวน 100% ภายใน 24 ชม. หลังได้รับแผ่นคืนในสภาพปกติ`,
    `ลงชื่ออิเล็กทรอนิกส์ผู้เช่า/ผู้ซื้อ: ${custName}`,
    `ลงชื่อผู้ให้เช่า/ผู้ขาย: ร้าน TakeIT Gaming & Console (นาย ภาณุเดช พุทธบัวงาม)`
  ].join('\n');
}

function openOrderContractModal(order, options = { unmasked: true, isDraft: false }) {
  if (!order) return;
  state.activeContractOrder = order;
  state.activeContractOptions = options;

  const meta = getContractMetadata(order);
  const titleEl = document.getElementById('contract-dialog-title');
  const bodyEl = document.getElementById('contract-dialog-body');
  const dlg = document.getElementById('dialog-contract');
  if (!bodyEl || !dlg) return;

  if (titleEl) {
    titleEl.textContent = `📜 ${meta.shortLabel} (${meta.contractNo})`;
  }
  bodyEl.innerHTML = buildOrderContractHtml(order, options);
  dlg.showModal();
}

function openDraftContractFromCart() {
  if (state.cart.length === 0) {
    showToast('กรุณาเลือกสินค้าหรือแผ่นเกมเข้าตะกร้าก่อนดูตัวอย่างสัญญาครับ', 'warning');
    return;
  }
  const totals = calculateCartTotals();
  const now = new Date();
  const draftOrder = {
    id: 'DRAFT-PREVIEW',
    contractNo: 'CTR-DRAFT-' + now.toISOString().slice(2, 10).replace(/-/g, ''),
    createdAt: now.toISOString(),
    createdAtFormatted: now.toLocaleString('th-TH'),
    customer: {
      name: document.getElementById('cust-name')?.value.trim() || state.currentUser?.displayName || 'ระบุชื่อ-นามสกุลผู้ทำสัญญาในหน้าชำระเงิน',
      phone: document.getElementById('cust-phone')?.value.trim() || 'ระบุเบอร์โทรศัพท์ในหน้าชำระเงิน',
      lineId: document.getElementById('cust-line')?.value.trim() || '-',
      address: document.getElementById('cust-address')?.value.trim() || 'ระบุที่อยู่จัดส่งในหน้าชำระเงิน',
      email: state.currentUser?.email || ''
    },
    items: [...state.cart],
    buySubtotal: totals.buySubtotal,
    installSubtotal: totals.installSubtotal,
    rentSubtotal: totals.rentSubtotal,
    depositSubtotal: totals.depositSubtotal,
    shippingFee: totals.shippingFee,
    grandTotal: totals.grandTotal,
    status: 'ร่างสัญญาตัวอย่างก่อนยืนยันคำสั่งซื้อ'
  };
  openOrderContractModal(draftOrder, { unmasked: true, isDraft: true });
}

function buildStandaloneContractDocumentHtml(order, options = { unmasked: true, isDraft: false }) {
  const meta = getContractMetadata(order);
  const contractBodyHtml = buildOrderContractHtml(order, options);
  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeXml(meta.title)} - ${escapeXml(meta.contractNo)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 20px;
      background: #f1f5f9;
      color: #0f172a;
      font-family: 'Prompt', sans-serif;
    }
    .contract-paper {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      color: #0f172a;
      padding: 28px 32px;
      border-radius: 12px;
      border: 2px solid #cbd5e1;
      line-height: 1.6;
      font-size: 13.5px;
    }
    .contract-doc-header {
      text-align: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .contract-doc-badge {
      display: inline-block;
      background: #0f172a;
      color: #38bdf8;
      font-weight: 800;
      font-size: 11px;
      padding: 3px 12px;
      border-radius: 999px;
      margin-bottom: 6px;
    }
    .contract-doc-title { margin: 0 0 4px; font-size: 19px; font-weight: 800; }
    .contract-doc-subtitle { margin: 0; font-size: 12px; color: #475569; }
    .contract-meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 14px;
      font-size: 12.5px;
    }
    .contract-parties-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 14px;
    }
    .contract-party-card {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 12.5px;
    }
    .contract-party-card h4 {
      margin: 0 0 6px;
      font-size: 13.5px;
      border-bottom: 1px dashed #cbd5e1;
      padding-bottom: 4px;
    }
    .contract-section-title {
      margin: 14px 0 8px;
      font-size: 13.5px;
      font-weight: 800;
      background: #f1f5f9;
      padding: 5px 10px;
      border-left: 4px solid #0284c7;
    }
    .contract-items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-bottom: 10px;
    }
    .contract-items-table th, .contract-items-table td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }
    .contract-items-table thead th {
      background: #0f172a;
      color: #ffffff;
    }
    .contract-clauses {
      margin: 0 0 12px;
      padding-left: 18px;
      font-size: 12px;
    }
    .contract-clauses li { margin-bottom: 4px; }
    .contract-signatures-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-top: 16px;
      padding-top: 12px;
      border-top: 2px dashed #cbd5e1;
    }
    .contract-sig-box {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px;
      text-align: center;
      background: #f8fafc;
      font-size: 12px;
    }
    .contract-sig-name {
      font-size: 15px;
      font-weight: 800;
      color: #0284c7;
      padding: 4px 10px;
      margin: 4px auto;
      display: inline-block;
      border-bottom: 2px solid #94a3b8;
    }
    .contract-official-stamp {
      display: inline-block;
      border: 2px solid #0284c7;
      color: #0284c7;
      padding: 3px 10px;
      border-radius: 6px;
      font-weight: 800;
      font-size: 11px;
      margin: 4px 0;
    }
    @media print {
      body { background: #ffffff; padding: 0; }
      .contract-paper { border: none; padding: 0; max-width: 100%; }
    }
  </style>
</head>
<body>
  ${contractBodyHtml}
</body>
</html>`;
}

function printActiveContract() {
  const order = state.activeContractOrder;
  if (!order) return;
  const fullHtml = buildStandaloneContractDocumentHtml(order, state.activeContractOptions || { unmasked: true });
  const printWin = window.open('', '_blank', 'width=900,height=800');
  if (printWin) {
    printWin.document.open();
    printWin.document.write(fullHtml);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
    }, 350);
  } else {
    window.print();
  }
}

function downloadActiveContractHtml() {
  const order = state.activeContractOrder;
  if (!order) return;
  const meta = getContractMetadata(order);
  const fullHtml = buildStandaloneContractDocumentHtml(order, state.activeContractOptions || { unmasked: true });
  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `TakeIT-Contract-${meta.contractNo}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast(`💾 ดาวน์โหลดไฟล์สัญญา ${meta.contractNo}.html เรียบร้อยแล้ว!`);
}

async function copyActiveContractText() {
  const order = state.activeContractOrder;
  if (!order) return;
  const unmasked = state.activeContractOptions?.unmasked !== false;
  const text = buildOrderContractPlainText(order, unmasked);
  try {
    await navigator.clipboard.writeText(text);
    showToast('📋 คัดลอกข้อความสัญญาเช่า/ซื้อขายเรียบร้อยแล้ว! สามารถนำไปวางส่งในแชตได้เลย');
  } catch (err) {
    showToast('⚠️ ไม่สามารถคัดลอกอัตโนมัติได้ กรุณากดพิมพ์หรือดาวน์โหลดไฟล์แทนครับ', 'warning');
  }
}

// ============================================================================
// Customer Support & Product Wishlist Engine
// ============================================================================
async function saveSupportTicketToCloud(ticket) {
  if (state.firestoreDb && state.firebaseModules) {
    try {
      const { setDoc, doc } = state.firebaseModules;
      await setDoc(doc(state.firestoreDb, 'takeit_support', ticket.id), ticket);
    } catch (err) {
      console.warn('Firebase save support ticket error:', err);
    }
  }
}

async function deleteSupportTicketFromCloud(ticketId) {
  if (state.firestoreDb && state.firebaseModules) {
    try {
      const { deleteDoc, doc } = state.firebaseModules;
      await deleteDoc(doc(state.firestoreDb, 'takeit_support', ticketId));
    } catch (err) {
      console.warn('Firebase delete support ticket error:', err);
    }
  }
}

async function sendSupportTicketToGoogleSheet(ticket, action = 'submit_support_ticket') {
  const webhookUrl = (state.settings.sheetWebhookUrl || '').trim();
  if (!webhookUrl || !webhookUrl.startsWith('http')) return false;
  return postPayloadToGoogleSheet(webhookUrl, {
    action,
    ticket
  });
}

async function deleteSupportTicketFromGoogleSheet(ticketId) {
  const webhookUrl = (state.settings.sheetWebhookUrl || '').trim();
  if (!webhookUrl || !webhookUrl.startsWith('http')) return false;
  return postPayloadToGoogleSheet(webhookUrl, {
    action: 'delete_support_ticket',
    ticketId
  });
}

function updateSupportBadgeCount() {
  const badge = document.getElementById('admin-support-badge');
  if (!badge) return;
  const pendingCount = (state.supportTickets || []).filter(
    (t) => !t.isDeleted && (!t.status || t.status === 'pending')
  ).length;
  if (pendingCount > 0) {
    badge.textContent = String(pendingCount);
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

function openSupportModal(targetTab = 'wishlist', prefillQuery = '') {
  const dialog = document.getElementById('dialog-support-request');
  if (!dialog) return;

  // 1. Switch tabs inside dialog
  const isWishlist = targetTab !== 'issue';
  document.getElementById('btn-tab-modal-wishlist')?.classList.toggle('active', isWishlist);
  document.getElementById('btn-tab-modal-issue')?.classList.toggle('active', !isWishlist);
  const paneWishlist = document.getElementById('pane-modal-wishlist');
  const paneIssue = document.getElementById('pane-modal-issue');
  if (paneWishlist) paneWishlist.hidden = !isWishlist;
  if (paneIssue) paneIssue.hidden = isWishlist;

  // 2. Prefill customer contact from saved contact or logged-in user
  let savedContact = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SAVED_CONTACT);
    if (raw) savedContact = JSON.parse(raw);
  } catch (e) {}

  const custName = savedContact?.name || state.currentUser?.displayName || '';
  const custPhone = savedContact?.phone || '';
  const custLine = savedContact?.lineId || '';
  const custEmail = savedContact?.email || state.currentUser?.email || '';

  if (document.getElementById('req-cust-name') && !document.getElementById('req-cust-name').value) {
    document.getElementById('req-cust-name').value = custName;
  }
  if (document.getElementById('req-cust-phone') && !document.getElementById('req-cust-phone').value) {
    document.getElementById('req-cust-phone').value = custPhone;
  }
  if (document.getElementById('req-cust-line') && !document.getElementById('req-cust-line').value) {
    document.getElementById('req-cust-line').value = custLine;
  }
  if (document.getElementById('req-cust-email') && !document.getElementById('req-cust-email').value) {
    document.getElementById('req-cust-email').value = custEmail;
  }

  if (document.getElementById('issue-cust-name') && !document.getElementById('issue-cust-name').value) {
    document.getElementById('issue-cust-name').value = custName;
  }
  if (document.getElementById('issue-cust-phone') && !document.getElementById('issue-cust-phone').value) {
    document.getElementById('issue-cust-phone').value = custPhone;
  }
  if (document.getElementById('issue-cust-line') && !document.getElementById('issue-cust-line').value) {
    document.getElementById('issue-cust-line').value = custLine;
  }
  if (document.getElementById('issue-cust-email') && !document.getElementById('issue-cust-email').value) {
    document.getElementById('issue-cust-email').value = custEmail;
  }

  if (prefillQuery && document.getElementById('req-prod-name')) {
    document.getElementById('req-prod-name').value = prefillQuery;
  }

  dialog.showModal();
}

function renderAdminSupportTicketsTable() {
  const container = document.getElementById('admin-support-tickets-list');
  if (!container) return;

  const typeFilter = document.getElementById('admin-support-filter-type')?.value || 'all';
  const statusFilter = document.getElementById('admin-support-filter-status')?.value || 'all';

  let tickets = (state.supportTickets || []).filter((t) => !t.isDeleted);

  if (typeFilter !== 'all') {
    tickets = tickets.filter((t) => t.type === typeFilter);
  }
  if (statusFilter !== 'all') {
    tickets = tickets.filter((t) => (t.status || 'pending') === statusFilter);
  }

  if (tickets.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:3rem 1rem; background:rgba(15,23,42,0.4); border-radius:var(--radius-md); border:1px solid var(--border-subtle); color:var(--text-muted);">
        <div style="font-size:2.4rem; margin-block-end:0.5rem;">💬</div>
        <h3 style="margin:0 0 0.35rem; color:var(--text-secondary);">ยังไม่มีรายการแจ้งปัญหาหรือคำขอสินค้าในตัวกรองนี้</h3>
        <p style="margin:0; font-size:0.86rem;">เมื่อลูกค้าส่งความต้องการสินค้าที่ร้านไม่มี หรือแจ้งปัญหาเข้ามา จะปรากฏในหน้านี้ทันทีแบบเรียลไทม์</p>
      </div>
    `;
    return;
  }

  container.innerHTML = tickets.map((t) => {
    const isWishlist = t.type === 'wishlist';
    const typeBadge = isWishlist
      ? `<span class="badge badge-cyan" style="font-size:0.78rem;">💡 ขอสินค้าที่ร้านไม่มี</span>`
      : `<span class="badge" style="font-size:0.78rem; background:rgba(244,63,94,0.2); color:#fda4af;">⚠️ แจ้งปัญหาการใช้งาน</span>`;

    const statusVal = t.status || 'pending';
    let statusBadge = '';
    if (statusVal === 'pending') {
      statusBadge = `<span class="badge badge-amber">⏳ รอแอดมินติดต่อกลับ</span>`;
    } else if (statusVal === 'contacted') {
      statusBadge = `<span class="badge badge-cyan">📞 ติดต่อลูกค้าแล้ว</span>`;
    } else if (statusVal === 'resolved') {
      statusBadge = `<span class="badge badge-emerald">✅ ดำเนินการเสร็จสิ้น</span>`;
    } else {
      statusBadge = `<span class="badge" style="background:#334155; color:#94a3b8;">📁 ปิดเรื่อง</span>`;
    }

    const intentTag = t.intent ? `<span class="badge badge-purple" style="font-size:0.76rem;">${escapeXml(t.intent)}</span>` : '';
    const categoryTag = t.category ? `<span class="badge badge-outline" style="font-size:0.76rem;">${escapeXml(t.category)}</span>` : '';
    const orderRef = t.orderId ? `<div style="font-size:0.82rem; color:var(--accent-cyan); margin-block-end:0.4rem;">📦 รหัสคำสั่งซื้อที่เกี่ยวข้อง: <strong>${escapeXml(t.orderId)}</strong></div>` : '';

    const cleanLineId = String(t.lineId || '').trim();
    const lineLink = cleanLineId && cleanLineId !== '-'
      ? `https://line.me/ti/p/~${encodeURIComponent(cleanLineId.replace(/^@/, ''))}`
      : '';

    const imageThumb = t.screenshotDataUrl
      ? `
        <div style="margin-block:0.5rem;">
          <span style="font-size:0.78rem; color:var(--text-muted); display:block; margin-block-end:0.25rem;">📸 รูปภาพแนบ:</span>
          <img src="${t.screenshotDataUrl}" alt="รูปภาพแนบ" class="support-thumb-img" data-preview-support-img="${escapeXml(t.id)}" title="คลิกเพื่อดูรูปขนาดใหญ่">
        </div>
      `
      : '';

    return `
      <div class="support-card ${isWishlist ? 'card-type-wishlist' : 'card-type-issue'}" id="ticket-card-${escapeXml(t.id)}">
        <div class="support-card-header">
          <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            ${typeBadge}
            ${statusBadge}
            ${categoryTag}
            ${intentTag}
            <span style="font-size:0.78rem; color:var(--text-muted);">รหัส: ${escapeXml(t.id)}</span>
          </div>
          <div style="font-size:0.8rem; color:var(--text-muted);">
            🕒 ${escapeXml(t.createdAtThai || t.createdAt || '')}
          </div>
        </div>

        <div class="support-card-title">
          ${escapeXml(t.title || '')}
        </div>

        ${orderRef}

        <div class="support-card-details">${escapeXml(t.details || 'ไม่มีรายละเอียดเพิ่มเติม')}</div>

        ${imageThumb}

        <div style="margin-block:0.65rem;">
          <span style="font-size:0.8rem; color:var(--text-muted); display:block; margin-block-end:0.35rem; font-weight:600;">
            👤 ข้อมูลติดต่อลูกค้าสำหรับติดต่อกลับ:
          </span>
          <div class="contact-pill-group">
            <span class="contact-link-pill">
              👤 ${escapeXml(t.customerName || 'ไม่ระบุชื่อ')}
            </span>

            ${t.phone ? `
              <a href="tel:${escapeXml(t.phone)}" class="contact-link-pill pill-phone" title="คลิกเพื่อโทรออกหาลูกค้า">
                📞 โทร: ${escapeXml(t.phone)}
              </a>
              <button type="button" class="btn btn-outline btn-sm" style="font-size:0.75rem; padding:0.2rem 0.5rem;" data-copy-contact="${escapeXml(t.phone)}" title="คัดลอกเบอร์โทร">
                📋 คัดลอกเบอร์
              </button>
            ` : ''}

            ${cleanLineId && cleanLineId !== '-' ? `
              <a href="${lineLink}" target="_blank" rel="noopener noreferrer" class="contact-link-pill pill-line" title="คลิกเพื่อเปิดคุย LINE">
                💬 LINE: ${escapeXml(cleanLineId)}
              </a>
              <button type="button" class="btn btn-outline btn-sm" style="font-size:0.75rem; padding:0.2rem 0.5rem;" data-copy-contact="${escapeXml(cleanLineId)}" title="คัดลอก Line ID">
                📋 คัดลอก LINE
              </button>
            ` : ''}

            ${t.email && t.email.includes('@') ? `
              <a href="mailto:${escapeXml(t.email)}" class="contact-link-pill" title="ส่งอีเมล">
                ✉️ ${escapeXml(t.email)}
              </a>
            ` : ''}
          </div>
        </div>

        <div class="support-admin-bar">
          <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; flex:1;">
            <label style="font-size:0.82rem; color:var(--text-secondary); white-space:nowrap;">อัปเดตสถานะ:</label>
            <select data-ticket-status="${escapeXml(t.id)}" style="inline-size:auto; padding:0.3rem 0.6rem; font-size:0.82rem;">
              <option value="pending" ${statusVal === 'pending' ? 'selected' : ''}>⏳ รอแอดมินติดต่อกลับ</option>
              <option value="contacted" ${statusVal === 'contacted' ? 'selected' : ''}>📞 ติดต่อลูกค้าแล้ว</option>
              <option value="resolved" ${statusVal === 'resolved' ? 'selected' : ''}>✅ ดำเนินการเสร็จสิ้น</option>
              <option value="closed" ${statusVal === 'closed' ? 'selected' : ''}>📁 ปิดเรื่อง</option>
            </select>

            <input
              type="text"
              data-ticket-admin-note="${escapeXml(t.id)}"
              value="${escapeXml(t.adminNote || '')}"
              placeholder="บันทึกช่วยจำของแอดมิน (เช่น โทรแจ้งแล้ว ลูกค้าจองไว้)..."
              style="flex:1; min-inline-size:180px; padding:0.3rem 0.6rem; font-size:0.82rem;"
            >
            <button type="button" class="btn btn-outline btn-sm" data-save-ticket-note="${escapeXml(t.id)}" style="font-size:0.8rem; white-space:nowrap;">
              💾 บันทึก
            </button>
          </div>

          <button type="button" class="btn btn-danger btn-sm" data-delete-ticket="${escapeXml(t.id)}" style="font-size:0.78rem; white-space:nowrap;">
            🗑️ ลบ
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Attach dynamic event listeners on ticket cards
  container.querySelectorAll('[data-ticket-status]').forEach((sel) => {
    sel.addEventListener('change', async (e) => {
      const ticketId = sel.getAttribute('data-ticket-status');
      const newStatus = e.target.value;
      const t = state.supportTickets.find((x) => x.id === ticketId);
      if (t) {
        t.status = newStatus;
        t.updatedAtMs = Date.now();
        saveStateLocally();
        await saveSupportTicketToCloud(t);
        await sendSupportTicketToGoogleSheet(t, 'sync_support_ticket');
        updateSupportBadgeCount();
        renderAdminSupportTicketsTable();
        showToast(`🔄 อัปเดตสถานะรายการ ${ticketId} เรียบร้อยแล้ว`);
      }
    });
  });

  container.querySelectorAll('[data-save-ticket-note]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ticketId = btn.getAttribute('data-save-ticket-note');
      const noteInput = container.querySelector(`[data-ticket-admin-note="${ticketId}"]`);
      const newNote = noteInput?.value.trim() || '';
      const t = state.supportTickets.find((x) => x.id === ticketId);
      if (t) {
        t.adminNote = newNote;
        t.updatedAtMs = Date.now();
        saveStateLocally();
        await saveSupportTicketToCloud(t);
        await sendSupportTicketToGoogleSheet(t, 'sync_support_ticket');
        showToast(`💾 บันทึกโน้ตของรายการ ${ticketId} เรียบร้อยแล้ว`);
      }
    });
  });

  container.querySelectorAll('[data-delete-ticket]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ticketId = btn.getAttribute('data-delete-ticket');
      if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบรายการ ${ticketId} ออกจากระบบ?`)) return;
      const t = state.supportTickets.find((x) => x.id === ticketId);
      if (t) {
        t.isDeleted = true;
        t.updatedAtMs = Date.now();
      }
      state.supportTickets = state.supportTickets.filter((x) => x.id !== ticketId);
      saveStateLocally();
      await deleteSupportTicketFromCloud(ticketId);
      await deleteSupportTicketFromGoogleSheet(ticketId);
      updateSupportBadgeCount();
      renderAdminSupportTicketsTable();
      showToast(`🗑️ ลบรายการ ${ticketId} ออกจากระบบเรียบร้อยแล้ว`);
    });
  });

  container.querySelectorAll('[data-copy-contact]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const text = btn.getAttribute('data-copy-contact');
      try {
        await navigator.clipboard.writeText(text);
        showToast(`📋 คัดลอก "${text}" เรียบร้อยแล้ว!`);
      } catch (e) {
        prompt('คัดลอกข้อความนี้:', text);
      }
    });
  });

  container.querySelectorAll('[data-preview-support-img]').forEach((img) => {
    img.addEventListener('click', () => {
      openInfoViewerModal('📸 รูปภาพแนบจากลูกค้า', `<div style="text-align:center;"><img src="${img.src}" alt="รูปภาพแนบ" style="max-inline-size:100%; border-radius:8px;"></div>`);
    });
  });
}

function exportSupportTicketsToCsv() {
  const tickets = (state.supportTickets || []).filter((t) => !t.isDeleted);
  if (tickets.length === 0) {
    showToast('ไม่มีรายการแจ้งปัญหาหรือคำขอสินค้าสำหรับส่งออก', 'warning');
    return;
  }

  const headers = [
    'รหัสรายการ',
    'วัน-เวลา',
    'ประเภท',
    'หมวดหมู่',
    'ชื่อสินค้า/หัวข้อปัญหา',
    'รูปแบบความต้องการ',
    'รายละเอียด',
    'รหัสออเดอร์',
    'ชื่อลูกค้า',
    'เบอร์โทร',
    'Line ID',
    'อีเมล',
    'สถานะ',
    'บันทึกแอดมิน'
  ];

  const rows = tickets.map((t) => [
    t.id,
    t.createdAtThai || t.createdAt,
    t.type === 'wishlist' ? 'ขอสินค้าที่ร้านไม่มี' : 'แจ้งปัญหาการใช้งาน',
    t.category || '',
    t.title || '',
    t.intent || '',
    (t.details || '').replace(/\r?\n/g, ' '),
    t.orderId || '',
    t.customerName || '',
    t.phone ? `'${t.phone}` : '',
    t.lineId || '',
    t.email || '',
    t.status || 'pending',
    (t.adminNote || '').replace(/\r?\n/g, ' ')
  ]);

  const csvContent = '\uFEFF' + [headers, ...rows]
    .map((r) => r.map((c) => `"${String(c || '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `takeit_support_requests_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('📊 ดาวน์โหลดไฟล์ CSV เรียบร้อยแล้ว');
}

async function syncAllSupportTicketsToGoogleSheet() {
  const webhookUrl = (state.settings.sheetWebhookUrl || '').trim();
  if (!webhookUrl || !webhookUrl.startsWith('http')) {
    showToast('⚠️ ยังไม่ได้ระบุ Google Apps Script Web App URL ในหน้าตั้งค่า', 'warning');
    return;
  }
  const tickets = (state.supportTickets || []).filter((t) => !t.isDeleted);
  showToast('☁️ กำลังซิงค์รายการแจ้งปัญหา & คำขอสินค้าไปยัง Google Sheets...');
  const ok = await postPayloadToGoogleSheet(webhookUrl, {
    action: 'sync_all_support_tickets',
    tickets
  });
  if (ok) {
    showToast(`✅ ซิงค์รายการคำขอและแจ้งปัญหา ${tickets.length} รายการเข้า Google Sheets เรียบร้อยแล้ว!`);
  } else {
    showToast('⚠️ ไม่สามารถส่งข้อมูลเข้า Google Sheets ได้ โปรดตรวจสอบ Webhook URL', 'warning');
  }
}

// ============================================================================
// Home Console Installation & Real-time ESP32 Hourly Meter Engine
// ============================================================================
const esp32ClientSyncTracker = new Map();

function normalizeEsp32SessionRecord(raw, docId = '') {
  if (!raw || typeof raw !== 'object') return null;
  const deviceId = String(raw.console_name || raw.deviceId || raw.esp32DeviceId || raw.boardId || docId || 'PS4_01').trim();
  const id = String(raw.id || docId || deviceId);

  // Support exact fields from ESP32 sketch (total_seconds, total_minutes, total_hours, last_timestamp, last_active, current_session, session_minutes)
  // as well as Admin manual fields (baseAccumulatedSeconds)
  let baseSeconds = 0;
  if (raw.total_seconds !== undefined && raw.total_seconds !== null && raw.total_seconds !== '') {
    const secVal = Math.max(0, Math.round(Number(raw.total_seconds || 0)));
    const hasMins = raw.total_minutes !== undefined && raw.total_minutes !== null && raw.total_minutes !== '';
    const minValSec = hasMins ? Math.max(0, Math.round(Number(raw.total_minutes || 0) * 60)) : secVal;
    // Prefer total_seconds when in sync with total_minutes; fallback cleanly if legacy 60s firmware updated total_minutes
    baseSeconds = (!hasMins || Math.floor(secVal / 60) === Math.floor(minValSec / 60)) ? secVal : minValSec;
  } else if (raw.total_minutes !== undefined && raw.total_minutes !== null && raw.total_minutes !== '') {
    baseSeconds = Math.round(Number(raw.total_minutes || 0) * 60);
  } else if (raw.baseAccumulatedSeconds !== undefined) {
    baseSeconds = Number(raw.baseAccumulatedSeconds) || 0;
  } else if (raw.totalSeconds !== undefined) {
    baseSeconds = Number(raw.totalSeconds) || 0;
  } else if (raw.usageSeconds !== undefined) {
    baseSeconds = Number(raw.usageSeconds) || 0;
  } else if (raw.total_hours !== undefined || raw.usageHours !== undefined || raw.hours !== undefined) {
    baseSeconds = Math.round(Number(raw.total_hours ?? raw.usageHours ?? raw.hours ?? 0) * 3600);
  }

  // Heartbeat detection from ESP32's last_timestamp (60s for legacy firmware, or 15s for upgraded firmware)
  const heartbeatIntervalSec = Math.max(10, Number(raw.heartbeat_interval || 60));
  const offlineTimeoutSec = Math.max(25, heartbeatIntervalSec + 12);
  const espEpochSec = Number(raw.last_timestamp || 0);

  if (espEpochSec > 1700000000) {
    const prevSync = esp32ClientSyncTracker.get(deviceId);
    if (!prevSync || prevSync.espEpochSec !== espEpochSec) {
      const ageMs = Math.max(0, Date.now() - (espEpochSec * 1000));
      const anchorMs = ageMs <= 15000 ? Date.now() : (espEpochSec * 1000);
      esp32ClientSyncTracker.set(deviceId, { espEpochSec, baseSeconds, anchorMs });
    }
  }

  const syncEntry = esp32ClientSyncTracker.get(deviceId);
  const nowSec = Math.floor(Date.now() / 1000);
  const elapsedSinceSyncSec = syncEntry && espEpochSec > 1700000000
    ? Math.max(0, Math.floor((Date.now() - syncEntry.anchorMs) / 1000))
    : Math.max(0, nowSec - espEpochSec);

  const manualStandbyBlocked = Boolean(
    raw.manualStandbyAtSec && espEpochSec > 0 && Number(raw.manualStandbyAtSec) >= espEpochSec && !raw.manualSimulatedOnline
  );
  const hasRecentEspHeartbeat = espEpochSec > 1700000000 && elapsedSinceSyncSec <= offlineTimeoutSec && !manualStandbyBlocked;
  const isTimedOutEsp = espEpochSec > 1700000000 && elapsedSinceSyncSec > offlineTimeoutSec && !raw.manualSimulatedOnline;

  const isOnline = Boolean(
    hasRecentEspHeartbeat ||
    raw.manualSimulatedOnline ||
    raw.powerStatus === 'online' ||
    raw.status === 'online' ||
    raw.isOnline === true ||
    raw.powerOn === true ||
    raw.isRunning === true ||
    raw.consoleOn === true
  ) && !isTimedOutEsp && !manualStandbyBlocked;

  const inferredPlatform = deviceId.toUpperCase().includes('PS4')
    ? 'PS4'
    : deviceId.toUpperCase().includes('NSW') || deviceId.toUpperCase().includes('SWITCH')
      ? 'Switch'
      : deviceId.toUpperCase().includes('XBOX')
        ? 'Xbox'
        : (raw.platform || 'PS5');

  const updatedAtMs = espEpochSec > 1700000000
    ? espEpochSec * 1000
    : Number(raw.updatedAtMs || Date.now());

  let lastStartTimeMs = null;
  if (isOnline) {
    if (raw.manualSimulatedOnline && raw.lastStartTimeMs) {
      lastStartTimeMs = Number(raw.lastStartTimeMs);
    } else if (syncEntry && syncEntry.espEpochSec === espEpochSec) {
      lastStartTimeMs = syncEntry.anchorMs;
    } else {
      lastStartTimeMs = updatedAtMs;
    }
  }

  return {
    ...raw,
    id,
    deviceId,
    console_name: deviceId,
    heartbeat_interval: heartbeatIntervalSec,
    total_seconds: Math.max(0, baseSeconds),
    total_minutes: Math.floor(baseSeconds / 60),
    total_hours: Number((baseSeconds / 3600).toFixed(2)),
    current_session: raw.current_session || '',
    session_minutes: Number(raw.session_minutes ?? raw.duration_minutes ?? 0),
    session_start: raw.session_start || raw.start_time || '',
    productId: raw.productId || 'PROD-PS5-SLIM',
    consoleName: raw.consoleName || (raw.name && raw.name !== deviceId ? raw.name : `เครื่องคอนโซล (${deviceId})`),
    platform: inferredPlatform,
    installFee: Number(raw.installFee ?? 400),
    hourlyRate: Number(raw.hourlyRate ?? 30),
    customerName: raw.customerName || raw.customer?.name || 'ลูกค้าบริการติดตั้งที่บ้าน',
    customerPhone: raw.customerPhone || raw.customer?.phone || '',
    customerAddress: raw.customerAddress || raw.customer?.address || '',
    customerEmail: raw.customerEmail || raw.customer?.email || '',
    customerUid: raw.customerUid || raw.customer?.uid || '',
    orderId: raw.orderId || '',
    baseAccumulatedSeconds: Math.max(0, baseSeconds),
    powerStatus: isOnline ? 'online' : 'standby',
    lastStartTimeMs,
    updatedAtMs,
    lastHeartbeatFormatted: raw.last_active || raw.lastHeartbeatFormatted || new Date(updatedAtMs).toLocaleString('th-TH')
  };
}

function getLiveEsp32SessionStats(session) {
  const norm = normalizeEsp32SessionRecord(session, session?.id);
  let totalSec = Number(norm.baseAccumulatedSeconds || 0);
  if (norm.powerStatus === 'online' && norm.lastStartTimeMs) {
    const elapsedSec = Math.max(0, Math.floor((Date.now() - Number(norm.lastStartTimeMs)) / 1000));
    const hasEspEpoch = Number(norm.last_timestamp || 0) > 1700000000 && !norm.manualSimulatedOnline;
    const heartbeatInterval = Math.max(10, Number(norm.heartbeat_interval || 60));
    // Smoothly tick second-by-second between ESP32 heartbeats (capped right before next packet)
    totalSec += hasEspEpoch ? Math.min(heartbeatInterval - 1, elapsedSec) : elapsedSec;
  }
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = Math.floor(totalSec % 60);
  const totalMinutes = Math.floor(totalSec / 60);
  const pad = (n) => String(n).padStart(2, '0');
  const digitalClock = `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  const readableDuration = `${hrs} ชม. ${mins} นาที ${secs} วินาที (รวม ${totalMinutes} นาที)`;
  const exactHours = totalSec / 3600;
  const hourlyRate = Number(norm.hourlyRate || 0);
  const liveCost = exactHours * hourlyRate;

  return {
    totalSeconds: totalSec,
    totalMinutes,
    exactHours,
    digitalClock,
    readableDuration,
    hourlyRate,
    liveCost,
    liveCostFormatted: '฿' + liveCost.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    isOnline: norm.powerStatus === 'online',
    heartbeatInterval: Number(norm.heartbeat_interval || 60)
  };
}

async function saveEsp32SessionToCloud(session) {
  if (!session || !session.id) return;
  const devId = session.deviceId || session.id;
  const totalSecs = Math.max(0, Math.round(Number(session.baseAccumulatedSeconds || 0)));
  const totalMins = Math.floor(totalSecs / 60);
  const totalHrs = Number((totalSecs / 3600).toFixed(2));
  const payload = {
    ...session,
    id: devId,
    deviceId: devId,
    console_name: devId,
    total_seconds: totalSecs,
    total_minutes: totalMins,
    total_hours: totalHrs
  };
  if (state.firestoreDb && state.firebaseModules) {
    try {
      const { doc, setDoc } = state.firebaseModules;
      await setDoc(doc(state.firestoreDb, 'takeit_console_sessions', devId), payload, { merge: true });
      await setDoc(doc(state.firestoreDb, 'ps4_tracker', devId), payload, { merge: true });
    } catch (err) {
      console.warn('Firestore save ESP32 session warning:', err);
    }
  }
}

async function deleteEsp32SessionFromCloud(sessionId) {
  if (!sessionId) return;
  if (state.firestoreDb && state.firebaseModules) {
    try {
      const { doc, setDoc, deleteDoc } = state.firebaseModules;
      const nowMs = Date.now();
      const tombstone = {
        id: sessionId,
        deviceId: sessionId,
        console_name: sessionId,
        isDeleted: true,
        deletedAtMs: nowMs,
        updatedAtMs: nowMs
      };
      await setDoc(doc(state.firestoreDb, 'takeit_console_sessions', sessionId), tombstone, { merge: true }).catch(() => {});
      await setDoc(doc(state.firestoreDb, 'ps4_tracker', sessionId), tombstone, { merge: true }).catch(() => {});
      await deleteDoc(doc(state.firestoreDb, 'takeit_console_sessions', sessionId)).catch(() => {});
      await deleteDoc(doc(state.firestoreDb, 'ps4_tracker', sessionId)).catch(() => {});
    } catch (err) {
      console.warn('Firestore delete ESP32 session warning:', err);
    }
  }
}

async function createOrUpdateEsp32SessionFromOrder(order, item) {
  const deviceId = (item.esp32DeviceId || `ESP32-${String(item.platform || 'CON').toUpperCase()}-${order.id.slice(-4)}`).trim();
  const nowMs = Date.now();
  const sessionObj = normalizeEsp32SessionRecord({
    id: deviceId,
    deviceId,
    orderId: order.id,
    contractNo: order.contractNo || ('CTR-' + order.id),
    productId: item.productId,
    consoleName: item.name,
    platform: item.platform,
    installFee: Number(item.installFee ?? 400),
    hourlyRate: Number(item.hourlyRate ?? 30),
    customerName: order.customer?.name || '',
    customerPhone: order.customer?.phone || '',
    customerAddress: order.customer?.address || '',
    customerEmail: order.customer?.email || order.customerEmail || '',
    customerUid: order.customer?.uid || order.customerUid || '',
    baseAccumulatedSeconds: 0,
    powerStatus: 'standby',
    lastStartTimeMs: null,
    createdAt: order.createdAt || new Date().toISOString(),
    updatedAtMs: nowMs,
    lastHeartbeatFormatted: new Date(nowMs).toLocaleString('th-TH')
  }, deviceId);

  if (!Array.isArray(state.consoleSessions)) state.consoleSessions = [];
  const existingIdx = state.consoleSessions.findIndex((s) => s.id === sessionObj.id || s.deviceId === sessionObj.deviceId);
  if (existingIdx > -1) {
    state.consoleSessions[existingIdx] = sessionObj;
  } else {
    state.consoleSessions.unshift(sessionObj);
  }
  saveStateLocally();
  await saveEsp32SessionToCloud(sessionObj);
  updateEsp32BadgeCount();
}

function updateEsp32BadgeCount() {
  const badge = document.getElementById('admin-esp32-badge');
  if (!badge) return;
  const activeSessions = (state.consoleSessions || []).filter((s) => !s.isDeleted);
  if (activeSessions.length > 0) {
    badge.textContent = String(activeSessions.length);
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

function openHomeConsoleModal(tab = 'service', prefillQuery = '') {
  const dlg = document.getElementById('dialog-home-console');
  if (!dlg) return;

  renderHomeConsoleServiceCatalog();
  switchHomeConsoleModalTab(tab);

  if (prefillQuery) {
    state.esp32SearchQuery = prefillQuery;
    const input = document.getElementById('esp32-lookup-input');
    if (input) input.value = prefillQuery;
  }

  renderEsp32QuickDevicesBar();
  renderEsp32LiveMeterResults(state.esp32SearchQuery || prefillQuery);

  if (!dlg.open) {
    dlg.showModal();
  }
}

function switchHomeConsoleModalTab(tab = 'service') {
  const isMeter = tab === 'meter';
  document.getElementById('btn-tab-home-service')?.classList.toggle('active', !isMeter);
  document.getElementById('btn-tab-home-meter')?.classList.toggle('active', isMeter);

  const paneService = document.getElementById('pane-home-service');
  const paneMeter = document.getElementById('pane-home-meter');
  if (paneService) paneService.hidden = isMeter;
  if (paneMeter) paneMeter.hidden = !isMeter;

  if (isMeter) {
    renderEsp32QuickDevicesBar();
    renderEsp32LiveMeterResults(state.esp32SearchQuery || '');
  } else {
    renderHomeConsoleServiceCatalog();
  }
}

function renderHomeConsoleServiceCatalog() {
  const container = document.getElementById('home-console-catalog-list');
  if (!container) return;

  const consoles = state.products.filter((p) => p.canHomeInstall);
  if (consoles.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align:center; padding:1.5rem; color:var(--text-muted); border:1px dashed var(--border-subtle); border-radius:var(--radius-md);">
        ยังไม่มีรายการเครื่องคอนโซลที่เปิดบริการติดตั้งที่บ้านในขณะนี้ (แอดมินสามารถเปิดใช้งานได้ในหน้าจัดการสินค้า)
      </div>
    `;
    return;
  }

  container.innerHTML = consoles.map((p) => {
    const imgs = getProductImages(p);
    const isReady = p.status === 'ready' && Number(p.stock) > 0;
    return `
      <div class="highlight-box" style="display:flex; flex-direction:column; gap:0.65rem; border-color:rgba(16,185,129,0.4);">
        <div style="position:relative; aspect-ratio:16/10; border-radius:8px; overflow:hidden; background:#050811;">
          <img src="${imgs[0]}" alt="${escapeXml(p.name)}" style="inline-size:100%; block-size:100%; object-fit:cover;">
          <span class="platform-pill platform-${escapeXml(p.platform)}" style="position:absolute; top:0.5rem; left:0.5rem;">${escapeXml(p.platform)}</span>
          <span class="badge badge-emerald" style="position:absolute; top:0.5rem; right:0.5rem;">📡 บอร์ด ${escapeXml(p.esp32DeviceId || 'ESP32')}</span>
        </div>
        <div>
          <strong style="color:var(--text-primary); font-size:0.98rem;">${escapeXml(p.name)}</strong>
          <p style="margin:0.25rem 0 0; font-size:0.8rem; color:var(--text-muted);">${escapeXml(p.description || '')}</p>
        </div>
        <div class="home-install-box" style="margin-block-start:auto;">
          <div>
            <span style="font-size:0.74rem; color:#a7f3d0; display:block;">ค่าติดตั้งเครื่องที่บ้าน:</span>
            <strong style="font-size:1rem; color:#f8fafc;">${formatTHB(p.installFee)}</strong>
          </div>
          <div style="text-align:end;">
            <span style="font-size:0.74rem; color:#a7f3d0; display:block;">คิดรายชั่วโมงตามจริง (Postpaid):</span>
            <span class="home-install-rate">⚡ ${formatTHB(p.hourlyRate)} / ชั่วโมง</span>
          </div>
        </div>
        <div style="display:flex; gap:0.45rem; flex-wrap:wrap;">
          ${isReady
            ? `<button type="button" class="btn btn-emerald btn-sm" style="flex:1;" data-modal-book-home-install="${p.id}">
                🏠 จองติดตั้งเครื่องนี้ที่บ้าน (${formatTHB(p.installFee)})
              </button>`
            : `<button type="button" class="btn btn-outline btn-sm" style="flex:1;" disabled>❌ คิวเครื่องเต็มชั่วคราว</button>`
          }
          <button type="button" class="btn btn-outline btn-sm" data-modal-preview-meter="${escapeXml(p.esp32DeviceId || p.id)}">
            📡 ดูมิเตอร์
          </button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-modal-book-home-install]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prodId = btn.getAttribute('data-modal-book-home-install');
      document.getElementById('dialog-home-console')?.close();
      addToCartHomeInstall(prodId);
    });
  });

  container.querySelectorAll('[data-modal-preview-meter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const devId = btn.getAttribute('data-modal-preview-meter') || '';
      state.esp32SearchQuery = devId;
      const input = document.getElementById('esp32-lookup-input');
      if (input) input.value = devId;
      switchHomeConsoleModalTab('meter');
    });
  });
}

function getAllSearchableEsp32Sessions() {
  const active = (state.consoleSessions || []).filter((s) => !s.isDeleted).map((s) => normalizeEsp32SessionRecord(s, s.id));
  if (active.length > 0) return active;

  // Provide ready-to-view live board telemetry cards from configured consoles if no custom session exists yet
  return state.products
    .filter((p) => p.canHomeInstall)
    .map((p) => normalizeEsp32SessionRecord({
      id: p.esp32DeviceId || `ESP32-${p.platform}-01`,
      deviceId: p.esp32DeviceId || `ESP32-${p.platform}-01`,
      productId: p.id,
      consoleName: p.name,
      platform: p.platform,
      installFee: Number(p.installFee ?? 400),
      hourlyRate: Number(p.hourlyRate ?? 30),
      customerName: 'พร้อมเชื่อมบอร์ด ESP32 ของลูกค้า',
      customerPhone: '',
      baseAccumulatedSeconds: 0,
      powerStatus: 'standby',
      updatedAtMs: Date.now()
    }));
}

function renderEsp32QuickDevicesBar() {
  const bar = document.getElementById('esp32-quick-devices-bar');
  if (!bar) return;
  const sessions = getAllSearchableEsp32Sessions();
  if (sessions.length === 0) {
    bar.innerHTML = '';
    return;
  }
  bar.innerHTML = `
    <span>กดเลือกดูบอร์ด ESP32 ด่วน:</span>
    ${sessions.slice(0, 6).map((s) => `
      <button type="button" class="preset-chip" data-quick-esp32-id="${escapeXml(s.deviceId)}" style="padding:0.2rem 0.6rem; font-size:0.75rem;">
        ${s.powerStatus === 'online' ? '🟢' : '⚪'} ${escapeXml(s.deviceId)} (${escapeXml(s.platform)})
      </button>
    `).join('')}
    <button type="button" class="preset-chip" data-quick-esp32-id="" style="padding:0.2rem 0.6rem; font-size:0.75rem;">
      แสดงทั้งหมด
    </button>
  `;

  bar.querySelectorAll('[data-quick-esp32-id]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const devId = chip.getAttribute('data-quick-esp32-id') || '';
      state.esp32SearchQuery = devId;
      const input = document.getElementById('esp32-lookup-input');
      if (input) input.value = devId;
      renderEsp32LiveMeterResults(devId);
    });
  });
}

function renderEsp32LiveMeterResults(rawQuery = '') {
  const container = document.getElementById('esp32-live-meter-results');
  if (!container) return;

  const allSessions = getAllSearchableEsp32Sessions();
  const q = String(rawQuery || '').trim().toLowerCase();
  const qDigits = q.replace(/\D/g, '');

  const matched = allSessions.filter((s) => {
    if (!q) {
      if (state.currentUser) {
        const myMatch = (s.customerUid && s.customerUid === state.currentUser.uid) ||
          (s.customerEmail && state.currentUser.email && s.customerEmail.toLowerCase() === state.currentUser.email.toLowerCase());
        if (myMatch) return true;
      }
      return true;
    }
    const devMatch = s.deviceId && s.deviceId.toLowerCase().includes(q);
    const ordMatch = s.orderId && s.orderId.toLowerCase().includes(q);
    const nameMatch = s.consoleName && s.consoleName.toLowerCase().includes(q);
    const phoneDigits = String(s.customerPhone || '').replace(/\D/g, '');
    const phoneMatch = qDigits.length >= 3 && phoneDigits.includes(qDigits);
    return devMatch || ordMatch || nameMatch || phoneMatch;
  });

  if (matched.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:2rem 1rem; color:var(--text-muted); background:rgba(15,23,42,0.5); border-radius:var(--radius-md); border:1px dashed var(--border-subtle);">
        <div style="font-size:2rem; margin-block-end:0.4rem;">📡</div>
        <strong style="display:block; color:var(--text-primary); margin-block-end:0.25rem;">ไม่พบข้อมูลเครื่องหรือบอร์ด ESP32 ที่ตรงกับ "${escapeXml(rawQuery)}"</strong>
        <p style="margin:0; font-size:0.84rem;">กรุณาตรวจสอบรหัสบอร์ด ESP32 (เช่น <code>ESP32-PS5-01</code>), รหัสออเดอร์ หรือเบอร์โทรศัพท์ของคุณอีกครั้งครับ</p>
      </div>
    `;
    return;
  }

  container.innerHTML = matched.map((s) => {
    const stats = getLiveEsp32SessionStats(s);
    const isOwnerOrAdmin = state.isAdmin || Boolean(
      (q && s.deviceId && s.deviceId.toLowerCase() === q) ||
      (qDigits.length >= 9 && String(s.customerPhone || '').replace(/\D/g, '') === qDigits) ||
      (state.currentUser && ((s.customerUid && s.customerUid === state.currentUser.uid) || (s.customerEmail && s.customerEmail === state.currentUser.email)))
    );
    const custDisplay = s.customerPhone
      ? (isOwnerOrAdmin ? `${s.customerName} (${s.customerPhone})` : `${maskCustomerName(s.customerName)} (${maskPhone(s.customerPhone)})`)
      : s.customerName;

    return `
      <div class="esp32-meter-card ${stats.isOnline ? '' : 'is-standby'}" data-esp32-card-id="${escapeXml(s.id)}" data-esp32-online="${stats.isOnline ? 'true' : 'false'}">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.65rem; border-block-end:1px solid rgba(255,255,255,0.08); padding-block-end:0.75rem;">
          <div>
            <div style="display:flex; align-items:center; gap:0.45rem; flex-wrap:wrap;">
              <span class="platform-pill platform-${escapeXml(s.platform)}">${escapeXml(s.platform)}</span>
              <span class="badge badge-cyan">📟 บอร์ด: ${escapeXml(s.deviceId)}</span>
              ${s.orderId ? `<span class="badge badge-purple">อ้างอิงออเดอร์: ${escapeXml(s.orderId)}</span>` : ''}
            </div>
            <h3 style="margin:0.4rem 0 0.15rem; font-size:1.1rem; color:var(--text-primary);">${escapeXml(s.consoleName)}</h3>
            <div style="font-size:0.82rem; color:var(--text-secondary);">
              👤 ผู้เช่าติดตั้งที่บ้าน: <strong>${escapeXml(custDisplay)}</strong>
              • ค่าติดตั้งเริ่มต้น: <strong style="color:#6ee7b7;">${formatTHB(s.installFee)}</strong>
            </div>
          </div>

          <div style="text-align:end;">
            ${stats.isOnline
              ? `<span class="badge badge-emerald" style="font-size:0.82rem; padding:0.35rem 0.8rem;">
                  <span class="esp32-live-dot"></span> เครื่องกำลังเปิดใช้งาน (ONLINE - กำลังนับเวลา)
                </span>`
              : `<span class="badge" style="background:rgba(148,163,184,0.16); color:#cbd5e1; border:1px solid rgba(148,163,184,0.3); font-size:0.82rem; padding:0.35rem 0.8rem;">
                  ⚪ เครื่องปิดพักอยู่ (STANDBY - หยุดนับเวลา)
                </span>`
            }
            <div style="font-size:0.74rem; color:var(--text-muted); margin-block-start:0.25rem;">
              ซิงค์ล่าสุดจากบอร์ด ESP32: <span data-esp32-heartbeat="${escapeXml(s.id)}">${escapeXml(s.lastHeartbeatFormatted || '-')}</span>
            </div>
          </div>
        </div>

        <div class="esp32-digital-grid">
          <div class="esp32-readout-box">
            <div style="font-size:0.78rem; color:var(--text-muted);">⏱️ ชั่วโมงใช้งานสะสม (Real-time ESP32 Timer)</div>
            <div class="esp32-digital-clock" data-esp32-clock="${escapeXml(s.id)}">${stats.digitalClock}</div>
            <div style="font-size:0.8rem; color:var(--text-secondary);" data-esp32-duration="${escapeXml(s.id)}">
              ${stats.readableDuration} (${stats.exactHours.toFixed(2)} ชม.)
            </div>
          </div>

          <div class="esp32-readout-box" style="border-color:rgba(16,185,129,0.38);">
            <div style="font-size:0.78rem; color:var(--text-muted);">💰 ยอดค่ารายชั่วโมงสะสม (Postpaid คิดตามจริง)</div>
            <div class="esp32-digital-cost" data-esp32-cost="${escapeXml(s.id)}">${stats.liveCostFormatted}</div>
            <div style="font-size:0.8rem; color:#6ee7b7;">
              อัตราค่าบริการ: <strong>${formatTHB(s.hourlyRate)} / ชั่วโมง</strong>
            </div>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; font-size:0.8rem; color:var(--text-secondary); padding-block-start:0.5rem; border-block-start:1px dashed rgba(255,255,255,0.08);">
          <span>
            ${s.current_session
              ? `🕹️ รอบการเล่นล่าสุด (Session): <strong>${escapeXml(s.current_session)}</strong> • เล่นรอบนี้แล้ว <strong>${Number(s.session_minutes || 0)} นาที</strong> (ซิงค์บอร์ดทุก ${stats.heartbeatInterval} วินาที)`
              : `📡 บอร์ด ESP32 (${escapeXml(s.deviceId)}) ส่งข้อมูลทุก ${stats.heartbeatInterval} วินาทีเข้า Firebase เว็บเราโดยตรง`
            }
            <br><span style="color:#6ee7b7; font-size:0.75rem;">🕗 รอบเก็บค่าเช่ารายชั่วโมง: เก็บแบบวันต่อวัน โดยทางร้านจะติดต่อหาลูกค้าช่วงเวลา <strong>20.00 น.</strong> ของทุกวัน</span>
            <br><span style="color:#fcd34d; font-size:0.75rem;">⚠️ เงื่อนไขสัญญา: หากหยุดใช้เครื่องติดต่อกันเกิน 2 วัน ทางร้านขอติดต่อนำเครื่องคืนเพื่อให้คิวลูกค้าท่านอื่น</span>
            <br><span style="color:#7dd3fc; font-size:0.75rem;">📞 หากลูกค้าต้องการขอคืนเครื่อง ติดต่อโทร <strong>0826716780</strong> (กรณีทางร้านขอคืน ทางร้านจะติดต่อแจ้งเหตุผลล่วงหน้า และไปรับคืนถึงบ้านฟรีไม่มีค่าบริการ)</span>
          </span>
          <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
            <button type="button" class="btn btn-outline btn-sm" data-esp32-session-contract="${escapeXml(s.id)}" data-unmasked="${isOwnerOrAdmin ? 'true' : 'false'}">
              📜 เปิดดูสัญญาเช่าติดบ้าน
            </button>
            <button type="button" class="btn btn-primary btn-sm" data-esp32-session-print="${escapeXml(s.id)}" data-unmasked="${isOwnerOrAdmin ? 'true' : 'false'}">
              🖨️ พิมพ์สัญญา / PDF
            </button>
            ${state.isAdmin ? `
              <button type="button" class="btn btn-outline btn-sm" data-admin-toggle-esp32-power="${escapeXml(s.id)}">
                ${stats.isOnline ? '⏸️ สั่งหยุดนับเวลา (Standby)' : '▶️ ทดสอบเปิดเครื่องนับเวลา (Online)'}
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-esp32-session-contract]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sessId = btn.getAttribute('data-esp32-session-contract');
      const unmasked = btn.getAttribute('data-unmasked') === 'true';
      openEsp32SessionContract(sessId, false, unmasked);
    });
  });

  container.querySelectorAll('[data-esp32-session-print]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sessId = btn.getAttribute('data-esp32-session-print');
      const unmasked = btn.getAttribute('data-unmasked') === 'true';
      openEsp32SessionContract(sessId, true, unmasked);
    });
  });

  container.querySelectorAll('[data-admin-toggle-esp32-power]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const sessId = btn.getAttribute('data-admin-toggle-esp32-power');
      await toggleEsp32SessionPowerState(sessId);
    });
  });
}

function updateLiveEsp32DomReadouts() {
  const allSessions = getAllSearchableEsp32Sessions();
  let statusChanged = false;
  allSessions.forEach((s) => {
    const stats = getLiveEsp32SessionStats(s);
    const liveStr = stats.isOnline ? 'true' : 'false';
    document.querySelectorAll(`[data-esp32-card-id="${s.id}"]`).forEach((cardEl) => {
      if (cardEl.getAttribute('data-esp32-online') !== liveStr) {
        statusChanged = true;
      }
    });
    document.querySelectorAll(`[data-esp32-clock="${s.id}"]`).forEach((el) => {
      el.textContent = stats.digitalClock;
    });
    document.querySelectorAll(`[data-esp32-duration="${s.id}"]`).forEach((el) => {
      el.textContent = `${stats.readableDuration} (${stats.exactHours.toFixed(2)} ชม.)`;
    });
    document.querySelectorAll(`[data-esp32-cost="${s.id}"]`).forEach((el) => {
      el.textContent = stats.liveCostFormatted;
    });
  });

  if (statusChanged) {
    refreshEsp32ViewsIfOpen();
  }
}

function startEsp32LiveTicker() {
  if (state.esp32TickerInterval) clearInterval(state.esp32TickerInterval);
  state.esp32TickerInterval = setInterval(() => {
    const homeDlg = document.getElementById('dialog-home-console');
    const adminEspTab = document.getElementById('admin-tab-esp32');
    const isModalOpen = Boolean(homeDlg && homeDlg.open);
    const isAdminTabOpen = Boolean(state.isAdmin && adminEspTab && !adminEspTab.hidden);
    if (isModalOpen || isAdminTabOpen) {
      updateLiveEsp32DomReadouts();
    }
  }, 1000);
}

function refreshEsp32ViewsIfOpen() {
  const homeDlg = document.getElementById('dialog-home-console');
  if (homeDlg && homeDlg.open) {
    renderEsp32QuickDevicesBar();
    renderEsp32LiveMeterResults(state.esp32SearchQuery || '');
  }
  if (state.isAdmin) {
    renderAdminEsp32Sessions();
  }
}

async function toggleEsp32SessionPowerState(sessionId) {
  let target = (state.consoleSessions || []).find((s) => s.id === sessionId || s.deviceId === sessionId);
  if (!target) {
    const fallbackList = getAllSearchableEsp32Sessions();
    const found = fallbackList.find((s) => s.id === sessionId || s.deviceId === sessionId);
    if (!found) return;
    target = { ...found };
    if (!Array.isArray(state.consoleSessions)) state.consoleSessions = [];
    state.consoleSessions.unshift(target);
  }

  const nowMs = Date.now();
  const stats = getLiveEsp32SessionStats(target);
  if (stats.isOnline) {
    target.baseAccumulatedSeconds = stats.totalSeconds;
    target.total_seconds = stats.totalSeconds;
    target.total_minutes = Math.floor(stats.totalSeconds / 60);
    target.total_hours = Number((stats.totalSeconds / 3600).toFixed(2));
    target.powerStatus = 'standby';
    target.manualSimulatedOnline = false;
    target.manualStandbyAtSec = Number(target.last_timestamp || Math.floor(nowMs / 1000));
    target.lastStartTimeMs = null;
  } else {
    target.baseAccumulatedSeconds = stats.totalSeconds;
    target.total_seconds = stats.totalSeconds;
    target.total_minutes = Math.floor(stats.totalSeconds / 60);
    target.total_hours = Number((stats.totalSeconds / 3600).toFixed(2));
    target.powerStatus = 'online';
    target.manualSimulatedOnline = true;
    target.manualStandbyAtSec = 0;
    target.lastStartTimeMs = nowMs;
  }
  target.manualActionAtMs = nowMs;
  target.updatedAtMs = nowMs;
  target.lastHeartbeatFormatted = new Date(nowMs).toLocaleString('th-TH');

  saveStateLocally();
  await saveEsp32SessionToCloud(target);
  refreshEsp32ViewsIfOpen();
  showToast(
    target.powerStatus === 'online'
      ? `🟢 บอร์ด ${target.deviceId} เริ่มนับเวลาใช้งานแบบ Real-time แล้ว!`
      : `⚪ บอร์ด ${target.deviceId} หยุดพักการนับเวลาแล้ว (ชั่วโมงสะสมถูกบันทึกไว้)`
  );
}

function renderAdminEsp32Sessions() {
  const container = document.getElementById('admin-esp32-sessions-list');
  if (!container) return;

  const sessions = getAllSearchableEsp32Sessions();
  if (sessions.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:2rem; color:var(--text-muted); border:1px dashed var(--border-subtle); border-radius:var(--radius-md);">
        ยังไม่มีเครื่องคอนโซลที่ผูกบอร์ด ESP32 กดปุ่ม "➕ เปิดบิลเครื่องติดตั้งที่บ้าน / ผูกบอร์ด ESP32 ใหม่" ด้านบนเพื่อเริ่มต้นได้เลยครับ
      </div>
    `;
    return;
  }

  container.innerHTML = sessions.map((s) => {
    const stats = getLiveEsp32SessionStats(s);
    return `
      <div class="esp32-meter-card ${stats.isOnline ? '' : 'is-standby'}" data-esp32-card-id="${escapeXml(s.id)}" data-esp32-online="${stats.isOnline ? 'true' : 'false'}" style="margin-block-end:0;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.75rem; margin-block-end:0.65rem;">
          <div>
            <span class="platform-pill platform-${escapeXml(s.platform)}">${escapeXml(s.platform)}</span>
            <strong style="font-size:1.05rem; margin-inline-start:0.4rem;">${escapeXml(s.consoleName)}</strong>
            <span class="badge badge-cyan" style="margin-inline-start:0.35rem;">📟 Device ID: ${escapeXml(s.deviceId)}</span>
            <div style="font-size:0.83rem; color:var(--text-secondary); margin-block-start:0.3rem;">
              👤 ลูกค้า: <strong>${escapeXml(s.customerName || '-')}</strong> (${escapeXml(s.customerPhone || '-')})
              ${s.customerAddress ? `• 📍 ${escapeXml(s.customerAddress)}` : ''}
              ${s.orderId ? `• 🧾 ออเดอร์: <strong>${escapeXml(s.orderId)}</strong>` : ''}
            </div>
          </div>

          <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <span class="badge ${stats.isOnline ? 'badge-emerald' : ''}" style="${!stats.isOnline ? 'background:rgba(148,163,184,0.16); color:#cbd5e1;' : ''}">
              ${stats.isOnline ? '🟢 ONLINE (กำลังนับชั่วโมง)' : '⚪ STANDBY (ปิดเครื่อง)'}
            </span>
          </div>
        </div>

        <div class="esp32-digital-grid" style="margin-block:0.65rem;">
          <div class="esp32-readout-box">
            <div style="font-size:0.75rem; color:var(--text-muted);">เวลาเปิดเครื่องสะสมรอบนี้</div>
            <div class="esp32-digital-clock" data-esp32-clock="${escapeXml(s.id)}">${stats.digitalClock}</div>
            <div style="font-size:0.78rem; color:var(--text-secondary);" data-esp32-duration="${escapeXml(s.id)}">${stats.readableDuration} (${stats.exactHours.toFixed(2)} ชม.)</div>
          </div>
          <div class="esp32-readout-box">
            <div style="font-size:0.75rem; color:var(--text-muted);">ยอดเรียกเก็บรายชั่วโมง (Postpaid)</div>
            <div class="esp32-digital-cost" data-esp32-cost="${escapeXml(s.id)}">${stats.liveCostFormatted}</div>
            <div style="font-size:0.78rem; color:#6ee7b7;">เรท ${formatTHB(s.hourlyRate)}/ชม. | ค่าติดตั้งเริ่มต้น ${formatTHB(s.installFee)}</div>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; padding-block-start:0.6rem; border-block-start:1px solid rgba(255,255,255,0.08);">
          <span style="font-size:0.75rem; color:var(--text-muted);">อัปเดตล่าสุด: ${escapeXml(s.lastHeartbeatFormatted || '-')} • รอบซิงค์บอร์ดทุก ${stats.heartbeatInterval} วิ</span>
          <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
            <button type="button" class="btn btn-primary btn-sm" data-admin-esp32-contract="${escapeXml(s.id)}">
              📜 ดู/พิมพ์สัญญาเช่าติดบ้าน
            </button>
            <button type="button" class="btn btn-emerald btn-sm" data-admin-esp32-toggle="${escapeXml(s.id)}">
              ${stats.isOnline ? '⏸️ หยุดนับเวลา (Standby)' : '▶️ เปิดนับเวลา (Simulate ON)'}
            </button>
            <button type="button" class="btn btn-outline btn-sm" data-admin-esp32-edit="${escapeXml(s.id)}">
              ✏️ แก้ไข / ตั้งค่าบอร์ด
            </button>
            <button type="button" class="btn btn-primary btn-sm" data-admin-esp32-reset="${escapeXml(s.id)}">
              💰 รับชำระค่ารายชั่วโมงแล้ว (รีเซ็ต 0 ชม.)
            </button>
            <button type="button" class="btn btn-danger btn-sm" data-admin-esp32-del="${escapeXml(s.id)}">
              🗑️ ลบ
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-admin-esp32-contract]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openEsp32SessionContract(btn.getAttribute('data-admin-esp32-contract'), false, true);
    });
  });

  container.querySelectorAll('[data-admin-esp32-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      toggleEsp32SessionPowerState(btn.getAttribute('data-admin-esp32-toggle'));
    });
  });

  container.querySelectorAll('[data-admin-esp32-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openAdminEsp32SessionModal(btn.getAttribute('data-admin-esp32-edit'));
    });
  });

  container.querySelectorAll('[data-admin-esp32-reset]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-admin-esp32-reset');
      let target = (state.consoleSessions || []).find((s) => s.id === id || s.deviceId === id);
      if (!target) {
        const found = getAllSearchableEsp32Sessions().find((s) => s.id === id || s.deviceId === id);
        if (!found) return;
        target = { ...found };
        state.consoleSessions.unshift(target);
      }
      const stats = getLiveEsp32SessionStats(target);
      const nowMs = Date.now();
      const wasOnline = Boolean(stats.isOnline);
      target.baseAccumulatedSeconds = 0;
      target.total_seconds = 0;
      target.total_minutes = 0;
      target.total_hours = 0;
      target.session_minutes = 0;
      target.powerStatus = wasOnline ? 'online' : 'standby';
      target.lastStartTimeMs = wasOnline ? nowMs : null;
      target.manualActionAtMs = nowMs;
      target.updatedAtMs = nowMs;
      target.lastHeartbeatFormatted = new Date(nowMs).toLocaleString('th-TH');
      const trackerKey = target.deviceId || target.id;
      if (wasOnline) {
        esp32ClientSyncTracker.set(trackerKey, {
          espEpochSec: Number(target.last_timestamp || 0),
          baseSeconds: 0,
          anchorMs: nowMs
        });
      } else {
        esp32ClientSyncTracker.delete(trackerKey);
        if (target.last_timestamp) {
          target.manualStandbyAtSec = Number(target.last_timestamp);
        }
      }
      saveStateLocally();
      await saveEsp32SessionToCloud(target);
      refreshEsp32ViewsIfOpen();
      showToast(`✅ เคลียร์ยอดชั่วโมงบอร์ด ${target.deviceId} เริ่มนับรอบบิลใหม่ (00:00:00) เรียบร้อยแล้ว!`);
    });
  });

  container.querySelectorAll('[data-admin-esp32-del]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-admin-esp32-del');
      const nowMs = Date.now();
      if (!Array.isArray(state.consoleSessions)) state.consoleSessions = [];
      const existing = state.consoleSessions.find((s) => s.id === id || s.deviceId === id);
      if (existing) {
        existing.isDeleted = true;
        existing.deletedAtMs = nowMs;
        existing.updatedAtMs = nowMs;
      } else {
        state.consoleSessions.push({ id, deviceId: id, isDeleted: true, deletedAtMs: nowMs, updatedAtMs: nowMs });
      }
      saveStateLocally();
      await deleteEsp32SessionFromCloud(id);
      updateEsp32BadgeCount();
      refreshEsp32ViewsIfOpen();
      showToast(`🗑️ ลบรายการบอร์ด ${id} เรียบร้อยแล้ว`);
    });
  });
}

function openAdminEsp32SessionModal(sessionId = null) {
  const dlg = document.getElementById('dialog-admin-esp32-session');
  if (!dlg) return;

  const consoleSelect = document.getElementById('esp32-console-select');
  const consoles = state.products.filter((p) => p.category === 'console' || p.canHomeInstall);
  if (consoleSelect) {
    consoleSelect.innerHTML = consoles.map((p) =>
      `<option value="${escapeXml(p.id)}">${escapeXml(p.name)} (${escapeXml(p.platform)})</option>`
    ).join('');
  }

  const all = getAllSearchableEsp32Sessions();
  const sess = sessionId ? all.find((s) => s.id === sessionId || s.deviceId === sessionId) : null;
  const defaultProd = consoles[0] || state.products[0];

  document.getElementById('esp32-session-id').value = sess ? sess.id : '';
  document.getElementById('esp32-device-id-input').value = sess ? sess.deviceId : (defaultProd?.esp32DeviceId || 'ESP32-PS5-01');
  if (consoleSelect && (sess?.productId || defaultProd?.id)) {
    consoleSelect.value = sess?.productId || defaultProd?.id;
  }
  document.getElementById('esp32-install-fee-input').value = sess ? sess.installFee : (defaultProd?.installFee ?? 400);
  document.getElementById('esp32-hourly-rate-input').value = sess ? sess.hourlyRate : (defaultProd?.hourlyRate ?? 30);
  document.getElementById('esp32-cust-name-input').value = sess ? sess.customerName : '';
  document.getElementById('esp32-cust-phone-input').value = sess ? sess.customerPhone : '';
  document.getElementById('esp32-cust-address-input').value = sess ? (sess.customerAddress || '') : '';
  const stats = sess ? getLiveEsp32SessionStats(sess) : { exactHours: 0, isOnline: false };
  document.getElementById('esp32-initial-hours-input').value = Number(stats.exactHours.toFixed(2));
  document.getElementById('esp32-power-status-select').value = stats.isOnline ? 'online' : 'standby';

  dlg.showModal();
}

async function handleSaveAdminEsp32Session(e) {
  e.preventDefault();
  const existingId = document.getElementById('esp32-session-id').value.trim();
  const deviceId = document.getElementById('esp32-device-id-input').value.trim() || 'ESP32-PS5-01';
  const prodId = document.getElementById('esp32-console-select').value;
  const prod = state.products.find((p) => p.id === prodId);
  const installFee = Math.max(0, Number(document.getElementById('esp32-install-fee-input').value || 0));
  const hourlyRate = Math.max(0, Number(document.getElementById('esp32-hourly-rate-input').value || 0));
  const customerName = document.getElementById('esp32-cust-name-input').value.trim();
  const customerPhone = document.getElementById('esp32-cust-phone-input').value.trim();
  const customerAddress = document.getElementById('esp32-cust-address-input').value.trim();
  const hoursVal = Math.max(0, Number(document.getElementById('esp32-initial-hours-input').value || 0));
  const powerStatus = document.getElementById('esp32-power-status-select').value;

  const nowMs = Date.now();
  const id = existingId || deviceId;
  const sessionObj = normalizeEsp32SessionRecord({
    id,
    deviceId,
    productId: prod?.id || prodId,
    consoleName: prod?.name || 'เครื่องเกมคอนโซล',
    platform: prod?.platform || 'PS5',
    installFee,
    hourlyRate,
    customerName,
    customerPhone,
    customerAddress,
    baseAccumulatedSeconds: Math.round(hoursVal * 3600),
    powerStatus,
    lastStartTimeMs: powerStatus === 'online' ? nowMs : null,
    updatedAtMs: nowMs,
    lastHeartbeatFormatted: new Date(nowMs).toLocaleString('th-TH')
  }, id);

  if (!Array.isArray(state.consoleSessions)) state.consoleSessions = [];
  const idx = state.consoleSessions.findIndex((s) => s.id === id || s.deviceId === deviceId);
  if (idx > -1) {
    state.consoleSessions[idx] = sessionObj;
  } else {
    state.consoleSessions.unshift(sessionObj);
  }

  saveStateLocally();
  await saveEsp32SessionToCloud(sessionObj);
  updateEsp32BadgeCount();
  refreshEsp32ViewsIfOpen();
  document.getElementById('dialog-admin-esp32-session')?.close();
  showToast(`📡 บันทึกข้อมูลบอร์ด "${deviceId}" สำหรับคุณ ${customerName} เรียบร้อยแล้ว!`);
}

function openEsp32SessionContract(sessionId, autoPrint = false, unmasked = true) {
  const all = getAllSearchableEsp32Sessions();
  const s = all.find((item) => item.id === sessionId || item.deviceId === sessionId);
  if (!s) return;

  // If this session is linked to an existing order in state.orders, use that order (and attach latest ESP32 stats)
  const existingOrd = s.orderId ? state.orders.find((o) => o.id === s.orderId) : null;
  if (existingOrd) {
    openOrderContractModal(existingOrd, { unmasked: state.isAdmin || unmasked, isDraft: false });
    if (autoPrint) {
      setTimeout(() => printActiveContract(), 150);
    }
    return;
  }

  // Otherwise construct a complete official Home Console Installation Contract document directly from the ESP32 session
  const stats = getLiveEsp32SessionStats(s);
  const contractId = s.orderId || `HOME-${s.deviceId}`;
  const contractOrderObj = {
    id: contractId,
    contractNo: s.contractNo || `CTR-${contractId}`,
    createdAt: s.createdAt || new Date(s.updatedAtMs || Date.now()).toISOString(),
    createdAtFormatted: s.lastHeartbeatFormatted || new Date().toLocaleString('th-TH'),
    orderTypeLabel: 'เช่าเครื่องคอนโซลติดตั้งที่บ้าน (ESP32 Real-time)',
    customer: {
      name: s.customerName || 'ลูกค้าผู้เช่าเครื่องติดตั้งที่บ้าน',
      phone: s.customerPhone || '-',
      lineId: '-',
      address: s.customerAddress || 'สถานที่ติดตั้งเครื่องคอนโซลของลูกค้า',
      email: s.customerEmail || ''
    },
    items: [
      {
        productId: s.productId || 'PROD-PS5-SLIM',
        name: `${s.consoleName} (ชั่วโมงสะสมปัจจุบัน: ${stats.readableDuration} = ${stats.liveCostFormatted})`,
        platform: s.platform || 'PS5',
        mode: 'home_install',
        installFee: Number(s.installFee ?? 400),
        hourlyRate: Number(s.hourlyRate ?? 30),
        esp32DeviceId: s.deviceId,
        shippingFee: 0,
        qty: 1
      }
    ],
    buySubtotal: 0,
    installSubtotal: Number(s.installFee ?? 400),
    rentSubtotal: 0,
    depositSubtotal: 0,
    shippingFee: 0,
    grandTotal: Number(s.installFee ?? 400),
    status: stats.isOnline ? 'กำลังเช่าติดตั้งที่บ้าน (ONLINE)' : 'ติดตั้งที่บ้านแล้ว (STANDBY)'
  };

  openOrderContractModal(contractOrderObj, { unmasked: state.isAdmin || unmasked, isDraft: false });
  if (autoPrint) {
    setTimeout(() => printActiveContract(), 150);
  }
}


