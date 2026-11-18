// Loaded as a classic script before the game module (cards/index.html).
// 1) Small fills for older iPad Safari (before iPadOS 15.4): Array.prototype.at, Object.hasOwn.
// 2) If the game does not start, or a script error happens, show what went wrong and which Safari this is, so a parent
//    can send one screenshot. Nothing here reads or writes the children's records.
(function () {
  if (!Array.prototype.at) {
    Object.defineProperty(Array.prototype, 'at', { configurable: true, writable: true, value: function (i) { i = Math.trunc(i) || 0; if (i < 0) i += this.length; return i < 0 || i >= this.length ? undefined : this[i]; } });
  }
  if (!Object.hasOwn) {
    Object.defineProperty(Object, 'hasOwn', { configurable: true, writable: true, value: function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); } });
  }
  var errors = [];
  function show(reason) {
    if (reason) errors.push(reason);
    var box = document.getElementById('bootfail');
    if (!box) {
      box = document.createElement('pre'); box.id = 'bootfail';
      box.style.cssText = 'white-space:pre-wrap;font:14px/1.4 sans-serif;margin:12px;padding:10px;border:3px solid #233F3A;background:#fff8ea;color:#233F3A;position:relative;z-index:50';
      (document.body || document.documentElement).appendChild(box);
    }
    box.textContent = '게임을 여는 중 문제가 생겼어요. 이 화면을 찍어 부모님께 보여 주세요.\n' + navigator.userAgent + '\n' + errors.slice(-5).join('\n');
  }
  window.addEventListener('error', function (e) { show((e.message || '오류') + ' @ ' + String(e.filename || '').split('/').pop() + ':' + (e.lineno || '')); });
  // A rejected promise is often harmless (a sound that could not play): only note it, and show it with a real failure.
  window.addEventListener('unhandledrejection', function (e) { var r = e.reason; errors.push('promise: ' + (r && r.message ? r.message : String(r))); var app = document.getElementById('app'); if (app && !app.children.length) show(); });
  window.setTimeout(function () { var app = document.getElementById('app'); if (app && !app.children.length) show('10초 동안 게임 화면을 만들지 못했어요'); }, 10000);
})();
