# Guía Render — Si el deploy falló

## Paso 1: Ver el error exacto

1. Entra a [dashboard.render.com](https://dashboard.render.com)
2. Clic en **bombastic-api** (el web service que falló)
3. Pestaña **Logs** o **Events**
4. El mensaje en rojo dice la causa (ej: `Cannot find module`, `DATABASE_URL`, `rootDir`, etc.)

---

## Causas más comunes

### A) Ya tienes otra base de datos gratis en Render
Render solo permite **1 PostgreSQL gratis** por cuenta.

**Solución:** En el dashboard, borra la base gratis vieja que no uses, o usa una base existente y conéctala manualmente.

---

### B) Carpeta incorrecta en el repo (`rootDir`)

Depende de qué subiste a GitHub:

| Qué subiste a GitHub | `rootDir` en render.yaml |
|----------------------|--------------------------|
| Solo el contenido de `1_ESTO_PARA_ONLINE` | `backend` |
| Todo el proyecto `SisBombastic` | `1_ESTO_PARA_ONLINE/backend` |

Si subiste todo SisBombastic, edita `render.yaml` línea `rootDir` y vuelve a desplegar.

También en Render → **bombastic-api** → **Settings** → **Root Directory** debe coincidir.

---

### C) Blueprint en subcarpeta

Si el repo es `SisBombastic` completo, al crear el Blueprint indica:

**Blueprint path:** `1_ESTO_PARA_ONLINE/render.yaml`

---

### D) Despliegue manual (más fácil si Blueprint falla)

#### 1. Crear PostgreSQL
- Render → **New +** → **PostgreSQL**
- Name: `bombastic-db`
- Plan: **Free**
- Create

Copia la **Internal Database URL** (o External).

#### 2. Crear Web Service
- **New +** → **Web Service**
- Conecta tu repo de GitHub
- Configuración:

| Campo | Valor |
|-------|-------|
| Name | `bombastic-api` |
| Root Directory | `backend` o `1_ESTO_PARA_ONLINE/backend` |
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Plan | Free |

#### 3. Variables de entorno (Web Service → Environment)

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Pega la URL de PostgreSQL |
| `NODE_ENV` | `production` |
| `CORS_ORIGIN` | Tu URL de Netlify (después) |

#### 4. Deploy y probar

Abre: `https://TU-SERVICIO.onrender.com/api/health`

Debe responder:
```json
{"status":"ok","nombre":"Bombastic Dreamers Online"}
```

---

## Paso 2: Conectar con Netlify

Cuando Render funcione, copia la URL del servicio (sin `/api`):

```
https://bombastic-api.onrender.com
```

En **Netlify** → Environment variables:

```
VITE_API_URL = https://bombastic-api.onrender.com/api
```

Vuelve a desplegar Netlify.

En **Render** → `CORS_ORIGIN`:

```
https://tu-sitio.netlify.app
```

---

## Nota sobre plan free de Render

- El servidor **se duerme** tras 15 min sin uso (~1 min en despertar)
- La base gratis **expira a los 30 días** (puedes crear otra o pagar $6/mes)

---

Si el deploy sigue fallando, copia las últimas 20 líneas del log de Render y compártelas.
