const channel = new BroadcastChannel('YOUR_CHANNEL_NAME');
channel.postMessage({ msg: 'Hello service worker from popup'});
