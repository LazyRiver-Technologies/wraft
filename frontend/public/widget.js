(function () {
  const scriptTag = document.currentScript || (function() {
    const scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();
  
  const botSlug = scriptTag.getAttribute('data-bot-slug');
  if (!botSlug) return console.error('Chat Widget: Missing data-bot-slug attribute.');

  // Guess the backend domain from the script src or default to relative if local
  let domain = 'http://localhost:8000';
  const scriptSrc = scriptTag.getAttribute('src');
  if (scriptSrc && scriptSrc.startsWith('http')) {
      const url = new URL(scriptSrc);
      // In production the next.js domain is the same frontend domain routing the API over rewriting. 
      // We will point exactly to the host origin.
      domain = url.origin;
  }

  // Define shadow host
  const host = document.createElement('div');
  host.id = 'lazyriver-chat-widget-host';
  // Ensure it overlays correctly unconditionally
  host.style.position = 'fixed';
  host.style.zIndex = '2147483647';
  host.style.bottom = '0';
  host.style.left = '0';
  host.style.right = '0';
  host.style.width = '100%';
  host.style.height = '100%';
  host.style.pointerEvents = 'none'; // click-through empty space
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  let isOpen = false;

  const style = document.createElement('style');
  shadow.appendChild(style);

  const container = document.createElement('div');
  shadow.appendChild(container);

  async function init() {
    try {
      // In development Nextjs uses 3000, API uses 8000. 
      // Usually domain is the frontend host for the iframe, so we'll explicitly route API to 8000 if localhost:3000 is detected.
      let apiUrl = `${domain}/api/v1/chat/${botSlug}/appearance`;
      if (domain.includes('localhost:3000')) {
          apiUrl = 'http://localhost:8000/api/v1/chat/' + botSlug + '/appearance';
      }

      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error('API Error');
      const appearance = await res.json();

      const themeColor = appearance.theme_color || '#4f46e5';
      const position = appearance.position || 'bottom-right';

      const isRight = position === 'bottom-right';
      
      style.textContent = `
        .widget-button {
          position: fixed;
          bottom: 24px;
          ${isRight ? 'right: 24px;' : 'left: 24px;'}
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background-color: ${themeColor};
          color: white;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s;
          pointer-events: auto;
          z-index: 9999;
        }
        .widget-button:hover {
          transform: scale(1.05);
        }
        .widget-button svg {
          width: 24px;
          height: 24px;
          fill: currentColor;
        }
        
        .widget-iframe-container {
          position: fixed;
          bottom: 90px;
          ${isRight ? 'right: 24px;' : 'left: 24px;'}
          width: 380px;
          height: 600px;
          max-height: calc(100vh - 120px);
          max-width: calc(100vw - 48px);
          background: white;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.15);
          overflow: hidden;
          opacity: 0;
          pointer-events: none;
          transform: translateY(10px);
          transition: opacity 0.3s, transform 0.3s;
          z-index: 9998;
          border: 1px solid #e2e8f0;
        }
        
        .widget-iframe-container.open {
          opacity: 1;
          pointer-events: auto;
          transform: translateY(0);
        }
        
        iframe {
          width: 100%;
          height: 100%;
          border: none;
        }
        
        @media (max-width: 480px) {
           .widget-iframe-container {
               width: calc(100vw - 32px);
               ${isRight ? 'right: 16px;' : 'left: 16px;'}
               bottom: 80px;
           }
           .widget-button {
               ${isRight ? 'right: 16px;' : 'left: 16px;'}
               bottom: 16px;
           }
        }
      `;

      // Icon SVGs
      const chatIcon = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>';
      const closeIcon = '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>';

      const btn = document.createElement('button');
      btn.className = 'widget-button';
      btn.innerHTML = chatIcon;
      container.appendChild(btn);

      const iframeWrapper = document.createElement('div');
      iframeWrapper.className = 'widget-iframe-container';
      
      const iframe = document.createElement('iframe');
      // Set the src to the Next.js frontend route that renders the UI
      iframe.src = `${domain}/widget/${botSlug}`;
      iframeWrapper.appendChild(iframe);
      container.appendChild(iframeWrapper);

      btn.addEventListener('click', () => {
        isOpen = !isOpen;
        if (isOpen) {
          iframeWrapper.classList.add('open');
          btn.innerHTML = closeIcon;
        } else {
          iframeWrapper.classList.remove('open');
          btn.innerHTML = chatIcon;
        }
      });

    } catch (e) {
      console.error("Chat Widget initialization failed: ", e);
    }
  }

  init();
})();
