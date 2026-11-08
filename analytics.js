/* Public site identifier; never send file or conversion data to analytics. */
(() => {
  'use strict';
  if (location.protocol !== 'https:' || location.hostname !== 'wooi.github.io' ||
      !/^\/soundport(?:\/|$)/.test(location.pathname)) return;

  const beacon = document.createElement('script');
  beacon.type = 'module';
  beacon.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  beacon.setAttribute('data-cf-beacon', JSON.stringify({
    token: '828e0db42a4b4ef299b5c8b9d1764fae'
  }));
  document.body.appendChild(beacon);
})();
