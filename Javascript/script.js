let map;

const STORAGE_KEY = "tahak-theme";

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.body.classList.toggle("dark-mode", isDark);

  document.querySelectorAll(".theme-toggle").forEach((button) => {
    const icon = button.querySelector(".theme-icon");
    const label = button.querySelector(".theme-label");

    if (icon) {
      icon.textContent = isDark ? "🌙" : "☀️";
    }

    if (label) {
      label.textContent = isDark ? "Dark" : "Light";
    }

    button.setAttribute("aria-pressed", String(isDark));
    button.setAttribute(
      "aria-label",
      isDark ? "Switch to light mode" : "Switch to dark mode",
    );
  });
}

function bindThemeToggle() {
  document.querySelectorAll(".theme-toggle").forEach((button) => {
    if (button.dataset.themeBound === "true") {
      return;
    }

    button.dataset.themeBound = "true";
    button.addEventListener("click", () => {
      const nextTheme = document.body.classList.contains("dark-mode")
        ? "light"
        : "dark";

      try {
        localStorage.setItem(STORAGE_KEY, nextTheme);
      } catch (error) {
        // Ignore storage errors gracefully.
      }

      applyTheme(nextTheme);
    });
  });
}

try {
  const savedTheme = localStorage.getItem(STORAGE_KEY);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(savedTheme || (prefersDark ? "dark" : "light"));
} catch (error) {
  applyTheme("light");
}

bindThemeToggle();
document.addEventListener("DOMContentLoaded", bindThemeToggle);

function initBackToTop() {
  const backToTopButton = document.querySelector(".back-to-top");

  if (!backToTopButton) {
    return;
  }

  const toggleBackToTop = () => {
    const shouldShow = window.scrollY > 400;
    backToTopButton.classList.toggle("is-visible", shouldShow);
  };

  toggleBackToTop();
  window.addEventListener("scroll", toggleBackToTop, { passive: true });

  backToTopButton.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  });
}

initBackToTop();
document.addEventListener("DOMContentLoaded", initBackToTop);

const regionalFoods = [
  {
    group: "Luzon",
    region: "National Capital Region (NCR)",
    food: "Pancit Malabon",
    coordinates: [14.5995, 120.9842],
  },
  {
    group: "Luzon",
    region: "Cordillera Administrative Region (CAR)",
    food: "Pinikpikan",
    coordinates: [16.4023, 120.596],
  },
  {
    group: "Luzon",
    region: "Region 1 — Ilocos Region",
    food: "Ilocos Empanada",
    coordinates: [17.5747, 120.3869],
  },
  {
    group: "Luzon",
    region: "Region 2 — Cagayan Valley",
    food: "Pancit Batil Patun",
    coordinates: [17.6131, 121.7269],
  },
  {
    group: "Luzon",
    region: "Region 3 — Central Luzon",
    food: "Binghe",
    coordinates: [15.0343, 120.684],
  },
  {
    group: "Luzon",
    region: "Region 4A — CALABARZON",
    food: "Bulalo",
    coordinates: [14.2117, 121.1653],
  },
  {
    group: "Luzon",
    region: "Region 4B — MIMAROPA",
    food: "Adobong Pugita",
    coordinates: [13.411, 121.18],
  },
  {
    group: "Luzon",
    region: "Region 5 — Bicol Region",
    food: "Bicol Express",
    coordinates: [13.1391, 123.7438],
  },
  {
    group: "Visayas",
    region: "Region 6 — Western Visayas",
    food: "La Paz Batchoy",
    coordinates: [10.7202, 122.5621],
  },
  {
    group: "Visayas",
    region: "Region 7 — Central Visayas",
    food: "Cebu Lechon",
    coordinates: [10.3157, 123.8854],
  },
  {
    group: "Visayas",
    region: "Region 8 — Eastern Visayas",
    food: "Binagol",
    coordinates: [11.2433, 125.003],
  },
  {
    group: "Visayas",
    region: "Negros Island Region (NIR)",
    food: "Kansi",
    coordinates: [10.6765, 122.9511],
  },
  {
    group: "Mindanao",
    region: "Region 9 — Zamboanga Peninsula",
    food: "Curacha",
    coordinates: [6.9214, 122.079],
  },
  {
    group: "Mindanao",
    region: "Region 10 — Northern Mindanao",
    food: "Sinuglaw",
    coordinates: [8.4542, 124.6319],
  },
  {
    group: "Mindanao",
    region: "Region 11 — Davao Region",
    food: "Kinilaw na Tuna",
    coordinates: [7.1907, 125.4553],
  },
  {
    group: "Mindanao",
    region: "Region 12 — SOCCSKSARGEN",
    food: "Beef Sinina",
    coordinates: [6.4974, 124.8472],
  },
  {
    group: "Mindanao",
    region: "Region 13 — Caraga",
    food: "Bunta'a",
    coordinates: [8.9475, 125.5406],
  },
  {
    group: "Mindanao",
    region:
      "Region 14 — Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)",
    food: "Tiyula Itum",
    coordinates: [7.2236, 124.2464],
  },
];

const groupColors = {
  Luzon: "#d9653b",
  Visayas: "#e8b94e",
  Mindanao: "#23483a",
};

function markerIcon(group) {
  return L.divIcon({
    className: "regional-food-marker",
    html: `<span style="--pin-color: ${groupColors[group]}"><b>🍽</b></span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -31],
  });
}

function initializeMap() {
  const philippinesCenter = [12.8797, 121.774];

  const mapElement = document.getElementById("leaflet-map");
  if (!mapElement || typeof L === "undefined") {
    if (mapElement) {
      mapElement.innerHTML =
        '<p class="map-error">The interactive map could not be loaded. Check your internet connection and refresh the page.</p>';
    }
    return;
  }

  const compactViewport = window.matchMedia("(max-width: 800px)").matches;
  mapElement.style.width = "100%";
  mapElement.style.height = compactViewport ? "460px" : "510px";
  mapElement.style.minHeight = mapElement.style.height;

  map = L.map(mapElement).setView(philippinesCenter, 6);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19,
  }).addTo(map);

  const bounds = [];
  regionalFoods.forEach(({ group, region, food, coordinates }) => {
    const marker = L.marker(coordinates, {
      icon: markerIcon(group),
      title: `${region}: ${food}`,
    }).addTo(map).bindPopup(`
        <article class="food-popup">
          <p>${group}</p>
          <h2>${food}</h2>
          <span>${region}</span>
        </article>
      `);
    bounds.push(coordinates);
  });

  map.fitBounds(bounds, { padding: [35, 35], maxZoom: 6 });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeMap);
} else {
  initializeMap();
}

const mapContainer = document.getElementById("leaflet-map");
if (mapContainer && typeof ResizeObserver !== "undefined") {
  const resizeObserver = new ResizeObserver(() => {
    if (map) {
      map.invalidateSize();
    }
  });
  resizeObserver.observe(mapContainer);
}

const dishes = [
  {
    name: "Ilocos Empanada",
    region: "Luzon",
    origin: "Ilocos Region, Luzon",
    ingredients: "Rice flour, egg, longganisa, papaya, mung beans, oil",
    description:
      "A crispy orange pastry filled with savory meat and vegetables, known for its bright golden crust and rich local flavor.",
    image: "img/ilocos empanada.jpg",
  },
  {
    name: "Pancit Batil Patung",
    region: "Luzon",
    origin: "Cagayan Valley, Luzon",
    ingredients: "Miki noodles, pork, egg, onions, soy sauce, vegetables",
    description:
      "Noodles served with sautéed meat and a poached egg, bringing a hearty and comforting taste from the north.",
    image: "img/pancit batil.jpg",
  },
  {
    name: "Bringhe",
    region: "Luzon",
    origin: "Central Luzon, Luzon",
    ingredients: "Glutinous rice, chicken, coconut milk, turmeric, vegetables",
    description:
      "A festive rice dish similar to paella, rich with coconut milk, turmeric, and a savory chicken finish.",
    image: "img/bringhe.jpg",
  },
  {
    name: "Batangas Bulalo",
    region: "Luzon",
    origin: "CALABARZON, Luzon",
    ingredients: "Beef shank, bone marrow, corn, cabbage, peppercorns",
    description:
      "A rich beef soup made with shanks and marrow, simmered until deeply savory and comforting.",
    image: "img/batangas bulalo.jpg",
  },
  {
    name: "Bicol Express",
    region: "Luzon",
    origin: "Bicol Region, Luzon",
    ingredients: "Pork, coconut milk, chili peppers, shrimp paste, garlic",
    description:
      "A spicy, creamy pork dish with coconut milk and chili peppers, famous for its rich heat and bold flavor.",
    image: "img/bicol express.jpg",
  },
  {
    name: "La Paz Batchoy",
    region: "Visayas",
    origin: "Western Visayas, Visayas",
    ingredients: "Noodles, pork, pork liver, garlic, onions, pork broth",
    description:
      "A comforting noodle soup topped with pork, liver, and crushed pork cracklings for a rich savory bite.",
    image: "img/La Paz Batchoy.jpg",
  },
  {
    name: "Cebu Lechon",
    region: "Visayas",
    origin: "Central Visayas, Visayas",
    ingredients: "Whole pig, lemongrass, garlic, onions, salt",
    description:
      "A whole roasted pig known for its crisp skin and flavorful, tender meat, prepared with care and patience.",
    image: "img/Cebu Lechon.jpg",
  },
  {
    name: "Binagol",
    region: "Visayas",
    origin: "Eastern Visayas, Visayas",
    ingredients: "Taro, coconut milk, brown sugar, egg yolks",
    description:
      "A sweet delicacy made from grated taro and coconut milk, traditionally cooked in a coconut shell.",
    image: "img/Binagol.jpg",
  },
  {
    name: "Kansi",
    region: "Visayas",
    origin: "Negros Island Region, Visayas",
    ingredients:
      "Beef shank, batwan fruit, lemongrass, annatto, unripe jackfruit, chili peppers, aromatics, fish sauce",
    description:
      "A hearty Ilonggo beef soup with a tangy sour base and vibrant orange broth that warms the soul.",
    image: "img/Kansi.jpg",
  },
  {
    name: "Moron",
    region: "Visayas",
    origin: "Eastern Visayas, Visayas",
    ingredients:
      "Glutinous rice, rice flour, coconut milk, brown sugar, cocoa powder, banana leaves",
    description:
      "A half plain, half chocolate sticky rice delicacy wrapped in banana leaves and steamed until chewy and sweet.",
    image: "img/moron.jpg",
  },
  {
    name: "Curacha",
    region: "Mindanao",
    origin: "Zamboanga Peninsula, Mindanao",
    ingredients: "Curacha crab, coconut milk, garlic, onions, chili",
    description:
      "A large local crab dish simmered in a rich, savory sauce that highlights the region’s coastal flavors.",
    image: "img/Curacha.jpg",
  },
  {
    name: "Sinuglaw",
    region: "Mindanao",
    origin: "Northern Mindanao, Mindanao",
    ingredients: "Grilled pork, fresh fish, vinegar, calamansi, onions, chili",
    description:
      "A vibrant mix of grilled pork and fresh fish, cured with vinegar and citrus for a bright, bold bite.",
    image: "img/Sinuglaw.jpg",
  },
  {
    name: "Kinilaw na Tuna",
    region: "Mindanao",
    origin: "Davao Region, Mindanao",
    ingredients: "Fresh tuna, vinegar, calamansi, onions, ginger, chili",
    description:
      "Fresh tuna cured in vinegar and citrus, creating a clean, bright, and refreshing seafood dish.",
    image: "img/Kinilaw na Tuna.jpg",
  },
  {
    name: "Kare-Kare",
    region: "Luzon",
    origin: "Central Luzon, Luzon",
    ingredients:
      "Oxtail, tripe, peanut butter, banana heart, eggplant, string beans, pechay, annatto seeds, garlic, onion, bagoong alamang",
    description:
      "A rich, thick peanut stew with oxtail, tripe, and vegetables, served hot with salty shrimp paste on the side.",
    image: "img/kare-kare.jpg",
  },
  {
    name: "Dinengdeng",
    region: "Luzon",
    origin: "Ilocos Region, Luzon",
    ingredients:
      "Saluyot, squash, eggplant, okra, string beans, grilled fish, bagoong isda, water, onion, tomato",
    description:
      "A simple, comforting vegetable soup with grilled fish and a savory broth that captures everyday Ilocano warmth.",
    image: "img/Dinengdeng.jpg",
  },
  {
    name: "Adobong Pugita",
    region: "Luzon",
    origin: "MIMAROPA, Luzon",
    ingredients:
      "Octopus, soy sauce, vinegar, garlic, onion, ginger, bay leaves, oil, water, salt, pepper, sugar",
    description:
      "Tender octopus simmered in a classic adobo blend of soy sauce and vinegar, with garlic and ginger for depth.",
    image: "img/adobong pugita.jpg",
  },
  {
    name: "Beef Sinina",
    region: "Mindanao",
    origin: "SOCCSKSARGEN, Mindanao",
    ingredients:
      "Beef, coconut milk, palapa, aromatics, tomatoes, vegetables, seasoning, cooking oil, garnish",
    description:
      "A rich and aromatic beef stew from Maguindanao, simmered in coconut milk and layered with bold, warming spices.",
    image: "img/Beef Sinina.jpg",
  },
  {
    name: "Bunta'a",
    region: "Mindanao",
    origin: "Caraga, Mindanao",
    ingredients:
      "Fresh crabs, young coconut meat, crab fat, aromatics, coconut milk",
    description:
      "A traditional heritage dish of stuffed crabs simmered in coconut milk, rich with crab fat and fragrant spices.",
    image: "img/Bunta'a.jpg",
  },
  {
    name: "Tiyula Itum",
    region: "Mindanao",
    origin: "BARMM, Mindanao",
    ingredients:
      "Beef, burnt coconut, coconut milk, garlic, shallots, ginger, turmeric, chili, lemongrass, beef stock",
    description:
      "A traditional black beef soup with burnt coconut and warming spices, known for its deep color and ceremonial origins.",
    image: "img/Tiyula Itum.jpg",
  },
];

function initDishSection() {
  if (window.__tahakDishSectionInitialized) return;
  window.__tahakDishSectionInitialized = true;

  const grid = document.querySelector("#dish-grid");
  const emptyState = document.querySelector("#empty-state");
  const searchInput = document.querySelector("#dish-search");
  let activeFilter = "all";

  // Render the filtered dish list based on the current search phrase and region filter.
  function renderDishes() {
    if (!grid || !searchInput) return;

    const query = searchInput.value.trim().toLowerCase();
    const visible = dishes.filter((dish) => {
      const matchesFilter =
        activeFilter === "all" || dish.region === activeFilter;
      const matchesSearch = `${dish.name} ${dish.ingredients} ${dish.region}`
        .toLowerCase()
        .includes(query);
      return matchesFilter && matchesSearch;
    });
    grid.innerHTML = visible
      .map(
        (
          dish,
          index,
        ) => `<article class="dish-card reveal" style="animation-delay:${index * 0.06}s" data-name="${dish.name}">
    <div class="dish-card-image"><img src="${dish.image}" alt="${dish.name}"><span class="dish-region">${dish.region}</span></div>
    <div class="dish-card-content"><h3>${dish.name}<span class="dish-arrow">↗</span></h3><p>${dish.description}</p></div>
  </article>`,
      )
      .join("");
    grid.classList.remove("grid-refresh");
    void grid.offsetWidth;
    grid.classList.add("grid-refresh");

    if (emptyState) {
      emptyState.style.display = visible.length ? "none" : "block";
    }

    grid
      .querySelectorAll(".dish-card")
      .forEach((card) =>
        card.addEventListener("click", () =>
          openModal(dishes.find((dish) => dish.name === card.dataset.name)),
        ),
      );
  }

  // Opens the dish detail modal
  function openModal(dish) {
    if (!dish) return;

    const modalImage = document.querySelector("#modal-image");
    const modalTitle = document.querySelector("#modal-title");
    const modalRegion = document.querySelector("#modal-region");
    const modalDescription = document.querySelector("#modal-description");
    const modalOrigin = document.querySelector("#modal-origin");
    const modalIngredients = document.querySelector("#modal-ingredients");
    const modal = document.querySelector("#dish-modal");

    if (
      !modalImage ||
      !modalTitle ||
      !modalRegion ||
      !modalDescription ||
      !modalOrigin ||
      !modalIngredients ||
      !modal
    )
      return;

    modalImage.src = dish.image;
    modalImage.alt = dish.name;
    modalTitle.textContent = dish.name;
    modalRegion.textContent = dish.region;
    modalDescription.textContent = dish.description;
    modalOrigin.textContent = dish.origin;
    modalIngredients.textContent = dish.ingredients;
    modal.classList.add("open");
  }

  document.querySelectorAll(".filter").forEach((button) => {
    if (!button) return;
    button.addEventListener("click", () => {
      const activeButton = document.querySelector(".filter.active");
      if (activeButton) activeButton.classList.remove("active");
      button.classList.add("active");
      activeFilter = button.dataset.filter;
      renderDishes();
    });
  });
  if (searchInput) searchInput.addEventListener("input", renderDishes);
  const modalCloseButton = document.querySelector(".modal-close");
  if (modalCloseButton) {
    modalCloseButton.addEventListener("click", () => {
      const modal = document.querySelector("#dish-modal");
      if (modal) modal.classList.remove("open");
    });
  }
  const modal = document.querySelector("#dish-modal");
  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target.id === "dish-modal")
        event.currentTarget.classList.remove("open");
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") modal.classList.remove("open");
    });
  }

  // Region information used to update the featured-map panel on the home page.
  const regionData = {
    Luzon: {
      description:
        "Where bold, comforting flavors meet the quiet beauty of the north.",
      dish: "Kare-Kare",
      image:
        "https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=500&q=80",
    },
    Visayas: {
      description:
        "A sun-warmed table of smoky grills, bright citrus, and island generosity.",
      dish: "Cebu Lechon",
      image:
        "https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=500&q=80",
    },
    Mindanao: {
      description:
        "Fresh coastal flavors and deep spice shaped by many cultures and seas.",
      dish: "Kinilaw na Tuna",
      image:
        "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=500&q=80",
    },
  };

  document.querySelectorAll(".map-pin").forEach((pin) => {
    if (!pin) return;
    pin.addEventListener("click", () => {
      const region = pin.dataset.region;
      const data = regionData[region];
      if (!data) return;

      document
        .querySelectorAll(".map-pin")
        .forEach((item) => item.classList.remove("selected"));
      pin.classList.add("selected");
      const regionPanel = document.querySelector(".region-panel");
      if (regionPanel) {
        regionPanel.classList.remove("region-changing");
        void regionPanel.offsetWidth;
        regionPanel.classList.add("region-changing");
      }

      const regionTitle = document.querySelector("#region-title");
      const regionDescription = document.querySelector("#region-description");
      const regionDish = document.querySelector("#region-dish");
      const regionImage = document.querySelector("#region-image");
      const regionButton = document.querySelector("#region-button");

      if (regionTitle) regionTitle.textContent = region;
      if (regionDescription) regionDescription.textContent = data.description;
      if (regionDish) regionDish.textContent = data.dish;
      if (regionImage) {
        regionImage.src = data.image;
        regionImage.alt = `${data.dish} from ${region}`;
      }
      if (regionButton) {
        regionButton.innerHTML = `See ${region} dishes <span>→</span>`;
      }
    });
  });
  const regionButton = document.querySelector("#region-button");
  if (regionButton) {
    regionButton.addEventListener("click", () => {
      const regionTitle = document.querySelector("#region-title");
      const region = regionTitle ? regionTitle.textContent : "";
      if (!region) return;

      activeFilter = region;
      document
        .querySelectorAll(".filter")
        .forEach((button) =>
          button.classList.toggle("active", button.dataset.filter === region),
        );
      renderDishes();
      const dishesSection = document.querySelector("#dishes");
      if (dishesSection) {
        dishesSection.scrollIntoView({ behavior: "smooth" });
      }
    });
  }

  const menuToggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".main-nav");
  if (menuToggle && nav) {
    menuToggle.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("open");
      menuToggle.setAttribute("aria-expanded", isOpen);
    });
    nav
      .querySelectorAll("a")
      .forEach((link) =>
        link.addEventListener("click", () => nav.classList.remove("open")),
      );
  }

  const pageLinks = document.querySelectorAll(".main-nav a");
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  pageLinks.forEach((link) => {
    const href = link.getAttribute("href");
    const isActive =
      href === currentPage || (currentPage === "" && href === "index.html");
    if (isActive) link.classList.add("active");
  });

  const animatedItems = document.querySelectorAll(
    ".intro-strip, .map-card, .region-panel, .dish-toolbar, .culture-image, .gallery-grid figure, .contact-inner, .builder-feature, .builder-card, .site-footer",
  );
  animatedItems.forEach((item) => item.classList.add("scroll-animate"));

  const tiltElements = document.querySelectorAll(
    ".hero-visual, .map-card, .region-panel, .dish-card, .builder-card, .gallery-grid figure",
  );

  function setupTilt(element, maxRotate = 10) {
    element.addEventListener("pointermove", (event) => {
      const rect = element.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      const rotateY = (px - 0.5) * maxRotate * 2;
      const rotateX = (0.5 - py) * maxRotate * 2;
      element.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px)`;
    });

    element.addEventListener("pointerleave", () => {
      element.style.transform = "";
    });
  }

  tiltElements.forEach((element) => {
    if (element) setupTilt(element, 8);
  });

  if ("IntersectionObserver" in window) {
    const animationObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    animatedItems.forEach((item) => animationObserver.observe(item));
  } else {
    animatedItems.forEach((item) => item.classList.add("in-view"));
  }

  if (grid && searchInput) renderDishes();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDishSection);
} else {
  initDishSection();
}
