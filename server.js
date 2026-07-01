/* CREADOR DE APLICACIONES CON WEB - server.js */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;

// Tipos MIME para servir archivos estáticos
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};

// Función para servir archivos estáticos
function serveStaticFile(filePath, res) {
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
      res.end('Archivo no encontrado');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(filePath);
    stream.on('error', (streamErr) => {
      console.error('Error leyendo archivo:', streamErr);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=UTF-8' });
      res.end('Error interno del servidor');
    });
    stream.pipe(res);
  });
}

// Servidor principal
const server = http.createServer(async (req, res) => {
  console.log(`[Petición] ${req.method} ${req.url}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- ENDPOINT PARA COMPILAR APK ---
  if (req.method === 'POST' && req.url === '/build-apk') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const { url, name, shortName, themeColor, bgColor, icon } = data;

        if (!url || !name || !shortName || !icon) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Faltan parámetros requeridos.' }));
          return;
        }

        console.log(`[APK] Iniciando compilación para: ${name} (${url})`);

        // 1. Procesar la imagen Base64 del icono
        const base64Data = icon.replace(/^data:image\/png;base64,/, '');
        const iconBuffer = Buffer.from(base64Data, 'base64');

        // 2. Subir icono a tmpfiles.org
        console.log('[APK] Subiendo icono temporal...');
        const iconFormData = new FormData();
        const iconBlob = new Blob([iconBuffer], { type: 'image/png' });
        iconFormData.append('file', iconBlob, 'icon.png');

        const uploadIconRes = await fetch('https://tmpfiles.org/api/v1/upload', {
          method: 'POST',
          body: iconFormData
        });

        if (!uploadIconRes.ok) {
          const errText = await uploadIconRes.text();
          throw new Error(`Fallo al subir el icono temporal a tmpfiles: ${errText}`);
        }

        const uploadIconJson = await uploadIconRes.json();
        const iconUrl = uploadIconJson.data.url.replace('https://tmpfiles.org/', 'https://tmpfiles.org/dl/');
        console.log('[APK] Icono subido con éxito:', iconUrl);

        // 3. Generar y subir el manifest.json
        console.log('[APK] Subiendo manifiesto temporal...');
        const manifest = {
          name: name,
          short_name: shortName,
          start_url: url,
          display: 'standalone',
          background_color: bgColor || '#0a0a14',
          theme_color: themeColor || '#00f2fe',
          icons: [
            {
              src: iconUrl,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        };

        const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
        const manifestFormData = new FormData();
        manifestFormData.append('file', manifestBlob, 'manifest.json');

        const uploadManifestRes = await fetch('https://tmpfiles.org/api/v1/upload', {
          method: 'POST',
          body: manifestFormData
        });

        if (!uploadManifestRes.ok) {
          const errText = await uploadManifestRes.text();
          throw new Error(`Fallo al subir el manifiesto temporal a tmpfiles: ${errText}`);
        }

        const uploadManifestJson = await uploadManifestRes.json();
        const manifestUrl = uploadManifestJson.data.url.replace('https://tmpfiles.org/', 'https://tmpfiles.org/dl/');
        console.log('[APK] Manifiesto subido con éxito:', manifestUrl);

        // 4. Solicitar compilación del APK a PWABuilder CloudAPK
        console.log('[APK] Conectando con PWABuilder CloudAPK...');
        const hostUrl = new URL(url);
        const sanitizedShortName = shortName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'app';
        
        const pwaBuilderPayload = {
          host: hostUrl.hostname,
          name: name,
          launcherName: shortName.substring(0, 12),
          themeColor: themeColor,
          backgroundColor: bgColor,
          pwaUrl: url,
          webManifestUrl: manifestUrl,
          iconUrl: iconUrl,
          appVersion: '1.0.0.0',
          appVersionCode: 1,
          packageId: `com.converterapp.${sanitizedShortName}`,
          signingMode: 'new',
          includeSourceCode: false,
          display: 'standalone',
          fallbackType: 'customtabs',
          navigationColor: themeColor || '#00f2fe',
          startUrl: hostUrl.pathname + hostUrl.search,
          splashScreenFadeOutDuration: 300,
          enableNotifications: false,
          signing: {
            alias: sanitizedShortName,
            fullName: name,
            organization: 'ConverterApp',
            organizationalUnit: 'Development',
            countryCode: 'US'
          }
        };

        const pwaBuilderRes = await fetch('https://pwabuilder-cloudapk.azurewebsites.net/generateAppPackage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(pwaBuilderPayload)
        });

        if (!pwaBuilderRes.ok) {
          const statusText = pwaBuilderRes.statusText;
          const details = await pwaBuilderRes.text();
          console.error('[APK] Error de compilación en PWABuilder:', statusText, details);
          throw new Error(`PWABuilder falló la compilación: ${statusText} - ${details}`);
        }

        const zipArrayBuffer = await pwaBuilderRes.arrayBuffer();
        console.log('[APK] Compilación completada con éxito. Devolviendo ZIP.');

        // Responder con el archivo ZIP recibido de PWABuilder
        res.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${sanitizedShortName}-apk-signed.zip"`
        });
        res.end(Buffer.from(zipArrayBuffer));

      } catch (err) {
        console.error('[APK ERROR]', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'Error compilando el APK en el servidor.' }));
      }
    });
    return;
  }

  // --- SERVIR ARCHIVOS ESTÁTICOS ---
  let reqPath = req.url;
  
  // Limpiar parámetros de consulta (?run=...)
  if (reqPath.includes('?')) {
    reqPath = reqPath.split('?')[0];
  }

  // Fallback a index.html para rutas generales o directorio raíz
  if (reqPath === '/' || reqPath === '/index.html') {
    serveStaticFile(path.join(__dirname, 'index.html'), res);
  } else {
    // Evitar salir del directorio por seguridad
    const safePath = path.normalize(path.join(__dirname, reqPath));
    if (safePath.startsWith(__dirname)) {
      serveStaticFile(safePath, res);
    } else {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=UTF-8' });
      res.end('Acceso denegado');
    }
  }
});

// Lanzar servidor
server.listen(PORT, () => {
  console.log(`[Converter App] Servidor híbrido corriendo en http://localhost:${PORT}`);
  console.log(`[Converter App] Soporte APK habilitado a través de /build-apk`);
});
