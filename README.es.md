# TAZIA

**Zona Anónima Temporal en Acción**

Una sala que existe solo mientras estéis dentro: sin cuentas y sin chat guardado en nuestra nube. Compartís una frase y habláis en directo entre navegadores **conectados a la vez**. Si nadie más está online, la sala se apaga. Al **apagar la llama**, **este** dispositivo olvida la zona.

📱 En el móvil podéis **Instalar / Añadir a la pantalla de inicio**.  
🔗 Sitio en vivo: [gonzosint.github.io/tazia](https://gonzosint.github.io/tazia/)

[English](README.md)

---

## En pocas palabras

| Quieres… | Ve a… |
| --- | --- |
| 🚪 Abrir o unirte | **Zonas** |
| 💬 Hablar en grupo | **Foro** |
| 🗳️ Apagar **una** hoguera (voto unánime) | **Foro** → apagar hoguera → toda la tribu **online** vota a favor |
| 👥 Ver quién está / verificar a alguien | **Tribu** |
| 🤫 Escribir en privado | **Susurros** |
| 🔥 Olvidar **todas** las zonas en este dispositivo | **Apagar llama** |

---

## Cómo usarla (en la web)

1. Abre [TAZIA](https://gonzosint.github.io/tazia/).
2. Pulsa **Abrir zona** y genera (o escribe) una **frase**.
3. Pásasela a la otra persona en persona, por teléfono o en papel.  
   También podéis meterla en el enlace: más cómodo, menos privado.
4. La otra persona entra con **Entrar con frase**, el enlace o el **QR**.
5. La primera vez el navegador pide permiso de red: es para que os encontréis en la misma Wi‑Fi o LAN.
6. Cuando terminéis: **Apagar llama**.

Podéis tener hasta **tres zonas** abiertas y cambiar entre ellas. Quemar una no tumba las demás; apagar la llama sí limpia todas en **este** navegador.

---

## Cómo correrla en tu máquina

Necesitas [Node.js](https://nodejs.org/) (recomendado LTS) y el código del repo.

```bash
npm install
```

### Desarrollo (recarga en vivo)

```bash
npm run dev
```

Abre **http://localhost:5173/tazia/** (la barra final importa: la app vive bajo `/tazia/`).

Útil para tocar código. Dos pestañas o dos dispositivos en la misma red pueden entrar a la misma zona con la misma frase.

### Probar el build (como en producción)

```bash
npm run build
npm run preview
```

Vite sirve la carpeta `dist/` (PWA incluida). La URL sigue siendo bajo `/tazia/`.

### Un solo archivo HTML (offline / verificable)

```bash
npm run build:single
```

Genera:

| Archivo | Para qué |
| --- | --- |
| `release/tazia-single.html` | Toda la app en un HTML (CSS/JS y el worker del QR van dentro) |
| `release/tazia-single.html.sha256` | Huella SHA-256 para comprobar que no se alteró |
| `release/MANIFEST.txt` | Resumen del build |

**Cómo abrirlo**

1. Abre `tazia-single.html` en el navegador (doble clic / `file://`), **o** sírvelo con cualquier servidor estático local.
2. Para comprobar integridad (ejemplo en PowerShell):

```powershell
Get-FileHash .\release\tazia-single.html -Algorithm SHA256
# Compara con el hash de tazia-single.html.sha256
```

**Qué no es el single-file**

- No incluye service worker de PWA (no “instalar app” como en Pages).
- No sustituye el despliegue multi-archivo de GitHub Pages.
- Sirve para llevar la app en un USB, auditar un build concreto o usarla sin servir `dist/` (GitHub no registra esas visitas).
- El CSP del single permite `unsafe-inline` (scripts embebidos); el deploy multi-archivo de Pages es más estricto.

En cada deploy a Pages, Actions también sube el artefacto **`tazia-single`** (`tazia-single.html` + `.sha256` + `MANIFEST.txt`) para descargarlo sin construir en local.

---

## Consejos

**📶 Conexión.** La misma Wi‑Fi suele ir mejor. Si no os conectáis, en **Zonas → Arreglar** hay pasos concretos. A veces hace falta un servidor TURN propio ([guía](docs/TURN.es.md)): un retransmisor que ayuda cuando el P2P directo no atraviesa el router o el CGNAT. Ahí también puedes poner **relés Nostr propios** (`wss://`) para no depender del pool público de señalización.

**🔑 Frase.** Es la llave de la sala: no la publiques en un chat abierto. Verificar en **Tribu** (secuencia de emojis) confirma que hablas con quien crees.

**🗳️ Apagar hoguera ≠ apagar llama.** En el Foro, apagar una hoguera propone borrar **ese** hilo: hace falta el sí de todos los que estaban online al proponer. **Apagar llama** solo limpia **este** navegador (todas las zonas); el resto de la tribu sigue hasta que también apague.

**⏳ Expectativas.** Va mejor en grupos pequeños. No reemplaza una app de mensajería diaria: es una zona **temporal**.

---

## Navegadores

Chrome, Brave, Firefox y Safari. En internet hace falta **HTTPS**. En local, `localhost` cuenta como contexto seguro.

---

## Más documentación

| Tema | Documento |
| --- | --- |
| 🛡️ Riesgos y límites (apagar llama vs apagar hoguera) | [Seguridad](docs/SECURITY.es.md) |
| 📜 Formato de mensajes y voto de apagado | [Protocolo](docs/PROTOCOL.es.md) |
| 📶 Si no os conectáis (TURN / Wi‑Fi) | [Conexión](docs/TURN.es.md) |
| 📚 Índice técnico | [docs/](docs/README.es.md) |

---

## Desarrollo

Stack: React + Vite + [Trystero](https://trystero.dev/). Protocolo **TAZEP** (`tazep-v2`). App ID: `tazia.app`.

```bash
npm install
npm run dev          # http://localhost:5173/tazia/
npm run build        # → dist/ (PWA)
npm run build:single # → release/tazia-single.html + SHA-256
npm run preview      # sirve dist/
npm run lint         # TypeScript sin emitir
```

Despliegue en GitHub Pages: [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) (`base: '/tazia/'`).  
Cabeceras de ejemplo: [`public/_headers`](public/_headers).  
Detalle técnico y papers: [docs/README.es.md](docs/README.es.md).
