(function() {
  const OriginalNotification = window.Notification;

  function InterceptedNotification(title, options = {}) {
    window.dispatchEvent(new CustomEvent('AAIE_WA_NOTIFICATION', {
      detail: {
        title,
        body: options.body || '',
        tag: options.tag || String(Date.now()),
      }
    }));
    return new OriginalNotification(title, options);
  }

  InterceptedNotification.prototype = OriginalNotification.prototype;
  InterceptedNotification.permission = OriginalNotification.permission;
  InterceptedNotification.requestPermission = OriginalNotification.requestPermission.bind(OriginalNotification);

  window.Notification = InterceptedNotification;
  console.log('AAIE injector active');
})();