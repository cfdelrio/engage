# ORKESTAI ENGAGE — Lecciones Aprendidas

## Errores Cometidos y Cómo Evitarlos

### 1. ❌ CSS/Assets No Se Cargan en Navegador

**Síntoma**: Dashboard HTML se renderiza pero sin CSS, sin estilos Tailwind.

**Causa Raíz**: `NEXT_PUBLIC_API_URL` apunta a URL incorrecta (HTTP en lugar de HTTPS, o IP en lugar de dominio).

**Por qué sucede**:

- Next.js standalone build incluye una variable de entorno `NEXT_PUBLIC_API_URL` que se inyecta en tiempo de build
- Si esta URL es incorrecta, los assets (CSS, JS) pueden no cargarse si hay CORS issues
- El navegador intenta cargar `/static/...` desde rutas relativas que pueden fallar con la URL API incorrecta

**Regla de Prevención**:

```bash
# ANTES de reiniciar orkestai-web.service, SIEMPRE:
# 1. Actualizar NEXT_PUBLIC_API_URL al dominio/puerto CORRECTO
# 2. Usar HTTPS en producción, HTTP solo en desarrollo local

# ❌ MAL:
NEXT_PUBLIC_API_URL=http://localhost:3001        # desarrollo
NEXT_PUBLIC_API_URL=http://44.223.7.160:3001     # producción (HTTP en IP)

# ✅ BIEN:
NEXT_PUBLIC_API_URL=http://localhost:3001        # desarrollo local
NEXT_PUBLIC_API_URL=https://api.engage.orkestai.ar  # o puerto :3001 si es necesario
NEXT_PUBLIC_API_URL=https://engage.orkestai.ar:3001 # alternativa
```

**Validación Post-Setup**:

```bash
# Después de actualizar orkestai-web.service:
sudo systemctl restart orkestai-web
sleep 3
curl -s https://engage.orkestai.ar | grep -i "stylesheet" | head -3
# Debe retornar tags <link> con CSS

# O verificar en navegador: F12 → Network → ver que los .css cargan con status 200
```

**Fix Automático en Scripts**:

- El script `setup-ssl.sh` debe actualizar `NEXT_PUBLIC_API_URL` automáticamente cuando se configura un nuevo dominio
- Agregar validación post-setup que verifique que CSS se carga correctamente

---

### 2. ❌ Puerto Ya En Uso (EADDRINUSE)

**Síntoma**: `nginx: [emerg] bind() to 0.0.0.0:3002 failed (98: Address already in use)`

**Causa Raíz**: Docker Bull Board ya escucha en puerto 3002, NGINX intenta proxy a ese puerto.

**Regla de Prevención**:

```bash
# ANTES de configurar reverse proxy en NGINX:
# 1. Verificar qué está corriendo en cada puerto

sudo ss -tlnp | grep LISTEN
# o
sudo lsof -i :3000
sudo lsof -i :3001
sudo lsof -i :3002

# 2. Para servicios que YA tienen sus propios puertos (como Bull Board en Docker):
#    NO proxarlos a través de NGINX, dejar que se sirvan directamente
#    Solo proxar servicios internos (localhost:3000, localhost:3001)
```

**Configuración Correcta de NGINX**:

```nginx
# ✅ BIEN - Proxear Next.js (corre en localhost:3000)
server {
    listen 443 ssl;
    server_name engage.orkestai.ar;
    location / {
        proxy_pass http://localhost:3000;  # ← Proxar
    }
}

# ✅ BIEN - Proxear API (corre en localhost:3001)
server {
    listen 443 ssl;
    server_name api.engage.orkestai.ar;
    location / {
        proxy_pass http://localhost:3001;  # ← Proxar
    }
}

# ❌ MALO - NO proxear servicios que ya tienen puerto público
# Bull Board en Docker corre en 0.0.0.0:3002, ya es accesible
# No hay que proxarla a través de NGINX
```

---

### 3. ❌ Certificado SSL "Not Found" (Falso Negativo)

**Síntoma**: Certificado se obtiene correctamente pero script reporta "❌ Certificate not found"

**Causa Raíz**: Verificación de archivo sin `sudo` cuando el certificado es propiedad de root.

**Regla de Prevención**:

```bash
# ❌ MAL:
if [ ! -f "$CERT_PATH" ]; then
    echo "Certificate not found"
    exit 1
fi

# ✅ BIEN:
if ! sudo test -f "$CERT_PATH"; then
    echo "Certificate not found"
    exit 1
fi

# O mejor aún, verificar que el certificado es válido:
sudo openssl x509 -in "$CERT_PATH" -noout -dates
```

---

### 4. ❌ Certificado para www.subdomain.ar Cuando No Existe

**Síntoma**: `certbot` intenta certificar `www.engage.orkestai.ar` pero DNS no existe

**Causa Raíz**: Script hardcodeado para solicitar certificado para ambos `engage.orkestai.ar` y `www.engage.orkestai.ar`

**Regla de Prevención**:

```bash
# ❌ MAL:
certbot certonly --standalone -d "$DOMAIN" -d "www.$DOMAIN"

# ✅ BIEN:
# Solo certificar el dominio que realmente existe
certbot certonly --standalone -d "$DOMAIN"

# Si necesitas múltiples dominios:
certbot certonly --standalone -d "$DOMAIN" -d "api.$DOMAIN"
# Pero VERIFICA que ambos existen en DNS primero
```

---

### 5. ❌ Script Interactivo en Automation (Cuelga)

**Síntoma**: Script se cuelga esperando input del usuario

**Causa Raíz**: `certbot` pregunta sobre renovación de certificado existente, pero no hay terminal interactiva

**Regla de Prevención**:

```bash
# ❌ MAL:
certbot certonly --standalone -d "$DOMAIN"
# Pregunta si renovar o mantener certificado existente → CUELGA

# ✅ BIEN:
certbot certonly --standalone -d "$DOMAIN" \
    --non-interactive \
    --agree-tos \
    --email admin@example.com \
    --keep-until-expiring
# --keep-until-expiring: no renovar si aún es válido
# --non-interactive: no hacer preguntas
# --agree-tos: aceptar términos automáticamente
```

---

## Checklist Post-Deployment

Después de correr `setup-ssl.sh` o cambiar configuración:

```bash
# 1. Verificar que NGINX está corriendo
sudo systemctl status nginx
# Status debe ser: active (running)

# 2. Verificar que todos los servicios Node.js están corriendo
sudo systemctl status orkestai-api orkestai-worker orkestai-web
# Todos deben estar: active (running)

# 3. Verificar que HTTPS responde
curl -I https://engage.orkestai.ar
# Status debe ser: HTTP/2 307 (redirect a /dashboard) o 200

# 4. Verificar que CSS se carga
curl -s https://engage.orkestai.ar | grep -c "stylesheet"
# Debe retornar número > 0

# 5. Verificar NEXT_PUBLIC_API_URL en systemd
grep "NEXT_PUBLIC_API_URL" /etc/systemd/system/orkestai-web.service
# Debe apuntar a https://engage.orkestai.ar:3001 (o dominio correcto)

# 6. Verificar certificado SSL
sudo openssl x509 -in /etc/letsencrypt/live/engage.orkestai.ar/fullchain.pem -noout -dates
# notBefore y notAfter deben mostrar fechas válidas

# 7. Ver logs de errores recientes
sudo journalctl -xeu orkestai-web.service -n 50
sudo journalctl -xeu nginx.service -n 50
# No debe haber [error] o [crit]
```

---

## Deuda Técnica Pendiente

### DNS `api.engage.orkestai.ar`

**Estado**: Pendiente  
**Prioridad**: Media  
**Workaround activo**: path-based routing en nginx — la API se expone en `https://engage.orkestai.ar/v1/...` en lugar de un subdominio dedicado.

**Qué hay que hacer**:

1. En el registrador de dominio, agregar:
   ```
   Tipo  | Nombre          | Valor               | TTL
   ------|-----------------|---------------------|-----
   A     | api.engage      | <EC2 Elastic IP>    | 3600
   ```
2. Esperar propagación DNS (5-30 min) — verificar con `nslookup api.engage.orkestai.ar`
3. Correr `bash infra/scripts/setup-ssl.sh engage.orkestai.ar` (ya incluye `api.$DOMAIN` en el cert)
4. El script actualizará nginx para usar `server_name api.engage.orkestai.ar` y `NEXT_PUBLIC_API_URL=https://api.engage.orkestai.ar`
5. Rebuild: `NEXT_PUBLIC_API_URL=https://api.engage.orkestai.ar pnpm --filter @engage/web build`
6. `sudo systemctl restart orkestai-web nginx`

**Beneficio de resolver**: separación limpia entre frontend y API, más fácil de escalar/migrar independientemente.

---

## Referencias

- **Next.js Environment Variables**: https://nextjs.org/docs/basic-features/environment-variables
- **Certbot Non-Interactive**: https://certbot.eff.org/docs/using.html#certbot
- **NGINX Reverse Proxy**: https://nginx.org/en/docs/http/ngx_http_proxy_module.html
- **Let's Encrypt Best Practices**: https://letsencrypt.org/docs/
