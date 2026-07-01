/* CREADOR DE APLICACIONES CON WEB - app.js */

(function () {
  // --- VERIFICACIÓN DE LANZAMIENTO DENTRO DE LA PWA ---
  const urlParams = new URLSearchParams(window.location.search);
  const runUrl = urlParams.get('run');

  if (runUrl) {
    // Si la URL contiene '?run=...', estamos cargando la PWA instalada de forma directa.
    // Ocultamos la UI del editor para mostrar el envoltorio standalone.
    document.getElementById('editor-ui').style.display = 'none';
    const launchOverlay = document.getElementById('launch-overlay');
    launchOverlay.classList.add('active');

    // Recuperamos parámetros personalizados
    const appName = urlParams.get('name') || 'Mi App';
    const themeColor = urlParams.get('theme') || '#00f2fe';
    const bgColor = urlParams.get('bg') || '#080810';
    const execMode = urlParams.get('mode') || 'redirect';
    
    // Aplicamos estilos visuales inmediatos al SplashScreen
    document.getElementById('launch-app-name').innerText = appName;
    document.body.style.backgroundColor = bgColor;
    launchOverlay.style.backgroundColor = bgColor;
    
    // Buscar si existe un icono guardado en local para esta URL o generar uno
    let savedIcon = '';
    try {
      const history = JSON.parse(localStorage.getItem('converter_history') || '[]');
      const match = history.find(app => app.url === runUrl);
      if (match && match.icon) {
        savedIcon = match.icon;
      }
    } catch (e) {
      console.error('Error cargando historial para icono:', e);
    }
    
    const iconEl = document.getElementById('launch-app-icon');
    if (savedIcon) {
      iconEl.style.backgroundImage = `url(${savedIcon})`;
    } else {
      // Generar icono rápido basado en la inicial
      const initials = appName.charAt(0).toUpperCase();
      iconEl.style.display = 'flex';
      iconEl.style.alignItems = 'center';
      iconEl.style.justifyContent = 'center';
      iconEl.style.background = `linear-gradient(135deg, ${themeColor}, #4facfe)`;
      iconEl.style.fontSize = '3rem';
      iconEl.style.color = '#fff';
      iconEl.style.fontWeight = '700';
      iconEl.innerText = initials;
    }

    // Configurar meta tags de color en caliente
    const metaTheme = document.getElementById('meta-theme-color');
    if (metaTheme) metaTheme.setAttribute('content', themeColor);

    // Esperar 2 segundos para emular la pantalla de inicio nativa y arrancar la web
    setTimeout(() => {
      if (execMode === 'iframe') {
        // Modo iframe inmersivo
        const container = document.getElementById('fullscreen-iframe-container');
        const iframe = document.getElementById('fullscreen-iframe');
        iframe.src = runUrl;
        container.style.display = 'block';
        
        iframe.onload = () => {
          // Ocultar SplashScreen cuando el iframe cargue
          launchOverlay.classList.remove('active');
        };
        
        // Manejar posibles errores o carga lenta
        setTimeout(() => {
          launchOverlay.classList.remove('active');
        }, 8000);
      } else {
        // Modo Redirección directa (100% de compatibilidad)
        document.getElementById('launch-status').innerText = 'Redireccionando...';
        window.location.replace(runUrl);
      }
    }, 2000);

    return; // Detener la ejecución del panel del constructor
  }

  // --- REGISTRO DEL SERVICE WORKER PARA LA WEB PRINCIPAL ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js')
        .then((reg) => console.log('Service Worker registrado correctamente', reg.scope))
        .catch((err) => console.warn('Fallo en el registro del Service Worker', err));
    });
  }

  // --- VARIABLES Y SELECTORES DE LA INTERFAZ ---
  const inputUrl = document.getElementById('app-url');
  const inputName = document.getElementById('app-name');
  const inputShortName = document.getElementById('app-short-name');
  const selectExecMode = document.getElementById('exec-mode');
  const themeColorPicker = document.getElementById('theme-color');
  const bgColorPicker = document.getElementById('bg-color');
  const themeColorVal = document.getElementById('theme-color-val');
  const bgColorVal = document.getElementById('bg-color-val');
  const presetDots = document.querySelectorAll('.preset-dot');
  
  // Icon Creator
  const canvas = document.getElementById('icon-canvas');
  const ctx = canvas.getContext('2d');
  const iconText = document.getElementById('icon-text');
  const iconShape = document.getElementById('icon-shape');
  const fileInput = document.getElementById('icon-file');
  const iconTabs = document.querySelectorAll('.icon-tab');
  
  // Acciones e Interfaces
  const btnInstall = document.getElementById('btn-install');
  const btnDownload = document.getElementById('btn-download');
  const btnApk = document.getElementById('btn-apk');
  const statusBanner = document.getElementById('status-banner');
  const statusText = document.getElementById('status-text');
  const previewTabs = document.querySelectorAll('.preview-tab-btn');
  const previewIframe = document.getElementById('preview-iframe');
  const iframeWarning = document.getElementById('iframe-warning');
  const iframeOpenBtn = document.getElementById('iframe-open-btn');
  const mockBrowserUrlText = document.getElementById('mock-browser-url-text');
  
  // Datos locales de estado
  let activeIconMode = 'canvas'; // canvas | upload
  let uploadedImage = null;
  let deferredPrompt = null;
  let activeManifestBlobUrl = null;

  // --- LOGICA DE EVENTO ANTES DE LA INSTALACIÓN (beforeinstallprompt) ---
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevenir el banner de instalación automático del navegador
    e.preventDefault();
    deferredPrompt = e;
    
    // Cambiar estado del banner a disponible
    statusBanner.className = 'status-banner ready';
    statusBanner.innerHTML = `
      <i class="fa-solid fa-circle-check"></i>
      <div id="status-text">
        ¡Entorno de instalación listo! Configura tu App y haz clic en <strong>Auto Instalar</strong>.
      </div>
    `;
    btnInstall.disabled = false;
  });

  // --- DIBUJAR ICONO EN CANVAS ---
  function drawIcon() {
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const themeColor = themeColorPicker.value;

    if (activeIconMode === 'upload' && uploadedImage) {
      // Dibujar imagen subida adaptada
      ctx.save();
      // Crear máscara según la forma seleccionada
      clipShape(ctx, width, height, iconShape.value);
      
      // Calcular proporciones de centrado para rellenar
      const scale = Math.max(width / uploadedImage.width, height / uploadedImage.height);
      const x = (width / 2) - (uploadedImage.width / 2) * scale;
      const y = (height / 2) - (uploadedImage.height / 2) * scale;
      
      ctx.drawImage(uploadedImage, x, y, uploadedImage.width * scale, uploadedImage.height * scale);
      ctx.restore();
    } else {
      // Modo Generador: crear degradado de fondo
      ctx.save();
      clipShape(ctx, width, height, iconShape.value);
      
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, themeColor);
      grad.addColorStop(1, '#0e0e1a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();

      // Dibujar el texto inicial
      const initialsText = iconText.value.toUpperCase() || inputName.value.substring(0, 2).toUpperCase() || 'W';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 240px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Sombra sutil del texto
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 15;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 10;
      
      ctx.fillText(initialsText, width / 2, height / 2 + 10);
      ctx.shadowColor = 'transparent';
    }

    // Actualizar previsualización en el teléfono simulado y el historial
    updatePreviewIcons();
  }

  function clipShape(context, w, h, shape) {
    context.beginPath();
    if (shape === 'circle') {
      context.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
    } else if (shape === 'rounded') {
      const radius = 80;
      context.roundRect(0, 0, w, h, radius);
    } else if (shape === 'squircle') {
      // Aproximación de squircle matemático con curvas bézier
      const radius = 135;
      context.roundRect(0, 0, w, h, radius);
    } else { // square
      context.rect(0, 0, w, h);
    }
    context.clip();
  }

  // Actualizar los elementos visuales que muestran el icono
  function updatePreviewIcons() {
    const dataUrl = canvas.toDataURL('image/png');
    
    // Aplicar a los elementos con clase 'current-app-icon-bg'
    const previewIcons = document.querySelectorAll('.current-app-icon-bg');
    previewIcons.forEach(icon => {
      icon.style.backgroundImage = `url(${dataUrl})`;
      icon.style.backgroundColor = 'transparent';
      icon.innerText = '';
    });
  }

  // --- MANEJO DE ENTRADAS DE DISEÑO ---
  function updateLiveLabels() {
    const name = inputName.value || 'Mi Aplicación';
    const shortName = inputShortName.value || name.substring(0, 10);
    
    // Actualizar etiquetas en el mockup
    const nameLabels = document.querySelectorAll('.current-app-name-label');
    nameLabels.forEach(label => {
      label.innerText = name;
    });

    const mockAppName = document.querySelector('.mock-app-name.current-app-name-label');
    if (mockAppName) mockAppName.innerText = shortName;

    // Actualizar inicial del icono de forma dinámica si no está escrita explícitamente
    if (activeIconMode === 'canvas' && iconText.value.length === 0) {
      drawIcon();
    }
  }

  // Manejadores de cambios
  inputName.addEventListener('input', () => {
    updateLiveLabels();
    if (iconText.value.length === 0) {
      drawIcon();
    }
  });

  inputShortName.addEventListener('input', updateLiveLabels);

  iconText.addEventListener('input', drawIcon);
  iconShape.addEventListener('change', drawIcon);

  themeColorPicker.addEventListener('input', (e) => {
    themeColorVal.innerText = e.target.value;
    
    // Actualizar color de acento de simulación del teléfono
    document.getElementById('phone-shell').style.borderColor = e.target.value;
    document.getElementById('phone-shell').style.boxShadow = `0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 4px rgba(255, 255, 255, 0.15), 0 0 30px ${e.target.value}40`;
    
    // Actualizar indicador de carga
    const loader = document.querySelector('.view-splash .splash-loader');
    if (loader) loader.style.borderTopColor = e.target.value;

    drawIcon();
  });

  bgColorPicker.addEventListener('input', (e) => {
    bgColorVal.innerText = e.target.value;
    document.getElementById('view-splash').style.backgroundColor = e.target.value;
  });

  // Presets de colores
  presetDots.forEach(dot => {
    dot.addEventListener('click', () => {
      presetDots.forEach(d => d.classList.remove('active'));
      dot.classList.add('active');

      const theme = dot.getAttribute('data-theme');
      const bg = dot.getAttribute('data-bg');

      themeColorPicker.value = theme;
      bgColorPicker.value = bg;
      themeColorVal.innerText = theme;
      bgColorVal.innerText = bg;

      document.getElementById('phone-shell').style.borderColor = theme;
      document.getElementById('phone-shell').style.boxShadow = `0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 4px rgba(255, 255, 255, 0.15), 0 0 30px ${theme}40`;
      document.getElementById('view-splash').style.backgroundColor = bg;

      drawIcon();
    });
  });

  // Pestañas del Creador de Iconos
  iconTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      iconTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      activeIconMode = tab.getAttribute('data-mode');
      
      document.getElementById('icon-panel-canvas').classList.remove('active');
      document.getElementById('icon-panel-upload').classList.remove('active');
      document.getElementById(`icon-panel-${activeIconMode}`).classList.add('active');

      drawIcon();
    });
  });

  // Subida de imagen para icono
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        uploadedImage = img;
        drawIcon();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });

  // --- PREVISUALIZACION DEL TELEFONO (TABS) ---
  function switchPreview(viewName) {
    previewTabs.forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.preview-tab-btn[data-view="${viewName}"]`).classList.add('active');

    const views = document.querySelectorAll('.device-screen .screen-content');
    views.forEach(view => view.classList.remove('active'));
    document.getElementById(`view-${viewName}`).classList.add('active');

    // Si entramos en la vista de ejecución de App, configuramos el iframe
    if (viewName === 'web') {
      loadIframePreview();
    }
  }

  previewTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      switchPreview(tab.getAttribute('data-view'));
    });
  });

  function loadIframePreview() {
    let url = inputUrl.value.trim();
    if (!url) return;

    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
      inputUrl.value = url;
    }

    mockBrowserUrlText.innerText = url;
    iframeWarning.style.display = 'none';
    previewIframe.style.display = 'block';
    
    // Asignar al iframe
    previewIframe.src = url;
    iframeOpenBtn.href = url;

    // Detectar si el iframe tiene restricciones de visualización
    // Dado que las directivas X-Frame-Options no permiten capturar el error con onload estándar,
    // colocamos un timeout para previsualizar si sigue vacío o no se puede cargar.
    let loaded = false;
    previewIframe.onload = () => {
      loaded = true;
      try {
        // Si podemos acceder al contentWindow sin excepciones, probablemente cargó bien.
        // Si hay error de CORS o bloqueos de frame, la lectura fallará y disparará el warning
        const testAccess = previewIframe.contentWindow.location.href;
      } catch (err) {
        // Bloqueo CORS es normal en webs seguras, no necesariamente significa caída.
        // Pero para asegurar, si es un dominio grande (Google, GitHub), forzamos advertencia de X-Frame-Options.
        if (/google|github|facebook|twitter|instagram|youtube|linkedin|netflix/i.test(url)) {
          showIframeWarning();
        }
      }
    };

    setTimeout(() => {
      if (!loaded && /^(?!.*localhost).*$/i.test(url)) {
        // Si después de 2.5s no disparó la carga fluida, puede estar bloqueado o lento.
        // Mostramos el warning preventivo para que el usuario no crea que la app generada fallará.
        showIframeWarning();
      }
    }, 2500);
  }

  function showIframeWarning() {
    previewIframe.style.display = 'none';
    iframeWarning.style.display = 'flex';
  }

  // --- AUTO INSTALAR (PWA DINÁMICO) ---
  btnInstall.addEventListener('click', async () => {
    if (!deferredPrompt) {
      alert('La instalación directa en caliente no está disponible en este momento. Intenta recargar la página o usa la opción "Descargar ZIP PWA".');
      return;
    }

    const appName = inputName.value.trim() || 'Mi PWA App';
    const appShortName = inputShortName.value.trim() || appName.substring(0, 12);
    const targetUrl = inputUrl.value.trim();
    const themeColor = themeColorPicker.value;
    const bgColor = bgColorPicker.value;
    const execMode = selectExecMode.value;
    const iconDataUrl = canvas.toDataURL('image/png');

    if (!targetUrl) {
      alert('Por favor, introduce una dirección web (URL) válida.');
      return;
    }

    // Guardar en el historial de aplicaciones de forma inmediata
    saveToHistory(appName, targetUrl, iconDataUrl, themeColor, bgColor, execMode);

    // Revocar blob anterior si existe
    if (activeManifestBlobUrl) {
      URL.revokeObjectURL(activeManifestBlobUrl);
    }

    // Configurar start_url con los parámetros del app wrapper
    const startUrlParams = `?run=${encodeURIComponent(targetUrl)}&name=${encodeURIComponent(appName)}&theme=${encodeURIComponent(themeColor)}&bg=${encodeURIComponent(bgColor)}&mode=${encodeURIComponent(execMode)}`;
    
    // Crear el manifiesto dinámico
    const manifest = {
      name: appName,
      short_name: appShortName,
      description: `Aplicación creada con Converter App para el sitio: ${targetUrl}`,
      start_url: window.location.origin + window.location.pathname + startUrlParams,
      id: window.location.pathname + `?pwa_app_id=${encodeURIComponent(targetUrl)}`, // ID único por cada URL para permitir instalar múltiples apps individuales
      display: 'standalone',
      orientation: 'any',
      theme_color: themeColor,
      background_color: bgColor,
      icons: [
        {
          src: iconDataUrl,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ]
    };

    // Crear el Blob para el manifiesto y cambiar el link href en el head
    const manifestString = JSON.stringify(manifest, null, 2);
    const blob = new Blob([manifestString], { type: 'application/json' });
    activeManifestBlobUrl = URL.createObjectURL(blob);
    
    document.getElementById('manifest-placeholder').setAttribute('href', activeManifestBlobUrl);

    // Pequeño timeout antes de disparar el prompt para asegurar que el navegador asimila el cambio de manifiesto
    setTimeout(async () => {
      // Mostrar la ventana de diálogo de instalación nativa
      deferredPrompt.prompt();
      
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`Resultado de instalación: ${outcome}`);
      
      // Limpiar el prompt diferido
      deferredPrompt = null;
      
      // Restaurar el banner a esperando (ya que se usó el evento de instalación actual)
      statusBanner.className = 'status-banner waiting';
      statusBanner.innerHTML = `
        <i class="fa-solid fa-circle-notch fa-spin"></i>
        <div id="status-text">
          Aplicación instalada. Para crear una nueva aplicación, recarga la página o guarda tus cambios en un ZIP.
        </div>
      `;
      btnInstall.disabled = true;
    }, 150);
  });

  // --- COMPRESIÓN ZIP Y DESCARGA (DESCARGAR ZIP) ---
  btnDownload.addEventListener('click', async () => {
    const appName = inputName.value.trim() || 'Mi PWA App';
    const appShortName = inputShortName.value.trim() || appName.substring(0, 12);
    let targetUrl = inputUrl.value.trim();
    const themeColor = themeColorPicker.value;
    const bgColor = bgColorPicker.value;
    const execMode = selectExecMode.value;

    if (!targetUrl) {
      alert('Por favor, introduce una dirección web (URL) válida.');
      return;
    }

    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
    }

    btnDownload.disabled = true;
    btnDownload.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Empaquetando...`;

    try {
      const zip = new JSZip();

      // Convertir el canvas del icono en datos binarios (ArrayBuffer) para el ZIP
      const iconBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const iconArrayBuffer = await iconBlob.arrayBuffer();
      
      // Agregar iconos de alta resolución en la raíz
      zip.file('icon-192.png', iconArrayBuffer);
      zip.file('icon-512.png', iconArrayBuffer);

      // 1. Crear manifest.json
      const manifestJson = {
        name: appName,
        short_name: appShortName,
        description: `Wrapper PWA instalado para ${targetUrl}`,
        start_url: 'index.html',
        display: 'standalone',
        orientation: 'any',
        theme_color: themeColor,
        background_color: bgColor,
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      };
      zip.file('manifest.json', JSON.stringify(manifestJson, null, 2));

      // 2. Crear sw.js
      const swJsContent = `
const CACHE_NAME = 'app-${appName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('./index.html'))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
`;
      zip.file('sw.js', swJsContent);

      // 3. Crear index.html del wrapper
      let wrapperHtml = '';
      if (execMode === 'iframe') {
        // Envoltorio completo con iframe
        wrapperHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appName}</title>
  <link rel="manifest" href="manifest.json">
  <meta name="theme-color" content="${themeColor}">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body, html { width: 100%; height: 100%; overflow: hidden; background: ${bgColor}; font-family: -apple-system, sans-serif; }
    #splash {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: ${bgColor}; display: flex; flex-direction: column;
      justify-content: center; align-items: center; z-index: 9999;
      color: white; transition: opacity 0.5s ease;
    }
    #splash img { width: 96px; height: 96px; border-radius: 20px; margin-bottom: 20px; box-shadow: 0 10px 20px rgba(0,0,0,0.5); }
    #splash h1 { font-size: 1.5rem; font-weight: 600; margin-bottom: 30px; }
    .loader {
      width: 32px; height: 32px; border: 3px solid rgba(255,255,255,0.1);
      border-top-color: ${themeColor}; border-radius: 50%;
      animation: spin 1s infinite linear;
    }
    iframe { width: 100%; height: 100%; border: none; display: block; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div id="splash">
    <img src="icon-512.png" alt="Logo">
    <h1>${appName}</h1>
    <div class="loader"></div>
  </div>

  <iframe src="${targetUrl}" id="app-frame"></iframe>

  <script>
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js');
    }
    
    const frame = document.getElementById('app-frame');
    const splash = document.getElementById('splash');
    
    // Ocultar pantalla de carga al iniciar
    frame.onload = () => {
      splash.style.opacity = '0';
      setTimeout(() => splash.style.display = 'none', 500);
    };

    // Forzar ocultamiento tras 8 segundos de seguridad
    setTimeout(() => {
      if (splash.style.display !== 'none') {
        splash.style.opacity = '0';
        setTimeout(() => splash.style.display = 'none', 500);
      }
    }, 8000);
  </script>
</body>
</html>`;
      } else {
        // Modo redirección simple (funciona con todas las webs)
        wrapperHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appName}</title>
  <link rel="manifest" href="manifest.json">
  <meta name="theme-color" content="${themeColor}">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body, html { width: 100%; height: 100%; overflow: hidden; background: ${bgColor}; font-family: -apple-system, sans-serif; }
    #splash {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: ${bgColor}; display: flex; flex-direction: column;
      justify-content: center; align-items: center; z-index: 9999;
      color: white;
    }
    #splash img { width: 96px; height: 96px; border-radius: 20px; margin-bottom: 20px; box-shadow: 0 10px 20px rgba(0,0,0,0.5); }
    #splash h1 { font-size: 1.5rem; font-weight: 600; margin-bottom: 30px; }
    .loader {
      width: 32px; height: 32px; border: 3px solid rgba(255,255,255,0.1);
      border-top-color: ${themeColor}; border-radius: 50%;
      animation: spin 1s infinite linear;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div id="splash">
    <img src="icon-512.png" alt="Logo">
    <h1>${appName}</h1>
    <div class="loader"></div>
  </div>

  <script>
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js');
    }
    
    // Redireccionar de inmediato
    setTimeout(() => {
      window.location.replace("${targetUrl}");
    }, 1500);
  </script>
</body>
</html>`;
      }
      zip.file('index.html', wrapperHtml);

      // 4. Crear README.md
      const readmeContent = `# ${appName} - Proyecto PWA Generado

Este es el código fuente de tu aplicación empaquetada como **PWA (Progressive Web App)** generada mediante **Converter App**.

## Contenido del Paquete

- \`index.html\`: Envoltorio principal que arranca tu aplicación y carga \`${targetUrl}\`.
- \`manifest.json\`: Archivo de configuración que le dice al navegador que es una app instalable (nombre, iconos, colores).
- \`sw.js\`: Service Worker para permitir el soporte offline de los activos locales.
- \`icon-192.png\` e \`icon-512.png\`: Iconos de tu app.

## Instrucciones de Instalación y Lanzamiento

1. **Sube los archivos** (descomprimidos) a cualquier servidor web que admita **HTTPS** (indispensable para PWAs). Puedes usar servicios gratuitos excelentes como:
   - [Netlify](https://www.netlify.com/) (arrastrando y soltando la carpeta)
   - [Vercel](https://vercel.com/)
   - [GitHub Pages](https://pages.github.com/)
   - [Firebase Hosting](https://firebase.google.com/)
   - Tu propio cPanel u hosting clásico.

2. **Abre la URL** de tu hosting en tu dispositivo (móvil o PC).
3. **Instala la App**:
   - En **Google Chrome / Edge (Android y PC)**: Aparecerá un icono de instalación en la barra de direcciones o una ventana emergente para instalar.
   - En **Safari (iOS / iPhone)**: Haz clic en el botón de compartir (flecha hacia arriba) y selecciona la opción **"Añadir a la pantalla de inicio"**.

¡Listo! Ya tendrás tu sitio web operando como una aplicación independiente.
`;
      zip.file('README.md', readmeContent);

      // Generar y descargar el archivo ZIP final
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(zipBlob);
      const tempLink = document.createElement('a');
      tempLink.href = downloadUrl;
      tempLink.download = `${appName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-pwa.zip`;
      document.body.appendChild(tempLink);
      tempLink.click();
      
      // Limpieza
      document.body.removeChild(tempLink);
      URL.revokeObjectURL(downloadUrl);

    } catch (error) {
      console.error('Error generando el ZIP:', error);
      alert('Ocurrió un error al empaquetar tu aplicación.');
    } finally {
      btnDownload.disabled = false;
      btnDownload.innerHTML = `<span class="btn-icon-wrapper"><i class="fa-solid fa-file-zipper"></i></span> Descargar ZIP`;
    }
  });

  // --- DESCARGA DE APK PARA ANDROID ---
  btnApk.addEventListener('click', async () => {
    const appName = inputName.value.trim() || 'Mi PWA App';
    const appShortName = inputShortName.value.trim() || appName.substring(0, 12);
    let targetUrl = inputUrl.value.trim();
    const themeColor = themeColorPicker.value;
    const bgColor = bgColorPicker.value;

    if (!targetUrl) {
      alert('Por favor, introduce una dirección web (URL) válida.');
      return;
    }

    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
    }

    // Cambiar estado visual del botón
    btnApk.disabled = true;
    btnApk.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Compilando APK...`;

    try {
      // Obtener el icono como Base64
      const iconDataUrl = canvas.toDataURL('image/png');

      const payload = {
        url: targetUrl,
        name: appName,
        shortName: appShortName,
        themeColor: themeColor,
        bgColor: bgColor,
        icon: iconDataUrl
      };

      // Realizar la petición al backend local
      const response = await fetch('/build-apk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({ error: 'Error de red o compilación en el servidor.' }));
        throw new Error(errorJson.error || `Error del servidor: ${response.statusText}`);
      }

      // El servidor devuelve el archivo ZIP que contiene la APK. Hacemos la descompresión client-side con JSZip.
      const zipBlob = await response.blob();
      const zip = await JSZip.loadAsync(zipBlob);
      
      // Buscar el archivo con extensión .apk dentro del ZIP
      let apkFile = null;
      let apkFileName = '';
      
      zip.forEach((relativePath, file) => {
        if (relativePath.endsWith('.apk')) {
          apkFile = file;
          apkFileName = relativePath.split('/').pop(); // Obtener nombre limpio
        }
      });

      if (!apkFile) {
        // Si no se encuentra un APK dentro del zip, descargamos todo el ZIP
        console.warn('No se encontró el APK suelto en el ZIP. Descargando el paquete ZIP completo.');
        const downloadUrl = URL.createObjectURL(zipBlob);
        const tempLink = document.createElement('a');
        tempLink.href = downloadUrl;
        tempLink.download = `${appName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-apk-signed.zip`;
        document.body.appendChild(tempLink);
        tempLink.click();
        document.body.removeChild(tempLink);
        URL.revokeObjectURL(downloadUrl);
        alert('Se descargó el paquete ZIP de firma. Descomprímelo para extraer tu APK.');
      } else {
        // Extraer el archivo .apk como blob
        const apkBlob = await apkFile.async('blob');
        const downloadUrl = URL.createObjectURL(apkBlob);
        const tempLink = document.createElement('a');
        tempLink.href = downloadUrl;
        tempLink.download = apkFileName || `${appName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.apk`;
        document.body.appendChild(tempLink);
        tempLink.click();
        document.body.removeChild(tempLink);
        URL.revokeObjectURL(downloadUrl);
      }

    } catch (error) {
      console.error('Error generando o descargando el APK:', error);
      alert(`No se pudo compilar el APK: ${error.message || error}\n\nAsegúrate de estar corriendo el servidor local con 'node server.js' y tener conexión a internet.`);
    } finally {
      btnApk.disabled = false;
      btnApk.innerHTML = `<span class="btn-icon-wrapper"><i class="fa-brands fa-android"></i></span> Descargar APK`;
    }
  });

  // --- HISTORIAL EN LOCALSTORAGE ---
  function saveToHistory(name, url, icon, theme, bg, mode) {
    let history = [];
    try {
      history = JSON.parse(localStorage.getItem('converter_history') || '[]');
    } catch (e) {
      history = [];
    }

    // Evitar duplicar URLs idénticas, sobrescribiendo si ya existe
    history = history.filter(app => app.url !== url);

    // Añadir al inicio del historial
    history.unshift({ name, url, icon, theme, bg, mode });

    // Limitar historial a 8 apps
    if (history.length > 8) history.pop();

    localStorage.setItem('converter_history', JSON.stringify(history));
    renderHistory();
  }

  function deleteHistoryItem(url, event) {
    event.stopPropagation(); // Evitar que el clic en el botón de borrar seleccione el app
    let history = [];
    try {
      history = JSON.parse(localStorage.getItem('converter_history') || '[]');
    } catch (e) {
      return;
    }

    history = history.filter(app => app.url !== url);
    localStorage.setItem('converter_history', JSON.stringify(history));
    renderHistory();
  }

  function selectHistoryItem(app) {
    inputUrl.value = app.url;
    inputName.value = app.name;
    inputShortName.value = app.name.substring(0, 12);
    themeColorPicker.value = app.theme;
    bgColorPicker.value = app.bg;
    themeColorVal.innerText = app.theme;
    bgColorVal.innerText = app.bg;
    selectExecMode.value = app.mode || 'redirect';

    // Cargar imagen de icono si la hay o restaurar texto
    if (app.icon.startsWith('data:image')) {
      activeIconMode = 'upload';
      // Buscar tabs
      iconTabs.forEach(t => t.classList.remove('active'));
      document.querySelector('.icon-tab[data-mode="upload"]').classList.add('active');
      document.getElementById('icon-panel-canvas').classList.remove('active');
      document.getElementById('icon-panel-upload').classList.add('active');
      
      const img = new Image();
      img.onload = () => {
        uploadedImage = img;
        drawIcon();
      };
      img.src = app.icon;
    } else {
      activeIconMode = 'canvas';
      iconTabs.forEach(t => t.classList.remove('active'));
      document.querySelector('.icon-tab[data-mode="canvas"]').classList.add('active');
      document.getElementById('icon-panel-canvas').classList.add('active');
      document.getElementById('icon-panel-upload').classList.add('active');
      iconText.value = app.name.charAt(0);
      drawIcon();
    }

    // Actualizar previsualización
    updateLiveLabels();
    document.getElementById('phone-shell').style.borderColor = app.theme;
    document.getElementById('phone-shell').style.boxShadow = `0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 4px rgba(255, 255, 255, 0.15), 0 0 30px ${app.theme}40`;
    document.getElementById('view-splash').style.backgroundColor = app.bg;
    switchPreview('home');
  }

  function renderHistory() {
    const grid = document.getElementById('history-grid');
    let history = [];
    try {
      history = JSON.parse(localStorage.getItem('converter_history') || '[]');
    } catch (e) {
      history = [];
    }

    if (history.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 1.5rem 0; font-size: 0.9rem;">
          <i class="fa-solid fa-folder-open" style="font-size: 1.8rem; display: block; margin-bottom: 0.5rem;"></i>
          Aún no has creado aplicaciones. Rellena los datos superiores para empezar.
        </div>
      `;
      return;
    }

    grid.innerHTML = '';
    history.forEach(app => {
      const card = document.createElement('div');
      card.className = 'history-card';
      
      card.innerHTML = `
        <div class="history-icon" style="background-image: url(${app.icon})"></div>
        <div class="history-info">
          <div class="history-name">${app.name}</div>
          <div class="history-url">${app.url}</div>
        </div>
        <div class="history-actions">
          <div class="history-btn-del" title="Eliminar"><i class="fa-solid fa-trash"></i></div>
        </div>
      `;

      card.querySelector('.history-btn-del').addEventListener('click', (e) => {
        deleteHistoryItem(app.url, e);
      });

      card.addEventListener('click', () => {
        selectHistoryItem(app);
      });

      grid.appendChild(card);
    });
  }

  // --- MODAL DE AYUDA ---
  window.openHelpModal = function() {
    document.getElementById('help-modal').classList.add('active');
  };

  window.closeHelpModal = function() {
    document.getElementById('help-modal').classList.remove('active');
  };

  // Cerrar modal al hacer clic fuera del contenido
  document.getElementById('help-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('help-modal')) {
      closeHelpModal();
    }
  });

  // --- INICIALIZACIÓN ---
  // Habilitar botón de instalar de forma predeterminada para instruir en caso de que no haya beforeinstallprompt
  btnInstall.disabled = true;
  
  // Dibujar el icono inicial por defecto y cargar la vista de home
  setTimeout(() => {
    drawIcon();
    updateLiveLabels();
    renderHistory();
    // Simular que el instalador está cargado
    if (!deferredPrompt) {
      statusBanner.className = 'status-banner waiting';
      statusBanner.innerHTML = `
        <i class="fa-solid fa-circle-info" style="color: var(--neon-cyan)"></i>
        <div id="status-text">
          Puedes probar la aplicación en el simulador de la derecha. Para habilitar la auto-instalación directa, abre esta web en un navegador compatible con PWA (Chrome, Edge, Opera) y espera a que se cargue el registro.
        </div>
      `;
    }
  }, 100);

})();
