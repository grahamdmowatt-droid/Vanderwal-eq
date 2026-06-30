/* ============================================================
   VanderWal Equipment — site script
   ============================================================
   INVENTORY DATA CONTRACT (placeholder — update when the real
   feed is finalized):

   The site expects a JSON array at INVENTORY_FEED_URL, refreshed
   on an interval by the dealership's export job. Each item:

   {
     "id":        string|number   // unique stock identifier
     "make":      string          // e.g. "Massey Ferguson"
     "model":     string          // e.g. "MF 6713S"
     "year":      number
     "hours":     number          // 0 for new/demo units
     "price":     number          // CAD, before tax
     "category":  string          // "tractor" | "tillage" | "loader" | "hay"
                                   // ^ confirm this exists in the real feed;
                                   //   if not, see deriveCategory() below.
     "condition": string          // "good" | "fair" (display label only)
     "sn":        string          // stock number shown to customers
     "image":     string          // URL to a real photo
     "url":       string          // (optional) link to a detail page, if any
   }

   When the real schema is confirmed, the only things that should
   need to change are: INVENTORY_FEED_URL, the field names referenced
   in renderInventory()/buildCard(), and deriveCategory() if category
   isn't provided directly.
   ============================================================ */

const INVENTORY_FEED_URL = '/data/inventory.json'; // TODO: point at the real feed URL once live

let inventoryData = [];
let activeFilter = 'all';
let searchTerm = '';

/**
 * Fallback category logic, only used if the feed has no `category`
 * field. Keyword-matches on make/model. Adjust/expand as needed once
 * we know what's actually coming through.
 */
function deriveCategory(item) {
  const m = `${item.make || ''} ${item.model || ''}`.toLowerCase();
  if (/tractor|mf \d|massey/.test(m) && !/baler|mower|loader/.test(m)) return 'tractor';
  if (/lemken|harrow|plough|plow|cultivator|tillage|drill/.test(m)) return 'tillage';
  if (/weidemann|loader|telehandler|hoftrac/.test(m)) return 'loader';
  if (/ferris|woods|baler|mower|hay|brillion/.test(m)) return 'hay';
  return 'tractor';
}

function normalizeItem(raw) {
  return {
    id: raw.id,
    make: raw.make || '',
    model: raw.model || '',
    year: raw.year || '',
    hours: typeof raw.hours === 'number' ? raw.hours : 0,
    price: typeof raw.price === 'number' ? raw.price : 0,
    category: raw.category || deriveCategory(raw),
    condition: raw.condition || 'good',
    sn: raw.sn || raw.stockNumber || '',
    image: raw.image || raw.imageUrl || '',
    url: raw.url || '#'
  };
}

async function loadInventory() {
  const grid = document.getElementById('ig');
  const resultCount = document.getElementById('rc');
  if (!grid) return; // inventory section not on this page

  grid.innerHTML = '<div class="inv-loading">Loading inventory…</div>';

  try {
    const res = await fetch(INVENTORY_FEED_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Feed responded ${res.status}`);
    const raw = await res.json();
    inventoryData = Array.isArray(raw) ? raw.map(normalizeItem) : [];
    renderInventory();
  } catch (err) {
    console.error('Inventory feed failed to load:', err);
    grid.innerHTML = '<div class="inv-error">Inventory is temporarily unavailable. Please call us or check back shortly.</div>';
    if (resultCount) resultCount.textContent = '';
  }
}

function setFilter(el, category) {
  document.querySelectorAll('.fc').forEach(btn => btn.classList.remove('on'));
  el.classList.add('on');
  activeFilter = category;
  renderInventory();
}

function runSearch() {
  const input = document.getElementById('si');
  searchTerm = input ? input.value.toLowerCase().trim() : '';
  renderInventory();
}

function buildCard(item) {
  const badgeClass = item.condition === 'good' ? 'bgood' : 'bfair';
  const badgeLabel = item.condition === 'good' ? 'Good' : 'Fair';
  const hoursLabel = item.hours === 0 ? 'Demo' : `${item.hours.toLocaleString()} hrs`;
  const priceLabel = item.price ? `$${item.price.toLocaleString('en-CA')}` : 'Call for price';
  const imgSrc = item.image || '/assets/img/placeholder-unit.svg';

  return `
    <a class="uc" href="${item.url}">
      <div class="ui">
        <img src="${imgSrc}" alt="${item.make} ${item.model}" loading="lazy" onerror="this.src='/assets/img/placeholder-unit.svg'">
        <span class="ubadge ${badgeClass}">${badgeLabel}</span>
      </div>
      <div class="ub">
        <div class="umake">${item.make}</div>
        <div class="umodel">${item.model}</div>
        <div class="umeta">
          <span><strong>${item.year}</strong></span>
          <span><strong>${hoursLabel}</strong></span>
          <span>Stk <strong>${item.sn}</strong></span>
        </div>
        <div class="uprice">${priceLabel} ${item.price ? '<span class="upriceSub">CAD + tax</span>' : ''}</div>
        <span class="ucta">View Details →</span>
      </div>
    </a>`;
}

function renderInventory() {
  const sortSelect = document.getElementById('ss');
  const grid = document.getElementById('ig');
  const resultCount = document.getElementById('rc');
  if (!grid) return;

  const sortBy = sortSelect ? sortSelect.value : '';

  let filtered = inventoryData.filter(item => {
    const matchesCategory = activeFilter === 'all' || item.category === activeFilter;
    const matchesSearch = !searchTerm
      || item.make.toLowerCase().includes(searchTerm)
      || item.model.toLowerCase().includes(searchTerm)
      || item.sn.toLowerCase().includes(searchTerm);
    return matchesCategory && matchesSearch;
  });

  if (sortBy === 'price-asc') filtered.sort((a, b) => a.price - b.price);
  else if (sortBy === 'price-desc') filtered.sort((a, b) => b.price - a.price);
  else if (sortBy === 'year-desc') filtered.sort((a, b) => b.year - a.year);
  else if (sortBy === 'hours-asc') filtered.sort((a, b) => a.hours - b.hours);

  if (resultCount) {
    resultCount.textContent = `Showing ${filtered.length} unit${filtered.length !== 1 ? 's' : ''}`;
  }

  grid.innerHTML = filtered.length
    ? filtered.map(buildCard).join('')
    : '<div class="inv-empty">No units match your search. Try clearing filters.</div>';
}

/* ============================================================
   MODEL SHOWROOM (brand lineup overlay)
   This is static reference content (what models a brand offers),
   not live inventory, so it stays as local data rather than a feed.
   ============================================================ */

const SHOWROOM_MODELS = {
  "Massey Ferguson": [
    { name: "MF 5S Series", desc: "Dairy and livestock tractor with Sabre cab styling and class-leading visibility.", spec: "95–145 HP" },
    { name: "MF 6S Series", desc: "Mid-range all-rounder with Dyna-VT continuously variable transmission options.", spec: "130–180 HP" },
    { name: "MF 7S Series", desc: "Premium row-crop and livestock tractor with advanced cab suspension.", spec: "150–210 HP" },
    { name: "MF 8S Series", desc: "Flagship high-horsepower tractor for large-scale broadacre operations.", spec: "205–305 HP" },
    { name: "MF 9S Series", desc: "Top-of-range articulated and high-output tractor for heavy tillage and seeding.", spec: "370–435 HP" },
    { name: "MF 1700E Series", desc: "Compact utility tractor for acreage, livestock, and grounds maintenance.", spec: "25–45 HP" }
  ],
  "LEMKEN": [
    { name: "Heliodor 9", desc: "Compact disc harrow for seedbed preparation and soil conservation tillage.", spec: "3–6m width" },
    { name: "Rubin 10", desc: "Powerful disc harrow built for high-output stubble cultivation.", spec: "3–7m width" },
    { name: "Zirkon 10", desc: "Rotary harrow for intensive seedbed preparation ahead of drilling.", spec: "3–6m width" },
    { name: "Karat 9", desc: "Mounted cultivator for stubble cultivation and seedbed preparation.", spec: "3–4.5m width" },
    { name: "Juwel 8", desc: "Mounted reversible plough for high-quality ploughing in all conditions.", spec: "4–9 furrow" },
    { name: "Solitair 9", desc: "Mounted seed drill for precision seedbed combination drilling.", spec: "3–6m width" }
  ],
  "Weidemann": [
    { name: "T4512 Telehandler", desc: "Compact telehandler built for dairy and livestock farmyard operations.", spec: "4,500kg lift" },
    { name: "T6020 Telehandler", desc: "Mid-size telehandler with extended reach for stacking and loading.", spec: "6,000kg lift" },
    { name: "1160 Hoftrac", desc: "Compact wheel loader for tight yards and confined working spaces.", spec: "1,750kg lift" },
    { name: "1880 Hoftrac", desc: "Mid-size articulated wheel loader for general farm material handling.", spec: "2,600kg lift" },
    { name: "5080 Wheel Loader", desc: "Larger wheel loader for heavy-duty handling and yard work.", spec: "3,800kg lift" }
  ],
  "Ferris": [
    { name: "IS3300Z", desc: "Suspension zero-turn mower for a smooth ride on uneven turf.", spec: "37–profile HP" },
    { name: "IS2600Z", desc: "Mid-size zero-turn with full suspension for commercial mowing crews.", spec: "25hp+" },
    { name: "SRS Z3", desc: "Stand-on mower for fast, efficient mowing in tight spaces.", spec: "23–25hp" },
    { name: "F200", desc: "Front-mount mower for year-round versatility with attachments.", spec: "25hp" }
  ],
  "Woods": [
    { name: "Batwing Mower", desc: "Heavy-duty rotary cutter for pasture and roadside mowing.", spec: "10–20ft cut" },
    { name: "Box Blade", desc: "Rear-mounted grading attachment for driveways and yard leveling.", spec: "5–8ft width" },
    { name: "Rear Finishing Mower", desc: "Finish mower for fine-cut pasture and estate grounds maintenance.", spec: "5–7ft width" },
    { name: "Post Hole Digger", desc: "PTO-driven attachment for fence post and tree planting holes.", spec: "6–13in auger" }
  ],
  "Brillion": [
    { name: "XL Series Cultipacker", desc: "Pull-type roller for seedbed firming and improved seed-to-soil contact.", spec: "10–46ft width" },
    { name: "Pulverizer Roller", desc: "Soil finishing roller for breaking clods ahead of planting.", spec: "8–32ft width" },
    { name: "Soil Pulverizer SSDR", desc: "Combination tillage tool for one-pass seedbed preparation.", spec: "10–20ft width" }
  ]
};

function openShowroom(brand) {
  const nameEl = document.getElementById('showroom-brand-name');
  const gridEl = document.getElementById('showroom-grid');
  const overlay = document.getElementById('showroom-overlay');
  if (!nameEl || !gridEl || !overlay) return;

  nameEl.textContent = brand;
  const models = SHOWROOM_MODELS[brand] || [];
  gridEl.innerHTML = models.map(m => `
    <div class="showroom-model-card">
      <div class="showroom-model-name">${m.name}</div>
      <div class="showroom-model-desc">${m.desc}</div>
      <div class="showroom-model-spec">${m.spec}</div>
    </div>
  `).join('');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeShowroom() {
  const overlay = document.getElementById('showroom-overlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeShowroom();
});

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  loadInventory();

  const searchInput = document.getElementById('si');
  if (searchInput) {
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') runSearch();
    });
  }

  const sortSelect = document.getElementById('ss');
  if (sortSelect) {
    sortSelect.addEventListener('change', renderInventory);
  }
});
