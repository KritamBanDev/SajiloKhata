/* SajiloKhata Shared Layout v3 — Premium header / footer */
(function () {
  var navLinks = [
    { href: '/', label: 'Home' },
    { href: '/site/about.html', label: 'About' },
    { href: '/site/contact.html', label: 'Contact' },
    { href: '/site/privacy.html', label: 'Privacy' },
    { href: '/site/terms.html', label: 'Terms' },
    { href: '/login', label: 'Login', cta: true }
  ];

  function normalizePath(path) {
    if (!path || path === '/') return '/';
    if (path === '/site/' || path === '/site') return '/site/about.html';
    return path;
  }

  function buildNav(currentPath) {
    var normalizedCurrent = normalizePath(currentPath);
    return navLinks
      .map(function (item) {
        var active = normalizedCurrent === item.href ? ' is-active' : '';
        var cta    = item.cta ? ' nav-cta' : '';
        return '<a class="nav-link' + active + cta + '" href="' + item.href + '">' + item.label + '</a>';
      })
      .join('');
  }

  function renderHeader() {
    var currentPath = window.location.pathname || '';
    var host = document.querySelector('[data-sk-header]');
    if (!host) return;

    host.innerHTML =
      '<header class="site-header">' +
        '<div class="site-container site-header-inner">' +
          '<a class="brand-mark" href="/" aria-label="SajiloKhata home">' +
            '<img class="brand-badge" src="/images/logo.svg" width="34" height="34" alt="" aria-hidden="true">' +
            '<span>SajiloKhata</span>' +
          '</a>' +
          '<button class="mobile-nav-toggle" type="button" aria-label="Toggle navigation menu" data-nav-toggle>' +
            '<span></span><span></span><span></span>' +
          '</button>' +
          '<nav class="site-nav" aria-label="Primary navigation" data-site-nav>' +
            buildNav(currentPath) +
          '</nav>' +
        '</div>' +
      '</header>';

    var toggle = host.querySelector('[data-nav-toggle]');
    var nav    = host.querySelector('[data-site-nav]');
    if (toggle && nav) {
      toggle.addEventListener('click', function () {
        var open = nav.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      nav.querySelectorAll('.nav-link').forEach(function (link) {
        link.addEventListener('click', function () {
          nav.classList.remove('is-open');
          toggle.setAttribute('aria-expanded', 'false');
        });
      });
    }
  }

  function renderFooter() {
    var host = document.querySelector('[data-sk-footer]');
    if (!host) return;

    host.innerHTML =
      '<footer class="site-footer">' +
        '<div class="site-container site-footer-grid">' +
          '<div class="footer-brand-col">' +
            '<div class="footer-logo">' +
              '<img class="footer-brand-badge" src="/images/logo.svg" width="34" height="34" alt="" aria-hidden="true">' +
              '<span class="footer-brand-name">SajiloKhata</span>' +
            '</div>' +
            '<p class="footer-tagline">Smart digital business management built for Nepalese retailers and SMEs.</p>' +
          '</div>' +
          '<div>' +
            '<h3 class="footer-title">Product</h3>' +
            '<ul class="footer-links">' +
              '<li><a class="footer-link" href="/login">Launch App</a></li>' +
              '<li><a class="footer-link" href="/site/about.html">About</a></li>' +
              '<li><a class="footer-link" href="/site/contact.html">Contact</a></li>' +
            '</ul>' +
          '</div>' +
          '<div>' +
            '<h3 class="footer-title">Legal</h3>' +
            '<ul class="footer-links">' +
              '<li><a class="footer-link" href="/site/privacy.html">Privacy Policy</a></li>' +
              '<li><a class="footer-link" href="/site/terms.html">Terms of Service</a></li>' +
            '</ul>' +
          '</div>' +
          '<div>' +
            '<h3 class="footer-title">Support</h3>' +
            '<ul class="footer-links">' +
              '<li><a class="footer-link" href="/site/contact.html">Get Help</a></li>' +
              '<li><a class="footer-link" href="/site/contact.html">Report Issue</a></li>' +
            '</ul>' +
          '</div>' +
        '</div>' +
        '<div class="site-container footer-bottom">' +
          '<p class="footer-bottom-text">© <span data-year></span> SajiloKhata. All rights reserved. Built for Nepal 🇳🇵</p>' +
          '<div class="footer-bottom-links">' +
            '<a class="footer-bottom-link" href="/site/privacy.html">Privacy</a>' +
            '<a class="footer-bottom-link" href="/site/terms.html">Terms</a>' +
            '<a class="footer-bottom-link" href="/site/contact.html">Contact</a>' +
          '</div>' +
        '</div>' +
      '</footer>';

    var yearNode = host.querySelector('[data-year]');
    if (yearNode) yearNode.textContent = String(new Date().getFullYear());
  }

  function initReveal() {
    var items = document.querySelectorAll('.reveal');
    if (!items.length || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    items.forEach(function (item) { observer.observe(item); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderHeader();
    renderFooter();
    initReveal();
  });
})();

