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

function initSharedHeader() {
  const menuToggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".main-nav");
  if (menuToggle && nav && menuToggle.dataset.navBound !== "true") {
    menuToggle.dataset.navBound = "true";
    menuToggle.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
      menuToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
    });
    nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
      nav.classList.remove("open");
      menuToggle.setAttribute("aria-expanded", "false");
    }));
  }

  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".main-nav a").forEach((link) => {
    const target = new URL(link.href, window.location.href);
    const isCurrent = target.pathname.split("/").pop() === currentPage && !target.hash;
    link.classList.toggle("active", isCurrent);
    if (isCurrent) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  const siteSearch = document.querySelector("#site-search");
  const dishSearch = document.querySelector("#dish-search");
  if (siteSearch) {
    if (dishSearch) {
      const initialSearch = new URLSearchParams(window.location.search).get("search");
      if (initialSearch) {
        siteSearch.value = initialSearch;
        dishSearch.value = initialSearch;
      }
      siteSearch.addEventListener("input", () => {
        dishSearch.value = siteSearch.value;
        dishSearch.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }
    siteSearch.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      if (dishSearch) {
        document.querySelector("#dishes")?.scrollIntoView({ behavior: "smooth" });
        dishSearch.focus({ preventScroll: true });
      } else {
        const query = siteSearch.value.trim();
        window.location.href = `dishes.html${query ? `?search=${encodeURIComponent(query)}` : ""}`;
      }
    });
  }
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initSharedHeader, { once: true });
else initSharedHeader();

function initBackToTop() {
  const backToTopButton = document.querySelector(".back-to-top");

  if (!backToTopButton || backToTopButton.dataset.bound === "true") {
    return;
  }
  backToTopButton.dataset.bound = "true";

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

const FEEDBACK_REFRESH_INTERVAL = 30_000;

function initWebsiteFeedback() {
  const form = document.querySelector("#feedback-form");
  const list = document.querySelector("#feedback-list");
  const status = document.querySelector("#feedback-status");
  const submitButton = form?.querySelector('button[type="submit"]');
  if (!form || !list || !status || !submitButton) return;

  const average = document.querySelector("#feedback-average");
  const count = document.querySelector("#feedback-count");
  const emptyState = document.querySelector("#feedback-empty");
  const config = window.TAHAK_SUPABASE_CONFIG;
  let supabaseClient;
  let isAdmin = false;
  let feedbackEntries = [];

  const setStatus = (message, isError = false) => {
    status.textContent = message;
    status.classList.toggle("is-error", isError);
    status.hidden = !message;
  };

  const setSubmitEnabled = (enabled) => {
    submitButton.disabled = !enabled;
  };

  const isValidConfig = () => {
    if (!config || typeof config.url !== "string" || typeof config.anonKey !== "string") {
      return false;
    }
    try {
      const url = new URL(config.url.trim());
      return (
        Boolean(config.anonKey.trim()) &&
        (url.protocol === "https:" ||
          (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))
      );
    } catch {
      return false;
    }
  };

  const isValidEntry = (entry) =>
    entry &&
    typeof entry.id === "string" &&
    typeof entry.name === "string" &&
    entry.name.length <= 60 &&
    typeof entry.message === "string" &&
    entry.message.length >= 8 &&
    entry.message.length <= 1000 &&
    Number.isInteger(entry.rating) &&
    entry.rating >= 1 &&
    entry.rating <= 5 &&
    typeof entry.createdAt === "string" &&
    Number.isFinite(Date.parse(entry.createdAt));

  const mapDatabaseEntry = (entry) => ({
    id: entry.id,
    name: entry.name,
    message: entry.message,
    rating: entry.rating,
    createdAt: entry.created_at,
  });

  const checkAdmin = async (user) => {
    if (!user) {
      isAdmin = false;
      return false;
    }
    const { data, error } = await supabaseClient
      .from("website_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    isAdmin = Boolean(data);
    return isAdmin;
  };

  const updateAccountPanel = async (session) => {
    if (!session) {
      isAdmin = false;
      renderEntries();
      return;
    }

    try {
      await checkAdmin(session.user);
      renderEntries();
    } catch (error) {
      console.error("Unable to verify feedback administrator access.", error);
      isAdmin = false;
      renderEntries();
    }
  };

  const renderEntries = () => {
    list.replaceChildren();
    feedbackEntries.forEach((entry) => {
      const item = document.createElement("li");
      item.className = "feedback-entry";
      const heading = document.createElement("div");
      heading.className = "feedback-entry-heading";
      const author = document.createElement("strong");
      author.textContent = entry.name || "Anonymous";
      const rating = document.createElement("span");
      rating.className = "feedback-entry-rating";
      rating.textContent = `${"★".repeat(entry.rating)}${"☆".repeat(5 - entry.rating)}`;
      rating.setAttribute("aria-label", `${entry.rating} out of 5 stars`);
      const date = document.createElement("time");
      date.dateTime = entry.createdAt;
      date.textContent = new Date(entry.createdAt).toLocaleDateString();
      const message = document.createElement("p");
      message.textContent = entry.message;
      heading.append(author, rating, date);
      item.append(heading, message);
      if (isAdmin) {
        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "feedback-delete";
        removeButton.dataset.deleteFeedback = entry.id;
        removeButton.textContent = "Remove feedback";
        removeButton.setAttribute(
          "aria-label",
          `Remove feedback by ${entry.name || "Anonymous"}`,
        );
        item.append(removeButton);
      }
      list.append(item);
    });

    if (count) count.textContent = String(feedbackEntries.length);
    if (average) {
      const ratingTotal = feedbackEntries.reduce(
        (total, entry) => total + entry.rating,
        0,
      );
      average.textContent = feedbackEntries.length
        ? (ratingTotal / feedbackEntries.length).toFixed(1)
        : "—";
    }
    if (emptyState) emptyState.hidden = feedbackEntries.length > 0;
  };

  const loadEntries = async () => {
    try {
      const { data, error } = await supabaseClient
        .from("website_feedback")
        .select("id,name,message,rating,created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      if (!Array.isArray(data)) {
        throw new TypeError("Shared feedback response has an invalid format.");
      }

      feedbackEntries = data
        .map(mapDatabaseEntry)
        .filter(isValidEntry)
        .slice(0, 100);
      renderEntries();
      if (status.classList.contains("is-error")) setStatus("");
      return true;
    } catch (error) {
      console.error("Unable to load shared website feedback.", error);
      setStatus(
        "Shared feedback could not be loaded. Check the internet connection and Supabase setup, then reload this page.",
        true,
      );
      return false;
    }
  };

  if (!isValidConfig() || !window.supabase?.createClient) {
    renderEntries();
    setSubmitEnabled(false);
    setStatus(
      "Feedback and accounts are unavailable. Check the Supabase URL, public anon key, and internet connection.",
      true,
    );
    return;
  }

  supabaseClient = window.supabase.createClient(config.url.trim(), config.anonKey.trim());
  setSubmitEnabled(true);
  renderEntries();
  loadEntries();
  window.setInterval(loadEntries, FEEDBACK_REFRESH_INTERVAL);

  list.addEventListener("click", async (event) => {
    if (!(event.target instanceof Element)) return;
    const removeButton = event.target.closest("[data-delete-feedback]");
    if (!removeButton || !isAdmin) return;

    removeButton.disabled = true;
    try {
      const { data, error } = await supabaseClient
        .from("website_feedback")
        .delete()
        .eq("id", removeButton.dataset.deleteFeedback)
        .select("id");
      if (error) throw error;
      const [deletedEntry] = Array.isArray(data) ? data : [];
      if (!deletedEntry) {
        throw new Error("Feedback was not removed. Confirm administrator access and try again.");
      }
      feedbackEntries = feedbackEntries.filter((entry) => entry.id !== deletedEntry.id);
      renderEntries();
      setStatus("Feedback removed.");
    } catch (error) {
      console.error("Unable to remove shared website feedback.", error);
      setStatus(error.message || "Unable to remove feedback.", true);
      removeButton.disabled = false;
    }
  });

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => {
      updateAccountPanel(session);
    }, 0);
  });
  supabaseClient.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error("Unable to restore the feedback account session.", error);
      return;
    }
    updateAccountPanel(data.session);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitButton.disabled) return;

    const data = new FormData(form);
    const name = String(data.get("name") || "").trim().slice(0, 60);
    const message = String(data.get("message") || "").trim();
    const rating = Number(data.get("rating"));

    if (message.length < 8 || message.length > 1000) {
      setStatus("Please enter a comment between 8 and 1,000 characters.", true);
      return;
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      setStatus("Choose a rating from 1 to 5 stars before posting.", true);
      return;
    }

    setSubmitEnabled(false);
    try {
      const { data, error } = await supabaseClient
        .from("website_feedback")
        .insert({ name, message, rating })
        .select("id,name,message,rating,created_at")
        .single();
      if (error) throw error;
      const entry = data && mapDatabaseEntry(data);
      if (!entry || !isValidEntry(entry)) {
        throw new TypeError("Supabase returned an invalid saved feedback entry.");
      }

      feedbackEntries = [entry, ...feedbackEntries]
        .filter(isValidEntry)
        .slice(0, 100);
      renderEntries();
      form.reset();
      setStatus("Thanks! Your feedback is shared with visitors on this website.");
    } catch (error) {
      console.error("Unable to post shared website feedback.", error);
      setStatus(
        "Your feedback could not be shared. Check the internet connection and Supabase setup, then try again.",
        true,
      );
    } finally {
      setSubmitEnabled(true);
    }
  });
}

initWebsiteFeedback();

function initLoginPage() {
  const form = document.querySelector("#account-form");
  if (!form) return;

  const status = document.querySelector("#account-status");
  const signedInPanel = document.querySelector("#account-signed-in");
  const signedInLabel = document.querySelector("#account-signed-in-label");
  const adminBadge = document.querySelector("#account-admin-badge");
  const feedbackLink = document.querySelector("#account-feedback-link");
  const signOutButton = document.querySelector("#account-sign-out");
  const config = window.TAHAK_SUPABASE_CONFIG;
  const buttons = form.querySelectorAll('button[type="submit"]');

  const setStatus = (message, isError = false) => {
    status.textContent = message;
    status.classList.toggle("is-error", isError);
    status.hidden = !message;
  };

  let supabaseClient;

  const updateSession = async (session) => {
    form.hidden = Boolean(session);
    signedInPanel.hidden = !session;
    if (!session) {
      if (adminBadge) adminBadge.hidden = true;
      return;
    }

    signedInLabel.textContent = `Signed in as ${session.user.email || "account"}`;
    try {
      const { data, error } = await supabaseClient
        .from("website_admins")
        .select("user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (error) throw error;
      if (adminBadge) adminBadge.hidden = !data;
      if (feedbackLink) {
        feedbackLink.textContent = data ? "Moderate feedback" : "View feedback";
      }
      setStatus(
        data
          ? "Administrator access is active. You can moderate feedback on the Feedback page."
          : "You are signed in. Administrator permissions are granted by the site owner.",
      );
    } catch (error) {
      console.error("Unable to verify account administrator status.", error);
      if (adminBadge) adminBadge.hidden = true;
      setStatus("Signed in, but administrator permissions could not be verified.", true);
    }
  };

  let validUrl = false;
  try {
    const url = new URL(config?.url?.trim() || "");
    validUrl =
      url.protocol === "https:" ||
      (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
  } catch {
    validUrl = false;
  }

  if (
    !validUrl ||
    typeof config?.anonKey !== "string" ||
    !config.anonKey.trim() ||
    !window.supabase?.createClient
  ) {
    buttons.forEach((button) => {
      button.disabled = true;
    });
    setStatus(
      "Accounts are unavailable. Configure the Supabase URL and public anon key before signing in.",
      true,
    );
    return;
  }

  supabaseClient = window.supabase.createClient(config.url.trim(), config.anonKey.trim());
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => updateSession(session), 0);
  });
  supabaseClient.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error("Unable to restore the account session.", error);
      setStatus("Unable to restore your account session. Please sign in again.", true);
      return;
    }
    updateSession(data.session);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const action = event.submitter?.value;
    const data = new FormData(form);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    if (!email || password.length < 8) {
      setStatus("Enter your email and a password with at least 8 characters.", true);
      return;
    }

    buttons.forEach((button) => {
      button.disabled = true;
    });
    try {
      if (action === "signup") {
        const { data: signupData, error } = await supabaseClient.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        if (signupData.session) {
          form.reset();
          await updateSession(signupData.session);
          setStatus("Your account was created and you are signed in.");
        } else {
          setStatus("Your account was created. Check your email to confirm it, then sign in.");
        }
      } else if (action === "signin") {
        const { data: loginData, error } =
          await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        form.reset();
        await updateSession(loginData.session);
      }
    } catch (error) {
      console.error("Account sign-in or sign-up failed.", error);
      setStatus(error.message || "Unable to complete the account request.", true);
    } finally {
      buttons.forEach((button) => {
        button.disabled = false;
      });
    }
  });

  signOutButton.addEventListener("click", async () => {
    signOutButton.disabled = true;
    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;
      await updateSession(null);
      setStatus("You have signed out.");
    } catch (error) {
      console.error("Unable to sign out.", error);
      setStatus(error.message || "Unable to sign out.", true);
    } finally {
      signOutButton.disabled = false;
    }
  });
}

initLoginPage();

function initDishSuggestions() {
  const form = document.querySelector("#dish-suggestion-form");
  if (!form) return;

  const status = document.querySelector("#dish-suggestion-status");
  const submitButton = form.querySelector('button[type="submit"]');
  const adminSection = document.querySelector("#dish-suggestion-admin");
  const adminStatus = document.querySelector("#suggestion-admin-status");
  const adminEmpty = document.querySelector("#suggestion-admin-empty");
  const adminList = document.querySelector("#dish-suggestion-list");
  const config = window.TAHAK_SUPABASE_CONFIG;
  let supabaseClient;
  let isAdmin = false;
  let suggestions = [];

  const setStatus = (target, message, isError = false) => {
    target.textContent = message;
    target.classList.toggle("is-error", isError);
    target.hidden = !message;
  };

  const renderSuggestions = () => {
    adminList.replaceChildren();
    suggestions.forEach((suggestion) => {
      const item = document.createElement("li");
      item.className = "feedback-entry suggestion-entry";
      const heading = document.createElement("div");
      heading.className = "feedback-entry-heading";
      const name = document.createElement("strong");
      name.textContent = suggestion.dish_name;
      const statusBadge = document.createElement("span");
      statusBadge.className = "feedback-admin-badge";
      statusBadge.textContent =
        suggestion.status === "approved" ? "Approved for catalog" : "Awaiting review";
      const date = document.createElement("time");
      date.dateTime = suggestion.submitted_at;
      date.textContent = new Date(suggestion.submitted_at).toLocaleDateString();
      heading.append(name, statusBadge, date);

      const origin = document.createElement("p");
      origin.className = "suggestion-origin";
      origin.textContent = suggestion.origin;
      const ingredients = document.createElement("p");
      ingredients.textContent = `Ingredients: ${suggestion.ingredients}`;
      const description = document.createElement("p");
      description.textContent = suggestion.description;
      item.append(heading, origin, ingredients, description);

      const actions = document.createElement("div");
      actions.className = "suggestion-actions";
      if (suggestion.status !== "approved") {
        const approveButton = document.createElement("button");
        approveButton.type = "button";
        approveButton.className = "button button-dark";
        approveButton.dataset.reviewSuggestion = suggestion.id;
        approveButton.textContent = "Approve suggestion";
        actions.append(approveButton);
      }
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "feedback-delete";
      removeButton.dataset.removeSuggestion = suggestion.id;
      removeButton.textContent = "Remove suggestion";
      actions.append(removeButton);
      item.append(actions);
      adminList.append(item);
    });
    adminEmpty.hidden = suggestions.length > 0;
  };

  const loadAdminSuggestions = async () => {
    const { data, error } = await supabaseClient
      .from("dish_suggestions")
      .select("id,dish_name,origin,ingredients,description,status,submitted_at")
      .order("submitted_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    if (!Array.isArray(data)) throw new TypeError("Invalid dish suggestion response.");
    suggestions = data;
    renderSuggestions();
  };

  const updateAdminView = async (session) => {
    isAdmin = false;
    adminSection.hidden = true;
    if (!session) return;
    try {
      const { data, error } = await supabaseClient
        .from("website_admins")
        .select("user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return;
      isAdmin = true;
      adminSection.hidden = false;
      await loadAdminSuggestions();
      setStatus(
        adminStatus,
        "Approved suggestions are marked for the team to verify and add to Javascript/script.js.",
      );
    } catch (error) {
      console.error("Unable to load administrator dish suggestions.", error);
      setStatus(adminStatus, "Unable to load suggestions. Check administrator setup.", true);
    }
  };

  let validUrl = false;
  try {
    const url = new URL(config?.url?.trim() || "");
    validUrl =
      url.protocol === "https:" ||
      (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
  } catch {
    validUrl = false;
  }

  if (!validUrl || !config?.anonKey?.trim() || !window.supabase?.createClient) {
    submitButton.disabled = true;
    setStatus(
      status,
      "Suggestions are unavailable until Supabase is configured and this website is online.",
      true,
    );
    return;
  }

  supabaseClient = window.supabase.createClient(config.url.trim(), config.anonKey.trim());
  submitButton.disabled = false;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitButton.disabled) return;
    const data = new FormData(form);
    const suggestion = {
      dish_name: String(data.get("dishName") || "").trim(),
      origin: String(data.get("origin") || "").trim(),
      ingredients: String(data.get("ingredients") || "").trim(),
      description: String(data.get("description") || "").trim(),
    };
    if (
      suggestion.dish_name.length < 2 ||
      suggestion.dish_name.length > 100 ||
      suggestion.origin.length < 2 ||
      suggestion.origin.length > 120 ||
      suggestion.ingredients.length < 3 ||
      suggestion.ingredients.length > 500 ||
      suggestion.description.length < 8 ||
      suggestion.description.length > 1000
    ) {
      setStatus(status, "Please complete each field within its stated length.", true);
      return;
    }

    submitButton.disabled = true;
    try {
      const { error } = await supabaseClient
        .from("dish_suggestions")
        .insert(suggestion);
      if (error) throw error;
      form.reset();
      setStatus(status, "Thank you! Your dish suggestion was sent to the team for review.");
    } catch (error) {
      console.error("Unable to submit dish suggestion.", error);
      setStatus(status, "Your suggestion could not be sent. Check your connection and try again.", true);
    } finally {
      submitButton.disabled = false;
    }
  });

  adminList.addEventListener("click", async (event) => {
    if (!(event.target instanceof Element) || !isAdmin) return;
    const approveButton = event.target.closest("[data-review-suggestion]");
    const removeButton = event.target.closest("[data-remove-suggestion]");
    const target = approveButton || removeButton;
    if (!target) return;
    target.disabled = true;
    try {
      if (approveButton) {
        const { data, error } = await supabaseClient
          .from("dish_suggestions")
          .update({ status: "approved" })
          .eq("id", approveButton.dataset.reviewSuggestion)
          .select("id,status")
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Suggestion was not updated. Check administrator access.");
        suggestions = suggestions.map((item) =>
          item.id === data.id ? { ...item, status: data.status } : item,
        );
        setStatus(adminStatus, "Suggestion approved for the team to add to the catalog.");
      } else {
        const { data, error } = await supabaseClient
          .from("dish_suggestions")
          .delete()
          .eq("id", removeButton.dataset.removeSuggestion)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Suggestion was not removed. Check administrator access.");
        suggestions = suggestions.filter((item) => item.id !== data.id);
        setStatus(adminStatus, "Suggestion removed.");
      }
      renderSuggestions();
    } catch (error) {
      console.error("Unable to moderate dish suggestion.", error);
      setStatus(adminStatus, error.message || "Unable to update suggestion.", true);
      target.disabled = false;
    }
  });

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => updateAdminView(session), 0);
  });
  supabaseClient.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error("Unable to restore administrator session for suggestions.", error);
      return;
    }
    updateAdminView(data.session);
  });
}

initDishSuggestions();

const dishes = [
  {
    name: "Ilocos Empanada",
    region: "Luzon",
    origin: "Ilocos Region, Luzon",
    ingredients: "Rice flour, egg, longganisa, papaya, mung beans, oil",
    description:
      "A crispy orange pastry filled with savory meat and vegetables, known for its bright golden crust and rich local flavor.",
    image: "img/ilocos empanada.jpg",
    youtubeVideoId: "gNKJcnxzJzA",
  },
  {
    name: "Pancit Batil Patung",
    region: "Luzon",
    origin: "Cagayan Valley, Luzon",
    ingredients: "Miki noodles, pork, egg, onions, soy sauce, vegetables",
    description:
      "Noodles served with sautéed meat and a poached egg, bringing a hearty and comforting taste from the north.",
    image: "img/pancit batil.jpg",
    youtubeVideoId: "Csjlh1_Jvrs",
  },
  {
    name: "Bringhe",
    region: "Luzon",
    origin: "Central Luzon, Luzon",
    ingredients: "Glutinous rice, chicken, coconut milk, turmeric, vegetables",
    description:
      "A festive rice dish similar to paella, rich with coconut milk, turmeric, and a savory chicken finish.",
    image: "img/bringhe.jpg",
    youtubeVideoId: "8dWcXij_ec8",
  },
  {
    name: "Batangas Bulalo",
    region: "Luzon",
    origin: "CALABARZON, Luzon",
    ingredients: "Beef shank, bone marrow, corn, cabbage, peppercorns",
    description:
      "A rich beef soup made with shanks and marrow, simmered until deeply savory and comforting.",
    image: "img/batangas bulalo.jpg",
    youtubeVideoId: "Wm9XcWik2xo",
  },
  {
    name: "Bicol Express",
    region: "Luzon",
    origin: "Bicol Region, Luzon",
    ingredients: "Pork, coconut milk, chili peppers, shrimp paste, garlic",
    description:
      "A spicy, creamy pork dish with coconut milk and chili peppers, famous for its rich heat and bold flavor.",
    image: "img/bicol express.jpg",
    youtubeVideoId: "0NkDScC-Tg4",
  },
  {
    name: "La Paz Batchoy",
    region: "Visayas",
    origin: "Western Visayas, Visayas",
    ingredients: "Noodles, pork, pork liver, garlic, onions, pork broth",
    description:
      "A comforting noodle soup topped with pork, liver, and crushed pork cracklings for a rich savory bite.",
    image: "img/La Paz Batchoy.jpg",
    youtubeVideoId: "we4_J9iB3HQ",
  },
  {
    name: "Cebu Lechon",
    region: "Visayas",
    origin: "Central Visayas, Visayas",
    ingredients: "Whole pig, lemongrass, garlic, onions, salt",
    description:
      "A whole roasted pig known for its crisp skin and flavorful, tender meat, prepared with care and patience.",
    image: "img/Cebu Lechon.jpg",
    youtubeVideoId: "KQtZiAI4yHQ",
    video:
      "https://commons.wikimedia.org/wiki/Special:Redirect/file/Lechon_vendors_in_Talisay_Cebu.webm",
    videoCredit:
      "Lechon vendors in Talisay Cebu — Lady01v, CC BY-SA 4.0 (Wikimedia Commons)",
  },
  {
    name: "Binagol",
    region: "Visayas",
    origin: "Eastern Visayas, Visayas",
    ingredients: "Taro, coconut milk, brown sugar, egg yolks",
    description:
      "A sweet delicacy made from grated taro and coconut milk, traditionally cooked in a coconut shell.",
    image: "img/Binagol.jpg",
    youtubeVideoId: "p5rPToBb6iY",
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
    youtubeVideoId: "7sLtMqObW6E",
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
    youtubeVideoId: "aST5HgMSzl8",
  },
  {
    name: "Curacha",
    region: "Mindanao",
    origin: "Zamboanga Peninsula, Mindanao",
    ingredients: "Curacha crab, coconut milk, garlic, onions, chili",
    description:
      "A large local crab dish simmered in a rich, savory sauce that highlights the region’s coastal flavors.",
    image: "img/Curacha.jpg",
    youtubeVideoId: "sRLYQJbo9vw",
  },
  {
    name: "Sinuglaw",
    region: "Mindanao",
    origin: "Northern Mindanao, Mindanao",
    ingredients: "Grilled pork, fresh fish, vinegar, calamansi, onions, chili",
    description:
      "A vibrant mix of grilled pork and fresh fish, cured with vinegar and citrus for a bright, bold bite.",
    image: "img/Sinuglaw.jpg",
    youtubeVideoId: "YeuBWQKrcuo",
  },
  {
    name: "Kinilaw na Tuna",
    region: "Mindanao",
    origin: "Davao Region, Mindanao",
    ingredients: "Fresh tuna, vinegar, calamansi, onions, ginger, chili",
    description:
      "Fresh tuna cured in vinegar and citrus, creating a clean, bright, and refreshing seafood dish.",
    image: "img/Kinilaw na Tuna.jpg",
    youtubeVideoId: "ncphGweaYFk",
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
    youtubeVideoId: "nqhBVM5-SmU",
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
    youtubeVideoId: "uQ10T4bP0zY",
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
    youtubeVideoId: "kbOnnr_bDgg",
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
    youtubeVideoId: "_SZ6vNCF8SM",
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
    youtubeVideoId: "1tQ9_h10LW0",
    videoNote: "Related recipe video.",
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
    youtubeVideoId: "UTdTTwWfo14",
  },
];

const preparationByDish = {
  "Ilocos Empanada": [
    "Mix rice flour with water and annatto into a pliable dough.",
    "Cook longganisa and mung beans, then fold in shredded papaya.",
    "Fill flattened dough with the mixture and an egg, seal, and fry until crisp and golden.",
  ],
  "Pancit Batil Patung": [
    "Simmer pork and aromatics for a light broth.",
    "Stir-fry miki noodles with pork, vegetables, and seasonings.",
    "Top with the meat mixture and egg; serve with broth alongside.",
  ],
  Bringhe: [
    "Sauté garlic and onion, then brown the chicken.",
    "Stir in glutinous rice, turmeric, and coconut milk.",
    "Cover and cook gently, stirring carefully, until the rice is tender and creamy.",
  ],
  "Batangas Bulalo": [
    "Simmer beef shanks slowly until tender, skimming the broth.",
    "Add corn and peppercorns; cook until the corn softens.",
    "Add cabbage near the end and serve the hot broth with rice.",
  ],
  "Bicol Express": [
    "Brown pork with garlic and onion.",
    "Add chilies and shrimp paste, then pour in coconut milk.",
    "Simmer until tender and the sauce thickens; adjust the chili to taste.",
  ],
  "La Paz Batchoy": [
    "Simmer pork bones and aromatics for a savory broth, then strain.",
    "Cook noodles and pork toppings until tender.",
    "Ladle broth over the noodles and finish with garlic, scallions, and crushed chicharon.",
  ],
  "Cebu Lechon": [
    "Season the cleaned pig and fill the cavity with lemongrass, garlic, and onion.",
    "Secure it on a spit and roast slowly over steady heat, turning continuously.",
    "Roast until safely cooked through and the skin is crisp; rest before carving.",
  ],
  Binagol: [
    "Cook grated taro with coconut milk and brown sugar, stirring until thick.",
    "Spoon the mixture into cleaned coconut shells and top with egg yolk.",
    "Cover and steam until set and fragrant.",
  ],
  Kansi: [
    "Simmer beef shank with aromatics until the meat begins to soften.",
    "Add batwan and annatto; continue simmering until the broth is tangy and rich.",
    "Add vegetables and cook until tender; serve hot with rice.",
  ],
  Moron: [
    "Cook glutinous rice with coconut milk and sugar until sticky, then divide it.",
    "Blend cocoa into one portion and layer the plain and chocolate mixtures.",
    "Wrap in banana leaves and steam until firm and chewy.",
  ],
  Curacha: [
    "Clean the crabs thoroughly.",
    "Sauté garlic and onion; add coconut milk and chili and bring to a gentle simmer.",
    "Add crab and cook until fully done and the sauce is fragrant.",
  ],
  Sinuglaw: [
    "Grill pork until smoky and cooked through, then slice it.",
    "Cut chilled fish into pieces and dress with vinegar or calamansi, onion, ginger, and chili.",
    "Fold together and serve promptly, keeping the fish chilled during preparation.",
  ],
  "Kinilaw na Tuna": [
    "Keep very fresh tuna chilled and cut it into bite-sized pieces.",
    "Toss with vinegar or calamansi, ginger, onion, and chili.",
    "Season to taste and serve promptly while cold.",
  ],
  "Kare-Kare": [
    "Simmer oxtail and tripe until tender, reserving the broth.",
    "Blend peanut butter and toasted rice flour with broth; add to the meat and simmer until thick.",
    "Cook vegetables until just tender, then serve with the stew and bagoong.",
  ],
  Dinengdeng: [
    "Simmer water with onion, tomato, and bagoong isda.",
    "Add firm vegetables first, followed by the remaining vegetables and saluyot.",
    "Add grilled fish and simmer gently until the vegetables are tender.",
  ],
  "Adobong Pugita": [
    "Clean the octopus and simmer gently until tender; reserve some cooking liquid.",
    "Sauté garlic, onion, and ginger, then add octopus, vinegar, and soy sauce.",
    "Simmer until the sauce reduces and coats the octopus; season to taste.",
  ],
  "Beef Sinina": [
    "Sauté aromatics and palapa, then brown the beef.",
    "Add tomatoes, seasoning, and enough liquid to simmer until tender.",
    "Stir in coconut milk and cook gently until rich and fragrant.",
  ],
  "Bunta'a": [
    "Cook crabs, remove the meat, and keep the cleaned shells for stuffing.",
    "Mix crab meat and crab fat with aromatics and young coconut; fill the shells.",
    "Simmer the stuffed crabs gently in coconut milk until cooked through.",
  ],
  "Tiyula Itum": [
    "Toast coconut until very dark, then grind it finely.",
    "Brown beef with garlic, shallots, ginger, turmeric, chili, and lemongrass.",
    "Add stock and toasted coconut; simmer until the beef is tender and the broth is deeply colored.",
  ],
};

function cookingVideoUrl(dish) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(dish.youtubeVideoId)}`;
}

function initDishSection() {
  if (window.__tahakDishSectionInitialized) return;
  const grid = document.querySelector("#dish-grid");
  if (!grid) return;
  window.__tahakDishSectionInitialized = true;
  const emptyState = document.querySelector("#empty-state");
  const searchInput = document.querySelector("#dish-search");
  // Show dishes that match the search.
  function renderDishes() {
    const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
    const visible = dishes.filter((dish) => {
      const matchesSearch = `${dish.name} ${dish.ingredients} ${dish.region}`
        .toLowerCase()
        .includes(query);
      return matchesSearch;
    });
    grid.innerHTML = visible
      .map(
        (
          dish,
          index,
        ) => `<article class="dish-card reveal" style="animation-delay:${index * 0.06}s" data-name="${dish.name}">
    <div class="dish-card-image"><img src="${dish.image}" alt="${dish.name}" loading="lazy" decoding="async"><span class="dish-region">${dish.region}</span><span class="dish-video-badge">▶ VIDEO · PREP</span></div>
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

    grid.querySelectorAll(".dish-card").forEach((card) => {
      const cardImage = card.querySelector("img");
      if (cardImage)
        cardImage.addEventListener(
          "error",
          () => {
            if (cardImage.dataset.fallbackApplied) return;
            cardImage.dataset.fallbackApplied = "true";
            cardImage.src = "img/1st.jpg";
            cardImage.alt = "A collection of Filipino dishes";
          },
          { once: true },
        );
      card.setAttribute("tabindex", "0");
      card.setAttribute("role", "button");
      card.addEventListener("click", () =>
        openModal(dishes.find((dish) => dish.name === card.dataset.name)),
      );
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openModal(dishes.find((dish) => dish.name === card.dataset.name));
        }
      });
    });
  }

  // Open the dish details.
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
    modalImage.onerror = () => {
      modalImage.onerror = null;
      modalImage.src = "img/1st.jpg";
      modalImage.alt = `${dish.name} image unavailable; showing a collection of Filipino dishes`;
      modalImage.classList.add("image-fallback");
    };
    modalTitle.textContent = dish.name;
    modalRegion.textContent = dish.region;
    modalDescription.textContent = dish.description;
    modalOrigin.textContent = dish.origin;
    modalIngredients.textContent = dish.ingredients;
    let videoPanel = modal.querySelector(".dish-video-panel");
    if (videoPanel) videoPanel.remove();
    const oldCommunityPanel = modal.querySelector(".dish-community-panel");
    if (oldCommunityPanel) oldCommunityPanel.remove();
    let cookingGuide = modal.querySelector(".cooking-guide");
    if (cookingGuide) cookingGuide.remove();
    videoPanel = document.createElement("section");
    videoPanel.className = "dish-video-panel";
    const videoHeading = document.createElement("h3");
    videoHeading.textContent = "Watch the preparation";
    videoPanel.append(videoHeading);
    const videoFrame = document.createElement("iframe");
    videoFrame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(dish.youtubeVideoId)}?rel=0`;
    videoFrame.title = `${dish.name} preparation video`;
    videoFrame.loading = "lazy";
    videoFrame.allow =
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    videoFrame.allowFullscreen = true;
    videoFrame.referrerPolicy = "strict-origin-when-cross-origin";
    videoPanel.append(videoFrame);
    if (dish.videoNote) {
      const videoNote = document.createElement("p");
      videoNote.className = "dish-video-note";
      videoNote.textContent = dish.videoNote;
      videoPanel.append(videoNote);
    }
    const videoSearch = document.createElement("a");
    videoSearch.className = "dish-video-search";
    videoSearch.href = cookingVideoUrl(dish);
    videoSearch.target = "_blank";
    videoSearch.rel = "noopener noreferrer";
    videoSearch.textContent = "Open video on YouTube";
    videoPanel.append(videoSearch);

    const communityPanel = document.createElement("section");
    communityPanel.className = "dish-community-panel";
    const communityHeading = document.createElement("h3");
    communityHeading.textContent = "Real viewer comments";
    const communityNote = document.createElement("p");
    communityNote.textContent = "Read viewer comments on YouTube.";
    const communityLink = document.createElement("a");
    communityLink.className = "dish-community-link";
    communityLink.href = `${cookingVideoUrl(dish)}#comments`;
    communityLink.target = "_blank";
    communityLink.rel = "noopener noreferrer";
    communityLink.textContent = "Read the real comments on YouTube";
    communityPanel.append(communityHeading, communityNote, communityLink);

    cookingGuide = document.createElement("section");
    cookingGuide.className = "cooking-guide";
    const prepHeading = document.createElement("h3");
    prepHeading.textContent = "How to prepare it";
    const steps = document.createElement("ol");
    (preparationByDish[dish.name] || []).forEach((step) => {
      const item = document.createElement("li");
      item.textContent = step;
      steps.append(item);
    });
    cookingGuide.append(prepHeading, steps);
    modal
      .querySelector(".modal-copy")
      .append(cookingGuide, videoPanel, communityPanel);
    modal.classList.add("open");
  }

  if (searchInput) searchInput.addEventListener("input", renderDishes);
  document.querySelectorAll("[data-carousel-step]").forEach((button) => {
    button.addEventListener("click", () => {
      const direction = Number(button.dataset.carouselStep) || 1;
      grid.scrollBy({ left: direction * grid.clientWidth * 0.78, behavior: "smooth" });
    });
  });
  if (searchInput) {
    const initialSearch = new URLSearchParams(window.location.search).get("search");
    if (initialSearch) searchInput.value = initialSearch;
  }
  const modal = document.querySelector("#dish-modal");
  const closeModal = () => {
    if (!modal) return;
    modal.classList.remove("open");
    modal.querySelectorAll("video").forEach((video) => {
      video.pause();
      video.currentTime = 0;
    });
  };
  const modalCloseButton = document.querySelector(".modal-close");
  if (modalCloseButton) {
    modalCloseButton.addEventListener("click", closeModal);
  }
  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target.id === "dish-modal") closeModal();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeModal();
    });
  }

  const animatedItems = document.querySelectorAll(
    ".dish-toolbar, .culture-image, .culture-copy, .gallery-grid figure, .builder-feature, .builder-card, .builders-section-heading, .builders-process, .builders-hero-copy, .builders-hero-art, .site-footer, .page-hero, .page-card, .page-panel, .home-hero-copy, .home-hero-art, .dishes-section > .section-heading",
  );
  animatedItems.forEach((item) => item.classList.add("scroll-animate"));

  const tiltElements = document.querySelectorAll(
    ".dish-card, .builder-card, .gallery-grid figure",
  );

  function setupTilt(element, maxRotate = 10) {
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      window.matchMedia("(hover: none)").matches
    )
      return;
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

  renderDishes();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDishSection);
} else {
  initDishSection();
}

// Lightweight food discovery helper. Answers are curated locally, so the site
// remains useful without an API key or network connection.
function initFoodGuide() {
  if (document.querySelector(".food-guide")) return;
  const widget = document.createElement("aside");
  widget.className = "food-guide";
  widget.innerHTML = `
    <button class="food-guide-launch" type="button" aria-expanded="false" aria-controls="food-guide-panel" aria-label="Ask about this website">✦<span> Ask about this website</span></button>
    <section class="food-guide-panel" id="food-guide-panel" role="dialog" aria-label="Website guide" hidden>
      <header><div><strong>Panlasa Guide</strong><small>Your guide to food and culture</small></div><button class="food-guide-clear" type="button" aria-label="Clear conversation">Clear</button><button class="food-guide-close" type="button" aria-label="Close chat">×</button></header>
      <div class="food-guide-messages" aria-live="polite"><article class="guide-message">Mabuhay! Ask me about any page, dish, recipe, feature, or team member on this website.</article></div>
      <div class="food-guide-suggestions"><button type="button">What pages are on this website?</button><button type="button">What dishes can I explore?</button><button type="button">How do I suggest a dish?</button><button type="button">How do I use the music player?</button></div>
      <form class="food-guide-form"><label class="sr-only" for="food-guide-input">Ask about this website</label><input id="food-guide-input" maxlength="250" autocomplete="off" placeholder="Ask about this website…" required><button type="submit" aria-label="Send message">↑</button></form>
    </section>`;
  document.body.append(widget);
  const launch = widget.querySelector(".food-guide-launch");
  const panel = widget.querySelector(".food-guide-panel");
  const messages = widget.querySelector(".food-guide-messages");
  const input = widget.querySelector("input");
  const form = widget.querySelector("form");
  const sendButton = form.querySelector('button[type="submit"]');
  const suggestions = [...widget.querySelectorAll(".food-guide-suggestions button")];
  let lastDishName = "";
  let activeReplyTimer = 0;
  let isReplyPending = false;
  const close = () => {
    panel.hidden = true;
    launch.setAttribute("aria-expanded", "false");
    launch.focus();
  };
  launch.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    launch.setAttribute("aria-expanded", String(!panel.hidden));
    if (!panel.hidden) input.focus();
  });
  widget.querySelector(".food-guide-close").addEventListener("click", close);
  const greeting =
    "Mabuhay! Ask me about any page, dish, recipe, feature, or team member on this website.";
  const stamp = (container) => {
    const time = document.createElement("time");
    time.dateTime = new Date().toISOString();
    time.textContent = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date());
    container.append(time);
  };
  stamp(messages.querySelector(".guide-message"));
  widget.querySelector(".food-guide-clear").addEventListener("click", () => {
    window.clearTimeout(activeReplyTimer);
    activeReplyTimer = 0;
    isReplyPending = false;
    input.disabled = false;
    sendButton.disabled = false;
    suggestions.forEach((button) => {
      button.disabled = false;
    });
    lastDishName = "";
    messages.replaceChildren();
    const welcome = document.createElement("article");
    welcome.className = "guide-message";
    welcome.textContent = greeting;
    stamp(welcome);
    messages.append(welcome);
  });
  const pageKnowledge = [
    {
      title: "Home page",
      text: "Home introduces Tahak sa Panlasa, a food and culture journey that starts with Filipino dishes, traditions, and stories, with plans to grow to include food cultures from around the world. Use the navigation to visit Home, Dishes, Our Story, Feedback, Suggest a dish, and Login. The theme button switches light and dark mode. The dishes can be searched by name or ingredient.",
    },
    {
      title: "Our Story page",
      text: "Our Story introduces the purpose of Tahak sa Panlasa and the five teammates who built it. Filipino recipes are passed down through hands, stories, and everyday rituals. Birthdays and town fiestas bring relatives and neighbors together. Filipino food reflects migration, exchange, hospitality, and sharing.",
    },
    {
      text: "The home page gallery shows Filipino dishes, ingredients, preparation, and shared meals.",
    },
    {
      title: "Our Story and team",
      text: "The Our Story page shares Tahak sa Panlasa’s purpose and introduces the five teammates and their project roles. Jhurenz Arapoc is project leader and programmer, responsible for project direction and the interactive website. Aron Seludo is web designer, responsible for visual identity and responsive design. Noah Lontoc is content manager, organizing dish details, stories, and cultural content. Jester Teodosio is researcher, covering dishes, ingredients, and traditions. Rodjay Sabornido is documentation officer, recording project work, testing, and documentation. The project process is Explore, Shape, and Refine.",
    },
    {
      title: "Feedback page",
      text: "The Feedback page lets visitors add a public comment and a 1-to-5-star rating for the website. With Supabase configured, comments are shared with visitors on other devices and refresh automatically. Without the project URL, public anon key, and database setup, comments cannot be submitted or loaded. Visitors may also use the Contact Us details shown on this page.",
    },
    {
      title: "Suggest a dish page",
      text: "Visitors can use the Suggest a dish page to send the team a dish name, origin or food culture, main ingredients, and description. Suggestions are submitted for team review and are not automatically published. The team can review, approve, or remove submissions after Supabase is configured and an administrator signs in. The dish catalog is updated by the team after verifying an approved suggestion.",
    },
    {
      title: "Login page",
      text: "The separate Login page lets visitors create an optional account, sign in, or sign out. Account features require the Supabase project URL and public anon key in Javascript/supabase-config.js, along with database setup and an internet connection. Signing up does not grant administrator access; the site owner must explicitly add an account UUID to the website_admins table.",
    },
    {
      title: "Website music player",
      text: "The site-wide music player provides play and pause, mute and unmute, and an adjustable volume slider. To enable playback, add a licensed audio file to the website and set its relative path as src in Javascript/music-config.js. Playback starts only after the visitor chooses Play. Volume and mute preferences are saved in the current browser.",
    },
    {
      title: "Dishes page",
      text: "The Dishes page is opened using the Dishes navigation link. Visitors can search and filter the collection, open dish details, and follow a link to suggest another dish. Dish suggestions are reviewed by the team before publication.",
    },
    {
      title: "Website features",
      text: "The site is a food and culture journey that starts with Filipino dishes and stories, with plans to expand and share food traditions from around the world. It has a searchable dish collection and cards that open details with ingredients, origins, preparation steps, and YouTube videos. Other features include light and dark themes, a photo gallery, team profiles, Supabase-backed public website feedback and ratings when configured, optional accounts, admin moderation, dish suggestions, an adjustable site music player, a site-wide locally curated chatbot, a back-to-top button, a moving food photo background, and an opening animation. Some external photos, account functions, shared data, and video links need an internet connection.",
    },
  ];
  const dishTags = {
    Binagol: "sweet dessert snack",
    Moron: "sweet dessert snack chocolate",
    "Bicol Express": "spicy hot chili creamy",
    "Tiyula Itum": "spicy soup beef Mindanao",
    "Kinilaw na Tuna": "seafood fish fresh sour",
    Sinuglaw: "seafood fish pork",
    Curacha: "seafood crab",
    "Adobong Pugita": "seafood octopus",
    "Bunta'a": "seafood crab",
    "La Paz Batchoy": "noodles soup pork",
    "Pancit Batil Patung": "noodles pork",
    "Ilocos Empanada": "snack savory",
    Dinengdeng: "vegetables fish soup",
    Kansi: "soup beef sour",
    "Batangas Bulalo": "soup beef",
  };
  const siteKnowledge = [
    ...pageKnowledge,
    ...dishes.map((dish) => ({
      title: dish.name,
      text: [
        dish.name,
        dish.region,
        dish.origin,
        dish.ingredients,
        dish.description,
        dishTags[dish.name] || "Filipino regional dish",
        (preparationByDish[dish.name] || []).join(" "),
        `Image: ${dish.image}`,
        `Video: https://www.youtube.com/watch?v=${dish.youtubeVideoId}`,
        dish.video || "",
        dish.videoCredit || "",
        dish.videoNote || "",
      ].join(". "),
    })),
  ];
  const normalize = (text) =>
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const stopWords = new Set(
    "a an and are about can do for from how i in is it me of on or tell the this to what where which who why with you your please recommend suggest".split(
      " ",
    ),
  );
  const queryWords = (text) =>
    normalize(text)
      .split(" ")
      .filter((word) => word.length > 1 && !stopWords.has(word));
  const editDistance = (left, right) => {
    if (Math.abs(left.length - right.length) > 2) return 3;
    let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
      const current = [leftIndex];
      for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
        current[rightIndex] = Math.min(
          current[rightIndex - 1] + 1,
          previous[rightIndex] + 1,
          previous[rightIndex - 1] +
            (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
        );
      }
      previous = current;
    }
    return previous[right.length];
  };
  const findDishMatches = (question) => {
    const normalizedQuestion = normalize(question);
    const exactMatches = dishes.filter((dish) => {
      if (normalizedQuestion.includes(normalize(dish.name))) return true;
      return Object.entries(foodAliases).some(
        ([aliasName, canonicalName]) =>
          canonicalName === dish.name &&
          normalizedQuestion.includes(normalize(aliasName)),
      );
    });
    if (exactMatches.length) return exactMatches;

    const words = queryWords(question);
    return dishes.filter((dish) =>
      queryWords(dish.name).some((nameWord) =>
        words.some(
          (word) =>
            word.length >= 5 &&
            editDistance(word, nameWord) <=
              Math.max(1, Math.floor(nameWord.length / 6)),
        ),
      ),
    );
  };
  const answerFor = (question) => {
    const q = normalize(question);
    if (
      /\b(submit|submission|send|suggestion page|suggestions page|suggest a dish page)\b/.test(q) ||
      (/\b(how|where|review|approve)\b/.test(q) &&
        /\b(suggest|suggestion|dish)\b/.test(q))
    ) {
      lastDishName = "";
      return "Use the Suggest a dish page from the navigation. Enter its name, origin or food culture, ingredients, and description, then send it for team review. Suggestions are not published automatically. Online submissions and admin review need the site owner's Supabase configuration.";
    }
    if (
      /\b(music|audio|volume|mute)\b/.test(q) &&
      /\b(player|play|site|website|sound|volume|mute|music)\b/.test(q)
    ) {
      lastDishName = "";
      return "Use the music player at the bottom-left of the page to play or pause, mute or unmute, and adjust volume. Playback is disabled until the site owner adds an audio file path in Javascript/music-config.js. Music starts only after you press Play.";
    }
    if (/\b(login|sign in|sign up|account|password)\b/.test(q)) {
      lastDishName = "";
      return "Open the separate Login page from the navigation to create an optional account, sign in, or sign out. Admin access is granted by the site owner in Supabase; signing up alone does not make an account an admin.";
    }
    if (/\b(feedback|rating|comment|contact us)\b/.test(q)) {
      lastDishName = "";
      return "Open Feedback from the navigation to rate the website and leave a comment, or use its Contact Us details. Shared feedback works only after the site owner configures Supabase and runs the supplied database setup.";
    }
    const group = ["Luzon", "Visayas", "Mindanao"].find((region) =>
      q.includes(region.toLowerCase()),
    );
    const isRecommendation =
      /\b(recommend|suggest|try|like|prefer|craving)\b/.test(q);
    if (
      (/\b(list|show|all)\b/.test(q) && /\b(dishes|foods|recipes)\b/.test(q)) ||
      (group && /\b(dishes|foods|recipes)\b/.test(q))
    ) {
      const matchingDishes = group
        ? dishes.filter((dish) => dish.region === group)
        : dishes;
      const heading = group ? `${group} dishes` : "All dishes on the site";
      lastDishName = "";
      return `${heading}: ${matchingDishes.map((dish) => `${dish.name} (${dish.origin})`).join("; ")}.`;
    }
    const openDishName = document.querySelector(
      "#dish-modal.open #modal-title",
    )?.textContent;
    const currentDishName = openDishName || lastDishName;
    const asksDishDetail =
      /\b(ingredient|made of|contain|prepare|cook|recipe|steps|video|watch|origin|where|region|describe|tell me more|what about)\b/.test(
        q,
      );
    const mentionsCurrentDish =
      /\b(this dish|that dish|it|its ingredients|its origin|what about)\b/.test(q) ||
      (!isRecommendation && Boolean(lastDishName) && asksDishDetail);
    const matchedDishes = findDishMatches(question);
    if (
      matchedDishes.length > 1 &&
      /\b(compare|comparison|difference|different|between|versus|vs)\b/.test(q)
    ) {
      lastDishName = matchedDishes[0].name;
      return matchedDishes
        .slice(0, 2)
        .map(
          (item) =>
            `${item.name} (${item.origin}): ${item.description} Key ingredients: ${item.ingredients}.`,
        )
        .join("\n\n");
    }
    const dish =
      matchedDishes[0] ||
      (mentionsCurrentDish && currentDishName
        ? dishes.find((item) => item.name === currentDishName)
        : null);
    if (dish) {
      lastDishName = dish.name;
      const asksFor = /ingredient|made of|contain/.test(q)
        ? `Ingredients: ${dish.ingredients}.`
        : /prepare|cook|recipe|steps/.test(q)
          ? `Preparation: ${(preparationByDish[dish.name] || []).join(" ")}`
          : /video|watch|youtube/.test(q)
            ? `Preparation video: https://www.youtube.com/watch?v=${dish.youtubeVideoId}${dish.video ? `. Additional video: ${dish.video}` : ""}${dish.videoCredit ? `. Credit: ${dish.videoCredit}` : ""}`
            : /origin|where|region|from/.test(q)
              ? `${dish.name} comes from ${dish.origin}. ${dish.description}`
              : `${dish.name} is from ${dish.origin}. ${dish.description} Ingredients: ${dish.ingredients}. Preparation: ${(preparationByDish[dish.name] || []).join(" ")} Image: ${dish.image}. Video: https://www.youtube.com/watch?v=${dish.youtubeVideoId}.`;
      return asksFor;
    }

    const words = [...new Set(queryWords(question))];
    if (isRecommendation && words.length) {
      const recommendations = dishes
        .map((item) => {
          const searchable = normalize(
            `${item.name} ${item.region} ${item.origin} ${item.ingredients} ${item.description} ${dishTags[item.name] || ""}`,
          );
          const score = words.reduce(
            (total, word) => total + (searchable.includes(word) ? 1 : 0),
            0,
          );
          return { item, score };
        })
        .filter(
          ({ item, score }) => score > 0 && (!group || item.region === group),
        )
        .sort((left, right) => right.score - left.score)
        .slice(0, 3);
      if (recommendations.length) {
        lastDishName = recommendations[0].item.name;
        const topScore = recommendations[0].score;
        return `Based on what you mentioned, you could try ${recommendations
          .filter(({ score }) => score === topScore)
          .map(
            ({ item }) =>
              `${item.name} (${item.origin}) — ${item.description}`,
          )
          .join(" ")}`;
      }
    }
    const currentSections = [
      ...document.querySelectorAll("main section, main article"),
    ].map((section) => ({
      title:
        section.querySelector("h1, h2, h3")?.innerText ||
        section.getAttribute("aria-label") ||
        "This page section",
      text: `${section.innerText} ${[...section.querySelectorAll("img[alt]")].map((image) => image.alt).join(" ")}`,
    }));
    const knowledge = [...siteKnowledge, ...currentSections];
    const results = knowledge
      .map((item) => {
        const text = normalize(`${item.title} ${item.text}`);
        const score =
          words.reduce(
            (total, word) => total + (text.includes(word) ? 1 : 0),
            0,
          ) + (q.includes(normalize(item.title)) ? 3 : 0);
        return { ...item, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (!results.length) {
      return "I couldn't find that in the website's content. I can answer questions about its dishes, ingredients, recipes, pages, features, or team.";
    }
    lastDishName = "";
    return results
      .map((item) => {
        const excerpt =
          item.text.length > 700
            ? `${item.text.slice(0, 700).trim()}…`
            : item.text;
        return `${item.title}: ${excerpt}`;
      })
      .join("\n\n");
  };
  const send = (text) => {
    if (isReplyPending) return;
    isReplyPending = true;
    input.disabled = true;
    sendButton.disabled = true;
    suggestions.forEach((button) => {
      button.disabled = true;
    });
    const user = document.createElement("article");
    user.className = "guide-message guide-user";
    user.textContent = text;
    stamp(user);
    messages.append(user);
    const typing = document.createElement("article");
    typing.className = "guide-message guide-typing";
    typing.textContent = "Searching the site…";
    messages.append(typing);
    messages.scrollTop = messages.scrollHeight;
    activeReplyTimer = window.setTimeout(() => {
      typing.textContent = answerFor(text);
      typing.classList.remove("guide-typing");
      stamp(typing);
      isReplyPending = false;
      activeReplyTimer = 0;
      input.disabled = false;
      sendButton.disabled = false;
      suggestions.forEach((button) => {
        button.disabled = false;
      });
      while (messages.children.length > 61) {
        messages.children[1]?.remove();
      }
      messages.scrollTop = messages.scrollHeight;
    }, 450);
  };
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    send(text);
    input.value = "";
  });
  widget
    .querySelectorAll(".food-guide-suggestions button")
    .forEach((button) =>
      button.addEventListener("click", () => send(button.textContent.trim())),
    );
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) close();
  });
}

if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", initFoodGuide);
else initFoodGuide();

function initSiteMusic() {
  if (document.querySelector(".site-music")) return;
  const config = window.TAHAK_MUSIC_CONFIG || {};
  const player = document.createElement("aside");
  player.className = "site-music";
  player.setAttribute("aria-label", "Website music player");

  const audio = document.createElement("audio");
  audio.loop = true;
  audio.preload = "metadata";
  if (typeof config.src === "string" && config.src.trim()) {
    audio.src = config.src.trim();
  }

  const heading = document.createElement("strong");
  heading.className = "site-music-title";
  heading.textContent = config.title || "Website music";

  const controls = document.createElement("div");
  controls.className = "site-music-controls";
  const playButton = document.createElement("button");
  playButton.type = "button";
  playButton.className = "site-music-play";
  playButton.textContent = "Play";
  playButton.setAttribute("aria-label", "Play background music");
  playButton.disabled = !audio.src;

  const muteButton = document.createElement("button");
  muteButton.type = "button";
  muteButton.className = "site-music-mute";
  muteButton.textContent = "Mute";
  muteButton.setAttribute("aria-label", "Mute background music");

  const volumeLabel = document.createElement("label");
  volumeLabel.className = "site-music-volume-label";
  volumeLabel.textContent = "Volume";
  const volumeControl = document.createElement("input");
  volumeControl.type = "range";
  volumeControl.min = "0";
  volumeControl.max = "1";
  volumeControl.step = "0.05";
  volumeControl.value = "0.4";
  volumeControl.setAttribute("aria-label", "Music volume");
  const status = document.createElement("span");
  status.className = "site-music-status";
  status.setAttribute("role", "status");
  status.textContent = audio.src ? "Music is off." : "Add an audio path in Javascript/music-config.js.";
  volumeLabel.append(volumeControl);
  controls.append(playButton, muteButton, volumeLabel);
  player.append(heading, controls, status, audio);
  document.body.append(player);
  audio.volume = Number(volumeControl.value);

  try {
    const savedVolumeValue = localStorage.getItem("tahak-music-volume");
    if (savedVolumeValue !== null) {
      const savedVolume = Number(savedVolumeValue);
      if (Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 1) {
        audio.volume = savedVolume;
        volumeControl.value = String(savedVolume);
      }
    }
    const muted = localStorage.getItem("tahak-music-muted") === "true";
    audio.muted = muted;
    muteButton.textContent = muted ? "Unmute" : "Mute";
    muteButton.setAttribute("aria-label", `${muted ? "Unmute" : "Mute"} background music`);
  } catch (error) {
    console.warn("Music preferences are unavailable in this browser.", error);
  }

  const updatePlayState = () => {
    const isPlaying = !audio.paused;
    playButton.textContent = isPlaying ? "Pause" : "Play";
    playButton.setAttribute(
      "aria-label",
      `${isPlaying ? "Pause" : "Play"} background music`,
    );
    status.textContent = isPlaying ? "Music is playing." : "Music is off.";
  };

  playButton.addEventListener("click", async () => {
    if (!audio.src) {
      status.textContent = "Add an audio path in Javascript/music-config.js.";
      return;
    }
    try {
      if (audio.paused) await audio.play();
      else audio.pause();
      updatePlayState();
    } catch (error) {
      console.error("Unable to play the configured website music.", error);
      status.textContent = "Music could not be played. Check the audio file path and format.";
    }
  });

  audio.addEventListener("play", updatePlayState);
  audio.addEventListener("pause", updatePlayState);
  audio.addEventListener("error", () => {
    status.textContent = "Music could not be loaded. Check the audio file path and format.";
  });
  volumeControl.addEventListener("input", () => {
    audio.volume = Number(volumeControl.value);
    if (audio.volume > 0 && audio.muted) {
      audio.muted = false;
      muteButton.textContent = "Mute";
      muteButton.setAttribute("aria-label", "Mute background music");
    }
    try {
      localStorage.setItem("tahak-music-volume", String(audio.volume));
    } catch (error) {
      console.warn("Unable to save the music volume preference.", error);
    }
  });
  muteButton.addEventListener("click", () => {
    audio.muted = !audio.muted;
    muteButton.textContent = audio.muted ? "Unmute" : "Mute";
    muteButton.setAttribute(
      "aria-label",
      `${audio.muted ? "Unmute" : "Mute"} background music`,
    );
    try {
      localStorage.setItem("tahak-music-muted", String(audio.muted));
    } catch (error) {
      console.warn("Unable to save the music mute preference.", error);
    }
  });
}

initSiteMusic();

function initFoodAmbience() {
  if (document.querySelector(".food-ambience")) return;
  const layer = document.createElement("div");
  layer.className = "food-ambience";
  layer.setAttribute("aria-hidden", "true");
  layer.innerHTML =
    "<span>🍲</span><span>🌶️</span><span>🧄</span><span>🍚</span><span>🥬</span><span>🧅</span><span>🍋</span><span>🫚</span>";
  document.body.prepend(layer);
  const ingredients = [...layer.querySelectorAll("span")];
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    let frame = 0;
    const updateParallax = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        ingredients.forEach((item, index) =>
          item.style.setProperty(
            "--parallax",
            `${-Math.min(window.scrollY * (index % 2 ? 0.018 : 0.01), 28)}px`,
          ),
        );
        frame = 0;
      });
    };
    window.addEventListener("scroll", updateParallax, { passive: true });
    updateParallax();
  }
  document.querySelectorAll("img:not([loading])").forEach((image) => {
    image.setAttribute(
      "loading",
      image.getBoundingClientRect().top < window.innerHeight ? "eager" : "lazy",
    );
  });
  document.querySelectorAll("img").forEach((image) => {
    if (image.closest(".logo, .dish-card") || image.id === "modal-image")
      return;
    image.addEventListener(
      "error",
      () => {
        if (
          image.dataset.fallbackApplied ||
          image.getAttribute("src") === "img/1st.jpg"
        )
          return;
        image.dataset.fallbackApplied = "true";
        image.src = "img/1st.jpg";
        image.alt = "A collection of Filipino dishes";
        image.classList.add("image-fallback");
      },
      { once: true },
    );
  });
}
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", initFoodAmbience);
else initFoodAmbience();

function initOpeningIntro() {
  if (document.querySelector(".opening-intro")) return;
  const intro = document.createElement("div");
  intro.className = "opening-intro";
  intro.setAttribute("role", "status");
  intro.setAttribute("aria-label", "Welcome to Tahak sa Panlasa");
  intro.innerHTML = `<div class="opening-intro-inner"><p class="opening-kicker">A world of food and culture, starting in the Philippines</p><h1>Tahak <span>sa</span><br>Panlasa</h1><div class="opening-food"><img src="img/1st.jpg" alt="A colorful collection of Filipino dishes" fetchpriority="high"><span aria-hidden="true">🍋</span><span aria-hidden="true">🌶️</span></div><p class="opening-caption">Our first table, with the world to come.</p><button class="opening-skip" type="button">Skip intro</button></div>`;
  document.body.append(intro);
  const dismiss = () => {
    if (intro.classList.contains("is-leaving")) return;
    intro.classList.add("is-leaving");
    window.setTimeout(() => {
      intro.remove();
      document.body.classList.add("intro-complete");
    }, 520);
  };
  intro.querySelector(".opening-skip").addEventListener("click", dismiss);
  intro.querySelector(".opening-skip").focus({ preventScroll: true });
  const onKey = (event) => {
    if (event.key === "Escape") {
      dismiss();
      document.removeEventListener("keydown", onKey);
    }
  };
  document.addEventListener("keydown", onKey);
  window.setTimeout(() => {
    dismiss();
    document.removeEventListener("keydown", onKey);
  }, 1900);
}
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", initOpeningIntro);
else initOpeningIntro();
