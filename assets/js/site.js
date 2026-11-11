(function () {
  var root = document.documentElement;

  /* Theme toggle: follows the system setting until the visitor picks one. */
  function isDark() {
    var t = root.getAttribute("data-theme");
    if (t) return t === "dark";
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  var toggle = document.querySelector(".theme-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = isDark() ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
    });
  }

  /* Links to other sites, and the CV, open in a new tab. */
  document.querySelectorAll("a[href]").forEach(function (a) {
    var external = /^https?:/.test(a.protocol) && a.hostname !== location.hostname;
    if (external || /\.pdf$/i.test(a.pathname)) {
      a.target = "_blank";
      a.rel = "noopener";
    }
  });

  /* Posts: contents list built from the ## and ### headings. */
  var toc = document.querySelector(".toc");
  var content = document.querySelector(".post-content");
  if (toc && content) {
    var heads = content.querySelectorAll("h2[id], h3[id]");
    if (heads.length >= 3) {
      var list = document.createElement("ul");
      var current = null;
      heads.forEach(function (h) {
        var li = document.createElement("li");
        var a = document.createElement("a");
        a.href = "#" + h.id;
        a.textContent = h.textContent;
        li.appendChild(a);
        if (h.tagName === "H2" || !current) {
          list.appendChild(li);
          current = li;
        } else {
          var sub = current.querySelector("ul");
          if (!sub) { sub = document.createElement("ul"); current.appendChild(sub); }
          sub.appendChild(li);
        }
      });
      toc.querySelector(".toc-list").appendChild(list);
      toc.hidden = false;
    }
  }

  /* Posts: math written as $$...$$ (inline or on its own line). */
  function renderMath() {
    if (!content || typeof renderMathInElement !== "function") return;
    renderMathInElement(content, {
      delimiters: [
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false },
        { left: "$$", right: "$$", display: true }
      ],
      throwOnError: false
    });
  }
  if (content) {
    if (typeof renderMathInElement === "function") renderMath();
    else window.addEventListener("load", renderMath);
  }
})();
