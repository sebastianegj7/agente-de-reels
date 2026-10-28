---
name: crear-reel
description: Crea un Reel de Instagram (MP4 vertical 9:16, 25-45 s) a partir de una idea - investiga el tema con fuentes, escribe el guion, lo anima con las plantillas de Remotion del proyecto, pone voz (edge-tts), música e imágenes IA puntuales, y entrega final.mp4. Úsala cuando el usuario pida "hazme un reel", "crea un reel sobre…", "/crear-reel <idea>" o un video corto vertical para Instagram/TikTok/Shorts.
model: sonnet
---

# Crear reel

Convierte una idea en `reels/<slug>/final.mp4`. Todo es gratis: Remotion (licencia
gratuita para individuos), edge-tts, Pollinations y música propia o generada.
Trabaja desde la raíz del repo `agente-de-reels`. Habla con el usuario de tú, en
español neutro.

## Flujo (no te saltes pasos)

1. **Entender el brief.** De la idea saca: tema, ángulo, público y objetivo (aprender,
   sorprender, convencer). Si la idea es ambigua, elige el ángulo más concreto y
   sorprendente y dilo en una línea; pregunta solo si de verdad no se puede decidir.

2. **Investigar (obligatorio si hay datos).** Usa WebSearch o Perplexity
   (`perplexity_ask`; `perplexity_research` solo si el tema es complejo). Reúne 3-6
   hechos con cifras y 2-4 URLs fiables. Nada de cifras inventadas: si un dato no
   aparece en las fuentes, no va en el guion. Guarda las URLs en `fuentes` de reel.json.

3. **Escribir el guion** (25-45 s, ~70-110 palabras de narración en total):
   - **Gancho ≤ 3 s** (≤ 9 palabras): dato chocante, pregunta concreta o promesa del
     resultado. Sin saludos ni "en este video".
   - **4-6 beats**, una idea por escena, ≤ 25 palabras cada una. Frases cortas,
     habladas, en segunda persona. Cada escena debe dar ganas de ver la siguiente.
   - **CTA final** corto y específico: guardar (contenido útil), compartir ("envíaselo
     a…"), comentar (pregunta) o seguir.
   - Escribe la narración para el oído: números como se dicen ("quinientos millones")
     si son grandes; el número visual va en los campos de la plantilla.

4. **Montar `reels/<slug>/reel.json`** (slug en minúsculas con guiones) usando **solo**
   las 8 plantillas de abajo. Varía las plantillas: no repitas el mismo tipo dos veces
   seguidas. Primera escena `gancho`, última `cta`.

5. **Producir:**
   ```bash
   python herramientas/reel.py validar reels/<slug>      # corrige todo ERROR antes de seguir
   python herramientas/reel.py todo reels/<slug> --sin-video
   ```
   `todo` genera voz, imágenes, música y las previas PNG. Tarda 1-3 min (más si hay
   imágenes sin clave de Pollinations: 45 s entre cada una).

6. **Revisar las previas.** Abre con Read cada `reels/<slug>/previas/escena_XX.png`
   y comprueba: texto legible y sin cortes, nada fuera de la zona útil, emojis
   correctos, imagen IA coherente (si falló, la escena muestra su emoji: está bien).
   Si algo falla, edita reel.json (textos más cortos, otro emoji, otra plantilla) y
   repite `python herramientas/reel.py previas reels/<slug>`. Si cambias narraciones,
   corre antes `voz` (solo rehace las escenas cambiadas).

7. **Render final:** `python herramientas/reel.py render reels/<slug>` → `final.mp4`.
   Entrega al usuario: ruta del MP4, duración, guion en texto plano, fuentes, y una
   propuesta de caption (2-3 líneas + 3-5 hashtags). Avisa si hubo voz de respaldo
   (espeak-ng) o imágenes que cayeron a emoji.

## Esquema de reel.json

```jsonc
{
  "titulo": "Texto interno del reel",
  "tema": "noche",            // noche (oscuro/amarillo, por defecto) | editorial (claro, revista)
                              // | energia (morado/rosa, tech) | oceano (azul/turquesa, naturaleza)
  "musica": {"animo": "inspirador"},  // energico | tranquilo | misterioso | inspirador | divertido
  "voz": {"nombre": "es-MX-JorgeNeural", "velocidad": "+8%"},  // opcional
  "efectos": true,            // whoosh entre escenas y "ding" en los datos
  "fuentes": ["https://..."],
  "escenas": [ /* ver plantillas */ ]
}
```

Cada escena lleva `tipo` y `narracion` (lo que dice la voz). Los campos `audio`,
`recorteMs`, `duracionMs`, `palabras`, `_voz` e `imagen.archivo` los rellena
`reel.py`: no los escribas a mano. `"subtitulos": false` oculta los subtítulos de una
escena (útil si la pantalla ya muestra exactamente lo mismo).

### Las 8 plantillas

| tipo | campos | para qué |
|---|---|---|
| `gancho` | `titulo`, `emoji?`, `imagen?` | Apertura. Título ≤ 7 palabras. Con `imagen` va de fondo a pantalla completa. |
| `dato` | `numero`, `etiqueta`, `prefijo?`, `sufijo?`, `decimales?` | Una cifra que cuenta hacia arriba. `numero` es numérico (`95`, `sufijo: "%"`). Etiqueta ≤ 10 palabras. |
| `lista` | `titulo`, `items: [{emoji?, texto}]` (2-5) | Pasos o elementos; aparecen repartidos a lo largo de la narración. Textos ≤ 5 palabras. |
| `imagen` | `imagen?`, `emoji`, `titulo?` | Momento visual. Pon siempre `emoji` como respaldo. |
| `comparacion` | `izquierda`, `derecha` (`{titulo, texto?, emoji?}`), `ganador?` | A vs B. Títulos ≤ 12 letras, textos ≤ 4 palabras. El ganador se ilumina a mitad de la narración. |
| `frase` | `texto`, `autor?` | Afirmación potente o cita. ≤ 12 palabras; resalta 1-2 palabras. |
| `grafico` | `titulo`, `barras: [{etiqueta, valor}]` (2-5), `unidad?`, `destacar?` | Barras que crecen. Etiquetas ≤ 9 letras. `destacar` = índice (por defecto, la mayor). |
| `cta` | `texto`, `subtexto?`, `accion?` | Cierre. `accion`: guardar \| seguir \| comentar \| compartir (cambia el icono). |

**Resaltar:** en `titulo`, `texto` y `etiqueta`, las palabras entre `*asteriscos*` van
en color de acento (en `frase`, con marcador). Resalta 1-3 palabras clave por escena,
nunca frases enteras. Ej.: `"Tu cerebro *te engaña* cada día"`. La puntuación pegada
(`*es*,`) se maneja bien. No uses asteriscos en `narracion` (se ignoran).

**Imágenes IA** (`imagen: {"prompt": "..."}`): máximo 3 por reel, solo en `gancho` e
`imagen`, y solo cuando una imagen aporte más que un emoji (un lugar, un animal, una
escena). Prompt en inglés, descriptivo y sin texto. Pollinations sin clave es lento y
a veces falla; con `POLLINATIONS_API_KEY` en el entorno es más fiable.

## Ejemplo mínimo

```json
{
  "titulo": "Pulpo", "tema": "oceano", "musica": {"animo": "misterioso"},
  "fuentes": ["https://education.nationalgeographic.org/resource/animals-101-octopuses/"],
  "escenas": [
    {"tipo": "gancho", "emoji": "🐙", "titulo": "Este animal tiene *tres corazones*",
     "imagen": {"prompt": "close-up of an octopus on a dark reef, blue light"},
     "narracion": "Tiene tres corazones. Y no es lo más raro."},
    {"tipo": "dato", "numero": 500, "sufijo": " M", "etiqueta": "de neuronas, *dos tercios* en los brazos",
     "narracion": "Tiene unos quinientos millones de neuronas, y dos tercios están en sus brazos."},
    {"tipo": "cta", "texto": "*Guárdalo* para tu próxima charla", "accion": "guardar",
     "narracion": "Guárdalo para tu próxima charla."}
  ]
}
```
Ejemplo completo: `reels/pulpo/reel.json`.

## Problemas comunes

- `edge-tts falló` → sin conexión o servicio caído; `reel.py` usa espeak-ng (robótico)
  si está instalado. Vuelve a correr `python herramientas/reel.py voz reels/<slug> --forzar`
  cuando haya conexión, antes del render final.
- Texto cortado o encimado en una previa → acorta el texto o cambia de plantilla; no
  edites los componentes de `estudio/` para un reel puntual.
- Música: si existe `biblioteca/musica/<animo>/` con MP3 (Pixabay/Mixkit, sin
  atribución), se usa una de ahí; si no, se genera una base instrumental sencilla.
- Primer uso en un PC nuevo: `cd estudio && npm ci` y `pip install edge-tts numpy`.
