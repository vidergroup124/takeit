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
  ORDERS: 'takeit_orders_v1',
  SETTINGS: 'takeit_settings_v1',
  CART: 'takeit_cart_v1',
  ADMIN_SESSION: 'takeit_admin_session_v1'
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
    description: 'เครื่องเกมคอนโซลรุ่นท็อป PS5 Pro ความจุ 2TB รองรับ PSSR AI Upscaling และ Ray Tracing ขั้นสูง เครื่องศูนย์ไทย ประกันศูนย์ Sony 1 ปีเต็ม',
    image: makeProductBannerSvg('PlayStation 5 Pro', '2TB SSD • เครื่องศูนย์ไทยแท้', '#1e3a8a', '#172554', '🕹️')
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
    description: 'เครื่อง PS5 Slim รุ่นใส่แผ่นบลูเรย์ได้ ความจุ 1TB พร้อมจอย DualSense 1 ตัว เหมาะสำหรับซื้อคู่กับบริการเช่าแผ่นเกมของร้าน TakeIT',
    image: makeProductBannerSvg('PS5 Slim Disc 1TB', 'รุ่นมีหัวอ่านแผ่น • พร้อมจอย DualSense', '#2563eb', '#0f172a', '🎮')
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
    description: 'หน้าจอ OLED สีสดขนาด 7 นิ้ว เล่นได้ทั้งโหมดต่อทีวีและพกพา เครื่องศูนย์ไทย รับประกัน 1 ปี',
    image: makeProductBannerSvg('Nintendo Switch OLED', '7" OLED Display • Joy-Con Set', '#be123c', '#4c0519', '🍄')
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
    description: 'เครื่องคอนโซลขุมพลัง 12 TFLOPS รองรับ 4K 120FPS มีช่องใส่แผ่นเกม फिजिकัลบลูเรย์ พร้อมจอยไร้สาย Xbox',
    image: makeProductBannerSvg('Xbox Series X 1TB', '4K 120FPS • True Next-Gen Console', '#15803d', '#052e16', '🟢')
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
  orders: [],
  settings: { ...DEFAULT_SETTINGS },
  cart: [],
  isAdmin: false,
  activeCategory: 'all',
  activePlatform: 'all',
  activeMode: 'all',
  searchQuery: '',
  pendingSlipDataUrl: '',
  editingProductImages: [],
  firestoreDb: null,
  firebaseModules: null,
  auth: null,
  authModules: null,
  currentUser: null
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

function ensureProductGalleryImages(products) {
  if (!Array.isArray(products)) return [];
  return products.map((p) => {
    const cleaned = getProductImages(p);
    return {
      ...p,
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
    const savedProducts = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (savedProducts) {
      state.products = JSON.parse(savedProducts);
    }
    const savedOrders = localStorage.getItem(STORAGE_KEYS.ORDERS);
    if (savedOrders) {
      state.orders = JSON.parse(savedOrders);
    }
    const savedCart = localStorage.getItem(STORAGE_KEYS.CART);
    if (savedCart) {
      state.cart = JSON.parse(savedCart);
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
          state.products = json.data.products;
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

  if (!Array.isArray(state.products) || state.products.length === 0) {
    state.products = [...DEFAULT_PRODUCTS];
  }
  state.products = ensureProductGalleryImages(state.products);

  // 3. Connect to Firebase Firestore or Supabase if configured
  await initCloudConnection();
  state.products = ensureProductGalleryImages(state.products);

  saveStateLocally();
  renderAll();

  // 4. Automatically push any existing orders to Google Sheets in the background so no order is ever missed
  if (state.orders.length > 0) {
    autoSyncOrdersToGoogleSheetSilent();
  }
}

function saveStateLocally() {
  try {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(state.products));
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(state.orders));
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(state.settings));
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(state.cart));
  } catch (err) {
    console.warn('LocalStorage quota warning:', err);
  }

  // Also persist to local server API asynchronously if available
  fetch('/api/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      products: state.products,
      orders: state.orders,
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
        const cloudProducts = [];
        prodSnap.forEach((docSnap) => cloudProducts.push(docSnap.data()));
        const cloudMap = new Map(cloudProducts.map((p) => [p.id, p]));

        // Push any custom or more recently updated products from this device's localStorage to Cloud
        for (const lp of state.products) {
          if (!lp || !lp.id) continue;
          const isCustomLocal = /^PROD-\d+$/.test(String(lp.id)) || lp.isCustom;
          const cloudProd = cloudMap.get(lp.id);
          const localTime = Number(lp.updatedAtMs || 0);
          const cloudTime = Number(cloudProd?.updatedAtMs || 0);
          if ((isCustomLocal && !cloudProd) || (cloudProd && localTime > cloudTime)) {
            const cleanedLp = ensureProductGalleryImages([lp])[0];
            cloudMap.set(lp.id, cleanedLp);
            fsMod.setDoc(fsMod.doc(db, 'takeit_products', lp.id), cleanedLp).catch(() => {});
          }
        }
        state.products = sortProductsCatalog(ensureProductGalleryImages(Array.from(cloudMap.values())));
      } else {
        // Firestore collection is empty — upload current products to seed Firestore
        await pushAllToCloud();
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
        if (localOrd && localOrd.id && !orderMap.has(localOrd.id)) {
          orderMap.set(localOrd.id, localOrd);
          fsMod.setDoc(fsMod.doc(db, 'takeit_orders', localOrd.id), localOrd).catch(() => {});
        }
      }
      if (orderMap.size > 0) {
        const mergedOrders = Array.from(orderMap.values());
        mergedOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        state.orders = mergedOrders;
      }

      // 3. Real-time listeners so any product or order added on one device appears on all other devices automatically
      if (!state.unsubscribeFirestore) {
        const unsubProd = fsMod.onSnapshot(fsMod.collection(db, 'takeit_products'), (snap) => {
          if (snap.empty) return;
          const localMap = new Map((state.products || []).map((p) => [p.id, p]));
          const liveProducts = [];
          snap.forEach((d) => {
            const cloudProd = d.data();
            const localProd = localMap.get(cloudProd.id);
            if (localProd && Number(localProd.updatedAtMs || 0) > Number(cloudProd.updatedAtMs || 0)) {
              liveProducts.push(localProd);
            } else {
              liveProducts.push(cloudProd);
            }
          });
          state.products = sortProductsCatalog(ensureProductGalleryImages(liveProducts));
          saveStateLocally();
          renderStorefront();
          if (state.isAdmin) {
            renderAdminStats();
            renderAdminProductsTable();
          }
        });

        const unsubOrd = fsMod.onSnapshot(fsMod.collection(db, 'takeit_orders'), (snap) => {
          if (snap.empty) return;
          const liveOrders = [];
          snap.forEach((d) => liveOrders.push(d.data()));
          liveOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          state.orders = liveOrders;
          saveStateLocally();
          if (state.isAdmin) {
            renderAdminStats();
            renderAdminOrdersTable();
          }
        });

        state.unsubscribeFirestore = () => {
          unsubProd();
          unsubOrd();
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

async function deleteProductFromCloud(productId) {
  if (state.settings.cloudProvider === 'firebase') {
    if (!state.firestoreDb || !state.firebaseModules) {
      await initCloudConnection();
    }
    if (state.firestoreDb && state.firebaseModules) {
      try {
        const { doc, deleteDoc } = state.firebaseModules;
        await deleteDoc(doc(state.firestoreDb, 'takeit_products', productId));
      } catch (err) {
        console.error('Firestore delete product error:', err);
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

// ============================================================================
// Google Sheets Integration (Webhook + CSV/Excel Export)
// ============================================================================
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
  if (!webhookUrl || !state.orders.length) return;
  const cleanOrders = state.orders.map(buildSheetOrderPayload);
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

  const cleanOrders = state.orders.map(buildSheetOrderPayload);
  const ok = await postPayloadToGoogleSheet(webhookUrl, {
    action: 'sync_all_orders',
    orders: cleanOrders
  });
  if (ok) {
    showToast(`📊 ส่งข้อมูลคำสั่งซื้อทั้งหมด (${cleanOrders.length} รายการ) เข้า Google Sheets เรียบร้อยแล้ว!`);
  }
}

function exportOrdersToCsvSheet() {
  if (!state.orders.length) {
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

  const rows = state.orders.map((o) => {
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
  renderAdminVisibility();
  renderCustomerAuthUI();
  if (state.isAdmin) {
    renderAdminStats();
    renderAdminOrdersTable();
    renderAdminProductsTable();
    populateSettingsForm();
  }
}

function renderStorefront() {
  const grid = document.getElementById('product-grid');
  if (!grid) return;

  const q = state.searchQuery.trim().toLowerCase();
  const filtered = state.products.filter((p) => {
    if (state.activeCategory !== 'all' && p.category !== state.activeCategory) return false;
    if (state.activePlatform !== 'all' && p.platform !== state.activePlatform) return false;
    if (state.activeMode === 'rent_available' && !p.canRent) return false;
    if (state.activeMode === 'ready' && p.status !== 'ready') return false;
    if (state.activeMode === 'coming_soon' && p.status !== 'coming_soon') return false;
    if (q) {
      const hay = `${p.name} ${p.description} ${p.platform} ${p.category}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align:center; padding:3rem 1rem; background:var(--bg-surface); border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
        <div style="font-size:2.5rem; margin-block-end:0.5rem;">🔍</div>
        <h3 style="margin:0 0 0.4rem;">ไม่พบสินค้าที่ตรงกับตัวกรอง</h3>
        <p style="color:var(--text-muted); margin:0;">ลองเปลี่ยนหมวดหมู่ หรือค้นหาด้วยคำอื่นดูครับ</p>
      </div>
    `;
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
      actionButtonsHtml = buyBtn + rentBtn;
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

  // Attach Buy & Rent click handlers
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

  daysInput.value = '7';
  qtyInput.value = '1';
  qtyInput.max = String(Math.max(1, product.stock || 5));

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
  const total = rentFee + depositFee;

  document.getElementById('calc-rate-display').textContent = `${formatTHB(product.rentPricePerDay)} / วัน`;
  document.getElementById('calc-days-display').textContent = `${days} วัน × ${qty} แผ่น`;
  document.getElementById('calc-rent-fee-display').textContent = formatTHB(rentFee);
  document.getElementById('calc-deposit-display').textContent = formatTHB(depositFee);
  document.getElementById('calc-return-date-display').textContent = `${formatThaiDate(returnDate)} (เริ่ม ${formatThaiDate(startDate)})`;
  document.getElementById('calc-total-display').textContent = formatTHB(total);
}

// ============================================================================
// Cart & Guest Checkout Logic
// ============================================================================
function addToCartBuy(productId) {
  const product = state.products.find((p) => p.id === productId);
  if (!product) return;

  const existing = state.cart.find((item) => item.productId === productId && item.mode === 'buy');
  if (existing) {
    existing.qty += 1;
  } else {
    state.cart.push({
      cartItemId: 'CI-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      productId: product.id,
      name: product.name,
      platform: product.platform,
      image: product.image,
      mode: 'buy',
      price: Number(product.price || 0),
      qty: 1
    });
  }

  saveStateLocally();
  renderCartBadge();
  showToast(`🛒 เพิ่ม "${product.name}" (ซื้อขาด) ลงในตะกร้าแล้ว!`);
}

function addToCartRent(productId, rentDays, rentStartDate, qty) {
  const product = state.products.find((p) => p.id === productId);
  if (!product) return;

  const rentEndDate = addDaysToDateStr(rentStartDate, rentDays);
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
    rentStartDate,
    rentEndDate,
    qty: Number(qty || 1)
  });

  saveStateLocally();
  renderCartBadge();
  showToast(`💿 เพิ่มรายการเช่าแผ่น "${product.name}" (${rentDays} วัน) ลงตะกร้าแล้ว!`);
}

function renderCartBadge() {
  const badge = document.getElementById('cart-count-badge');
  if (!badge) return;
  const count = state.cart.reduce((sum, item) => sum + Number(item.qty || 1), 0);
  badge.textContent = String(count);
}

function calculateCartTotals() {
  let buySubtotal = 0;
  let rentSubtotal = 0;
  let depositSubtotal = 0;

  state.cart.forEach((item) => {
    if (item.mode === 'rent') {
      rentSubtotal += Number(item.rentRate) * Number(item.rentDays) * Number(item.qty);
      depositSubtotal += Number(item.deposit) * Number(item.qty);
    } else {
      buySubtotal += Number(item.price) * Number(item.qty);
    }
  });

  const shippingFee = state.cart.length > 0 ? Number(state.settings.shippingFee ?? 60) : 0;
  const grandTotal = buySubtotal + rentSubtotal + depositSubtotal + shippingFee;

  return { buySubtotal, rentSubtotal, depositSubtotal, shippingFee, grandTotal };
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
    if (item.mode === 'rent') {
      const rentCost = item.rentRate * item.rentDays * item.qty;
      const depCost = item.deposit * item.qty;
      return `
        <div class="cart-item">
          <img src="${item.image}" alt="${escapeXml(item.name)}">
          <div>
            <span class="badge badge-purple">💿 เช่าแผ่นเกมรายวัน (${item.rentDays} วัน)</span>
            <h4 style="margin:0.25rem 0 0.15rem;">${escapeXml(item.name)} (${escapeXml(item.platform)})</h4>
            <div style="font-size:0.82rem; color:var(--text-secondary);">
              ค่าเช่า: ${formatTHB(item.rentRate)}/วัน × ${item.rentDays} วัน × ${item.qty} แผ่น = <strong>${formatTHB(rentCost)}</strong>
              | ค่ามัดจำแผ่น: <strong style="color:#fcd34d;">${formatTHB(depCost)}</strong>
            </div>
            <div style="font-size:0.78rem; color:#34d399;">
              📅 วันเริ่มเช่า: ${formatThaiDate(item.rentStartDate)} → กำหนดส่งคืน: ${formatThaiDate(item.rentEndDate)} (🚚 ทางร้านจ่ายเงินค่าส่งของกลับให้)
            </div>
          </div>
          <div style="text-align:end;">
            <div style="font-weight:800; font-size:1.05rem; color:#e9d5ff; margin-block-end:0.4rem;">
              ${formatTHB(rentCost + depCost)}
            </div>
            <button type="button" class="btn btn-danger btn-sm" data-remove-cart="${item.cartItemId}">ลบ</button>
          </div>
        </div>
      `;
    } else {
      const lineTotal = item.price * item.qty;
      return `
        <div class="cart-item">
          <img src="${item.image}" alt="${escapeXml(item.name)}">
          <div>
            <span class="badge badge-cyan">🛒 ซื้อขาด</span>
            <h4 style="margin:0.25rem 0 0.15rem;">${escapeXml(item.name)} (${escapeXml(item.platform)})</h4>
            <div style="font-size:0.84rem; color:var(--text-secondary);">
              ราคา ${formatTHB(item.price)} × ${item.qty} ชิ้น
            </div>
          </div>
          <div style="text-align:end;">
            <div style="font-weight:800; font-size:1.05rem; color:var(--accent-cyan); margin-block-end:0.4rem;">
              ${formatTHB(lineTotal)}
            </div>
            <button type="button" class="btn btn-danger btn-sm" data-remove-cart="${item.cartItemId}">ลบ</button>
          </div>
        </div>
      `;
    }
  }).join('');

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
  document.getElementById('cart-rent-subtotal').textContent = formatTHB(totals.rentSubtotal);
  document.getElementById('cart-deposit-subtotal').textContent = formatTHB(totals.depositSubtotal);
  document.getElementById('cart-shipping-fee').textContent = formatTHB(totals.shippingFee);
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
  document.getElementById('stat-total-products').textContent = String(state.products.length);
  document.getElementById('stat-rentable-products').textContent = String(state.products.filter((p) => p.canRent).length);
  document.getElementById('stat-total-orders').textContent = String(state.orders.length);
  const totalRev = state.orders
    .filter((o) => o.status !== 'ยกเลิกรายการ')
    .reduce((sum, o) => sum + Number(o.grandTotal || 0), 0);
  document.getElementById('stat-total-revenue').textContent = formatTHB(totalRev);
}

function renderAdminOrdersTable() {
  const tbody = document.getElementById('admin-orders-tbody');
  if (!tbody) return;

  const statusFilter = document.getElementById('admin-order-filter')?.value || 'all';
  const list = state.orders.filter((o) => statusFilter === 'all' || o.status === statusFilter);

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
            มัดจำแผ่น: <strong style="color:#fcd34d;">${formatTHB(o.depositSubtotal)}</strong>
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
      state.orders = state.orders.filter((o) => o.id !== id);
      saveStateLocally();
      renderAdminStats();
      renderAdminOrdersTable();
      showToast(`🗑️ ลบรายการออเดอร์ ${id} แล้ว`);
    });
  });
}

function renderAdminProductsTable() {
  const tbody = document.getElementById('admin-products-tbody');
  if (!tbody) return;

  tbody.innerHTML = state.products.map((p) => {
    const imgs = getProductImages(p);
    const rentInfo = p.canRent
      ? `<span class="badge badge-purple">เช่า ${formatTHB(p.rentPricePerDay)}/วัน</span><br><span style="font-size:0.78rem; color:#fcd34d;">มัดจำ ${formatTHB(p.rentDeposit)}</span>`
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
        <td><strong style="color:var(--accent-cyan);">${Number(p.price) > 0 ? formatTHB(p.price) : '-'}</strong></td>
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
      state.products = state.products.filter((p) => p.id !== id);
      saveStateLocally();
      await deleteProductFromCloud(id);
      renderAll();
      showToast(`🗑️ ลบสินค้า "${prod.name}" เรียบร้อยแล้ว`);
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
  document.getElementById('prod-can-rent').checked = prod ? Boolean(prod.canRent) : true;
  document.getElementById('prod-rent-rate').value = prod ? (prod.rentPricePerDay || 45) : 45;
  document.getElementById('prod-rent-deposit').value = prod ? (prod.rentDeposit || 500) : 500;
  document.getElementById('prod-desc').value = prod ? (prod.description || '') : '';
  document.getElementById('prod-image-url').value = '';
  document.getElementById('prod-image-file').value = '';

  document.getElementById('prod-rent-fields').style.opacity = document.getElementById('prod-can-rent').checked ? '1' : '0.45';
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
    addToCartRent(prodId, days, startDate, qty);
    document.getElementById('dialog-rental-calc').close();
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

  document.getElementById('guest-checkout-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state.cart.length === 0) return;

    const totals = calculateCartTotals();
    const hasBuy = state.cart.some((i) => i.mode === 'buy');
    const hasRent = state.cart.some((i) => i.mode === 'rent');
    let orderTypeLabel = 'ซื้อสินค้า';
    if (hasBuy && hasRent) orderTypeLabel = 'ซื้อสินค้า + เช่าแผ่นเกม';
    else if (hasRent) orderTypeLabel = 'เช่าแผ่นเกมรายวัน';

    const now = new Date();
    const orderId = 'TK-' + now.toISOString().slice(2, 10).replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000);

    const newOrder = {
      id: orderId,
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
      rentSubtotal: totals.rentSubtotal,
      depositSubtotal: totals.depositSubtotal,
      shippingFee: totals.shippingFee,
      grandTotal: totals.grandTotal,
      slipDataUrl: state.pendingSlipDataUrl || '',
      status: 'รอตรวจสอบสลิป',
      statusLabel: 'รอตรวจสอบสลิป'
    };

    // Reduce product stock
    newOrder.items.forEach((item) => {
      const p = state.products.find((prod) => prod.id === item.productId);
      if (p && p.stock >= item.qty) {
        p.stock -= item.qty;
        saveProductToCloud(p);
      }
    });

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
      // Find orders belonging to the logged-in user
      const myOrders = state.orders.filter((o) =>
        (o.customerUid && o.customerUid === state.currentUser.uid) ||
        (o.customerEmail && o.customerEmail.toLowerCase() === state.currentUser.email.toLowerCase())
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
      const idMatch = o.id && o.id.toLowerCase().includes(qLower);
      const phoneDigits = (o.customer?.phone || '').replace(/\D/g, '');
      const phoneMatch = qDigits.length >= 3 && phoneDigits.includes(qDigits);
      return idMatch || phoneMatch;
    });

    renderOrderLookupList(matches, false, false, rawQ);
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

  document.getElementById('prod-can-rent')?.addEventListener('change', (e) => {
    document.getElementById('prod-rent-fields').style.opacity = e.target.checked ? '1' : '0.45';
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
    const canRent = document.getElementById('prod-can-rent').checked;
    const rentPricePerDay = canRent ? Number(document.getElementById('prod-rent-rate').value || 0) : 0;
    const rentDeposit = canRent ? Number(document.getElementById('prod-rent-deposit').value || 0) : 0;
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
      canRent,
      rentPricePerDay,
      rentDeposit,
      description,
      image: finalImages[0],
      images: finalImages,
      isCustom: true,
      createdAtMs: existingProd?.createdAtMs || nowMs,
      updatedAtMs: nowMs
    };

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
    state.products = [...DEFAULT_PRODUCTS];
    saveStateLocally();
    renderAll();
    showToast('🔄 รีเซ็ตรายการสินค้าตัวอย่างเริ่มต้นเรียบร้อยแล้ว');
  });
});

function showOrderReceiptModal(order, sentToSheet) {
  const dlg = document.getElementById('dialog-order-lookup');
  document.getElementById('order-lookup-input').value = order.id;
  renderOrderLookupList([order], true, sentToSheet);
  dlg.showModal();
}

function renderOrderLookupList(orders, isNewOrder = false, sentToSheet = false, searchQuery = '', isMyOrders = false) {
  const container = document.getElementById('order-lookup-results');
  if (!container) return;

  if (!orders || orders.length === 0) {
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
          <span style="font-size:0.82rem; color:var(--text-secondary);">พบประวัติคำสั่งซื้อของคุณทั้งหมด ${orders.length} รายการ</span>
        </div>
        <span class="badge badge-cyan">ล็อกอินด้วย Gmail แล้ว</span>
      </div>
    `
    : '';

  const bannerHtml = isNewOrder
    ? `
      <div style="background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.45); padding:1rem; border-radius:var(--radius-sm); margin-block-end:1rem;">
        <h3 style="margin:0 0 0.3rem; color:#34d399;">🎉 สั่งซื้อ / เช่าแผ่นเกมสำเร็จเรียบร้อย!</h3>
        <p style="margin:0; font-size:0.88rem; color:var(--text-secondary);">
          รหัสคำสั่งซื้อของคุณคือ <strong>${escapeXml(orders[0].id)}</strong>
          ${sentToSheet ? '(บันทึกข้อมูลลง Google Sheets ของร้านเรียบร้อยแล้ว)' : '(บันทึกคำสั่งซื้อเข้าระบบร้าน TakeIT เรียบร้อยแล้ว)'}
        </p>
      </div>
    `
    : '';

  container.innerHTML = myOrdersHeader + bannerHtml + orders.map((o) => {
    // If the viewer is the logged-in owner of this order, show unmasked name/phone. Otherwise mask for PDPA.
    const isOwner = isMyOrders || isNewOrder || Boolean(state.currentUser && (
      (o.customerUid && o.customerUid === state.currentUser.uid) ||
      (o.customerEmail && state.currentUser.email && o.customerEmail.toLowerCase() === state.currentUser.email.toLowerCase())
    ));

    const displayName = isOwner ? (o.customer?.name || '-') : maskCustomerName(o.customer?.name);
    const displayPhone = isOwner ? (o.customer?.phone || '-') : maskPhone(o.customer?.phone);

    const itemsList = (o.items || []).map((item) => {
      if (item.mode === 'rent') {
        return `<li>[เช่าแผ่น ${item.rentDays} วัน] <strong>${escapeXml(item.name)}</strong> (${escapeXml(item.platform)}) x${item.qty} — ค่าเช่า ${formatTHB(item.rentRate * item.rentDays * item.qty)} + มัดจำแผ่น ${formatTHB(item.deposit * item.qty)} (คืนแผ่นวันที่ ${formatThaiDate(item.rentEndDate)})</li>`;
      }
      return `<li>[ซื้อขาด] <strong>${escapeXml(item.name)}</strong> (${escapeXml(item.platform)}) x${item.qty} — ${formatTHB(item.price * item.qty)}</li>`;
    }).join('');

    return `
      <div class="highlight-box" style="margin-block-end:0.85rem;">
        <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:0.5rem; border-block-end:1px solid var(--border-subtle); padding-block-end:0.5rem; margin-block-end:0.6rem;">
          <strong>รหัสออเดอร์: <span style="color:var(--accent-cyan);">${escapeXml(o.id)}</span></strong>
          <span class="badge badge-emerald">${escapeXml(o.status || 'รอตรวจสอบสลิป')}</span>
        </div>
        <div style="font-size:0.85rem; color:var(--text-secondary); margin-block-end:0.5rem;">
          ผู้รับ: <strong>${escapeXml(maskedName)}</strong> (${escapeXml(maskedPhone)}) • วันที่สั่ง: ${escapeXml(o.createdAtFormatted)}
        </div>
        <ul style="margin:0 0 0.65rem; padding-inline-start:1.2rem; font-size:0.85rem;">
          ${itemsList}
        </ul>
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; font-size:0.9rem; padding-block-start:0.5rem; border-block-start:1px solid var(--border-subtle);">
          <span>รวมมัดจำแผ่นที่จะได้รับคืน: <strong style="color:#fcd34d;">${formatTHB(o.depositSubtotal)}</strong> <span style="font-size:0.8rem; color:#34d399;">(ค่าส่งของกลับตอนคืนแผ่น ทางร้านจ่ายให้)</span></span>
          <strong style="color:#34d399; font-size:1.05rem;">ยอดชำระสุทธิ: ${formatTHB(o.grandTotal)}</strong>
        </div>
      </div>
    `;
  }).join('');
}
