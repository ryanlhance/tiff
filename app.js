/* =========================================================
   TIFF Fit Map renderer
   Pure renderer over data.json. No JD/resume content is
   hardcoded here; edit copy in data.json (or build_data.py).
   Supports multiple roles as tabs: data.roles is an array of
   {id, tab_label, job, jd_prose}; evidence is shared.
   ========================================================= */
(function () {
  "use strict";

  var DATA = null;
  var ROLES = [];              // data.roles
  var currentRole = null;      // the role whose JD is on screen
  var PHRASE_INDEX = {};       // phrase id -> {phrase, roleId} (all roles)
  var activePhraseEl = null;   // currently-selected phrase button
  var lastFocused = null;      // element to restore focus to on close

  var el = {
    postingLink:  document.getElementById("posting-link"),
    roleTabsNav:  document.getElementById("role-tabs-nav"),
    roleTabs:     document.getElementById("role-tabs"),
    jobTitle:     document.getElementById("job-title"),
    jobLocation:  document.getElementById("job-location-text"),
    kicker:       document.getElementById("candidate-kicker"),
    lede:         document.getElementById("candidate-lede"),
    stat:         document.getElementById("candidate-stat"),
    jdRoot:       document.getElementById("jd-root"),
    peek:         document.getElementById("peek"),
    peekPanel:    document.querySelector(".peek-panel"),
    peekScrim:    document.getElementById("peek-scrim"),
    peekClose:    document.getElementById("peek-close"),
    peekEmpty:    document.getElementById("peek-empty"),
    peekContent:  document.getElementById("peek-content"),
    peekHeading:  document.getElementById("peek-heading"),
    peekCards:    document.getElementById("peek-cards"),
    loadError:    document.getElementById("load-error")
  };

  // ---------- boot ----------
  fetch("./data.json")
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (data) {
      DATA = data;
      // roles array; fall back to a single legacy {job, jd_prose} shape
      ROLES = data.roles || [{ id: "role", job: data.job, jd_prose: data.jd_prose }];
      buildPhraseIndex();
      renderTabs();
      selectRole(ROLES[0].id, false);
      wireGlobalEvents();
      openFromHash();
    })
    .catch(showLoadError);

  function buildPhraseIndex() {
    ROLES.forEach(function (role) {
      (role.jd_prose || []).forEach(function (block) {
        (block.segments || []).forEach(function (seg) {
          if (seg && seg.id) PHRASE_INDEX[seg.id] = { phrase: seg, roleId: role.id };
        });
      });
    });
  }

  // ---------- tabs ----------
  function renderTabs() {
    if (ROLES.length < 2) {
      if (el.roleTabsNav) el.roleTabsNav.hidden = true;
      return;
    }
    el.roleTabs.innerHTML = "";
    ROLES.forEach(function (role) {
      var tab = document.createElement("button");
      tab.className = "role-tab";
      tab.id = "tab-" + role.id;
      tab.type = "button";
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", "false");
      tab.setAttribute("aria-controls", "jd-root");
      tab.tabIndex = -1;
      tab.textContent = role.tab_label || (role.job && role.job.role) || role.id;
      tab.addEventListener("click", function () { selectRole(role.id, true); });
      tab.addEventListener("keydown", function (e) { onTabKeydown(e, role.id); });
      el.roleTabs.appendChild(tab);
    });
  }

  function onTabKeydown(e, roleId) {
    var idx = ROLES.findIndex(function (r) { return r.id === roleId; });
    var next = null;
    if (e.key === "ArrowRight") next = ROLES[(idx + 1) % ROLES.length];
    else if (e.key === "ArrowLeft") next = ROLES[(idx - 1 + ROLES.length) % ROLES.length];
    else if (e.key === "Home") next = ROLES[0];
    else if (e.key === "End") next = ROLES[ROLES.length - 1];
    if (next) {
      e.preventDefault();
      selectRole(next.id, true);
      var btn = document.getElementById("tab-" + next.id);
      if (btn) btn.focus();
    }
  }

  function selectRole(roleId, updateHash) {
    var role = ROLES.find(function (r) { return r.id === roleId; });
    if (!role || role === currentRole) {
      if (role && updateHash) setHash(role.id);
      return;
    }
    currentRole = role;

    // tab states
    ROLES.forEach(function (r) {
      var tab = document.getElementById("tab-" + r.id);
      if (!tab) return;
      var on = r.id === roleId;
      tab.setAttribute("aria-selected", on ? "true" : "false");
      tab.classList.toggle("is-selected", on);
      tab.tabIndex = on ? 0 : -1;
    });

    closePeek(false, true); // reset the peek; hash is handled below
    renderHeader();
    renderProse();
    if (updateHash) setHash(role.id);
  }

  function setHash(value) {
    // default role with no phrase selected keeps a clean URL
    var clean = (value === ROLES[0].id) ? location.pathname + location.search : "#" + value;
    if (history.replaceState) history.replaceState(null, "", clean);
    else location.hash = value;
  }

  // ---------- render ----------
  function renderHeader() {
    var job = currentRole.job || {};

    if (job.tab_title) document.title = job.tab_title;

    if (job.url) {
      el.postingLink.href = job.url;
      el.postingLink.style.display = "";
    } else {
      el.postingLink.style.display = "none";
    }

    el.jobTitle.textContent =
      (job.role || "") + (job.employment ? " (" + job.employment + ")" : "");
    el.jobLocation.textContent =
      (job.location || "") + (job.employment ? " · " + job.employment : "");
    el.kicker.textContent = job.candidate_kicker || (DATA.meta && DATA.meta.candidate) || "";
    el.lede.textContent = job.candidate_lede || "";
    el.stat.textContent = job.candidate_stat || "";
  }

  function renderProse() {
    var blocks = currentRole.jd_prose || [];
    var frag = document.createDocumentFragment();
    var ulBuffer = null; // collect consecutive <li> blocks into one <ul>

    function flushList() {
      if (ulBuffer) { frag.appendChild(ulBuffer); ulBuffer = null; }
    }

    blocks.forEach(function (block) {
      if (block.type === "li") {
        if (!ulBuffer) { ulBuffer = document.createElement("ul"); ulBuffer.className = "jd-ul"; }
        var li = document.createElement("li");
        li.className = "jd-li";
        appendSegments(li, block.segments || []);
        ulBuffer.appendChild(li);
        return;
      }

      flushList();

      if (block.type === "h2") {
        var h2 = document.createElement("h2");
        h2.className = "jd-h2";
        h2.textContent = block.text || "";
        frag.appendChild(h2);
      } else if (block.type === "h3") {
        var h3 = document.createElement("h3");
        h3.className = "jd-h3";
        h3.textContent = block.text || "";
        frag.appendChild(h3);
      } else { // paragraph
        var p = document.createElement("p");
        p.className = "jd-p";
        appendSegments(p, block.segments || []);
        frag.appendChild(p);
      }
    });
    flushList();

    el.jdRoot.innerHTML = "";
    el.jdRoot.appendChild(frag);
  }

  // Renders an array of segments (strings, {b}, or phrase objects) into a parent node.
  function appendSegments(parent, segments) {
    segments.forEach(function (seg) {
      if (typeof seg === "string") {
        parent.appendChild(document.createTextNode(seg));
      } else if (seg && seg.b) {
        var strong = document.createElement("span");
        strong.className = "jd-strong";
        strong.textContent = seg.b;
        parent.appendChild(strong);
      } else if (seg && seg.id) {
        parent.appendChild(buildPhraseButton(seg));
      }
    });
  }

  function buildPhraseButton(phrase) {
    // A <span role="button"> (not a real <button>) so the phrase wraps
    // across lines like normal prose; buttons are atomic boxes and
    // break the text flow on narrow screens.
    var btn = document.createElement("span");
    btn.className = "phrase";
    btn.id = "phrase-" + phrase.id;
    btn.setAttribute("role", "button");
    btn.tabIndex = 0;
    btn.setAttribute("data-phrase-id", phrase.id);
    btn.setAttribute("aria-haspopup", "true");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", phrase.text + ". Show the experience behind this.");
    btn.textContent = phrase.text;

    btn.addEventListener("click", function () { openPeek(phrase, btn, true); });
    btn.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        openPeek(phrase, btn, true);
      }
    });
    return btn;
  }

  // ---------- peek ----------
  function openPeek(phrase, phraseEl, updateHash) {
    if (activePhraseEl && activePhraseEl !== phraseEl) {
      activePhraseEl.classList.remove("is-active");
      activePhraseEl.setAttribute("aria-expanded", "false");
    }
    activePhraseEl = phraseEl;
    if (phraseEl) {
      phraseEl.classList.add("is-active");
      phraseEl.setAttribute("aria-expanded", "true");
    }
    lastFocused = phraseEl;

    el.peekHeading.textContent = phrase.text;

    el.peekCards.innerHTML = "";
    (phrase.evidence || []).forEach(function (id) {
      var card = buildEvidenceCard(id);
      if (card) el.peekCards.appendChild(card);
    });

    el.peekEmpty.hidden = true;
    el.peekContent.hidden = false;
    el.peekClose.hidden = false;
    el.peek.classList.add("is-open");
    el.peekPanel.scrollTop = 0;

    if (updateHash) {
      if (history.replaceState) history.replaceState(null, "", "#" + phrase.id);
      else location.hash = phrase.id;
    }

    var focusTarget = el.peekClose && !el.peekClose.hidden ? el.peekClose : el.peekPanel;
    window.requestAnimationFrame(function () { focusTarget.focus(); });
  }

  function buildEvidenceCard(id) {
    var ev = DATA.evidence && DATA.evidence[id];
    if (!ev) return null;

    var card = document.createElement("article");
    card.className = "ev-card";

    var title = document.createElement("p");
    title.className = "ev-card-title";
    title.textContent = ev.title || "";
    card.appendChild(title);

    if (ev.years) {
      var years = document.createElement("p");
      years.className = "ev-card-years";
      years.textContent = ev.years;
      card.appendChild(years);
    }

    var text = document.createElement("p");
    text.className = "ev-card-text";
    text.textContent = ev.text || "";
    card.appendChild(text);

    if (ev.link) {
      var a = document.createElement("a");
      a.className = "ev-card-link";
      a.href = ev.link;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.innerHTML = "View case study <span aria-hidden=\"true\">↗</span>";
      card.appendChild(a);
    }
    return card;
  }

  function closePeek(restoreFocus, keepHash) {
    el.peek.classList.remove("is-open");
    el.peekContent.hidden = true;
    el.peekClose.hidden = true;
    el.peekEmpty.hidden = false;

    if (activePhraseEl) {
      activePhraseEl.classList.remove("is-active");
      activePhraseEl.setAttribute("aria-expanded", "false");
    }
    activePhraseEl = null;

    if (!keepHash && currentRole) setHash(currentRole.id);
    if (restoreFocus && lastFocused && document.contains(lastFocused)) {
      lastFocused.focus();
    }
    lastFocused = null;
  }

  // ---------- events ----------
  function wireGlobalEvents() {
    el.peekClose.addEventListener("click", function () { closePeek(true); });
    el.peekScrim.addEventListener("click", function () { closePeek(true); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && el.peek.classList.contains("is-open")) closePeek(true);
    });
    window.addEventListener("hashchange", openFromHash);
  }

  function openFromHash() {
    var id = (location.hash || "").replace(/^#/, "");
    if (!id) return;

    // a role id selects its tab
    if (ROLES.some(function (r) { return r.id === id; })) {
      selectRole(id, false);
      return;
    }

    // a phrase id switches to its role first, then opens the peek
    var entry = PHRASE_INDEX[id];
    if (!entry) return;
    if (!currentRole || currentRole.id !== entry.roleId) selectRole(entry.roleId, false);

    var btn = document.getElementById("phrase-" + id);
    if (btn) {
      btn.scrollIntoView({ behavior: "smooth", block: "center" });
      openPeek(entry.phrase, btn, false);
    }
  }

  // ---------- error ----------
  function showLoadError(err) {
    el.loadError.hidden = false;
    el.loadError.innerHTML =
      "<strong>Couldn't load data.json.</strong><br>" +
      "This page reads its content from <code>data.json</code> via <code>fetch()</code>, " +
      "which the browser blocks over <code>file://</code>. " +
      "Serve the folder over http instead, e.g. run <code>python3 serve.py 8000</code> " +
      "in this folder and open <code>http://localhost:8000/</code>, or view it on GitHub Pages.<br><br>" +
      "<small>Details: " + (err && err.message ? err.message : err) + "</small>";
  }
})();
