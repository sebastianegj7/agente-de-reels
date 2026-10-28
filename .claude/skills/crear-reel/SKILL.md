---
name: crear-reel
description: Crea un Reel de Instagram (MP4 vertical 9:16, 25-45 s) a partir de una idea - investiga el tema con fuentes, escribe un guion con gancho en forma de pregunta, lo monta con videos reales (Pexels/Pixabay) con zooms y marcas animadas sincronizadas con la voz, motion graphics de Remotion, voz expresiva (Gemini TTS), subtítulos y música, y entrega final.mp4. Úsala cuando el usuario pida "hazme un reel", "crea un reel sobre…", "/crear-reel <idea>" o un video corto vertical para Instagram/TikTok/Shorts.
model: sonnet
---

# Crear reel

Convierte una idea en `reels/<slug>/final.mp4`. Trabaja desde la raíz del repo
`agente-de-reels`. Habla con el usuario de tú, en español neutro.

**La meta es que nadie pase el video.** Cada decisión (gancho, ritmo, visual) se juzga
con una pregunta: *¿esto hace que alguien siga mirando 2 segundos más?*

## Flujo (no te saltes pasos)

### 1. Encontrar la pregunta
Convierte la idea en **la pregunta que una persona real se hizo** alguna vez y nunca
resolvió ("¿Es verdad que el pulpo tiene 9 cerebros?", "¿Por qué los aviones no vuelan
en línea recta?", "¿Qué pasa si no duermes 3 días?"). El reel es la respuesta que le
aparece de la nada. Si el usuario da un tema amplio, elige la pregunta más concreta y
curiosa y dila en una línea antes de seguir.

### 2. Investigar (obligatorio)
WebSearch o Perplexity (`perplexity_ask`; `perplexity_research` si el tema es complejo).
Reúne 3-6 hechos con cifras y 2-4 URLs fiables. **Nada inventado**: si un dato no está
en las fuentes, no va. Busca también el dato que *sorprende* (el giro) y el matiz que
corrige un mito: suelen ser el mejor gancho y el mejor remate.

### 3. Guion (25-45 s, ~70-110 palabras en total)
Estructura de **bucle abierto**:
1. **Gancho (≤ 3 s, ≤ 9 palabras):** la pregunta, dicha como la diría la persona.
   Pantalla: la pregunta en grande sobre un video real del tema. Nunca saludos, nunca
   "en este video", nunca empezar por la respuesta.
2. **Tensión (1 escena):** "La respuesta es más rara de lo que crees" / "Casi todos se
   equivocan" — promete el giro sin darlo.
3. **Desarrollo (3-4 escenas):** una idea por escena, cada una responde un poco y abre
   otra pregunta. Frases cortas, habladas, en segunda persona. Señala cosas concretas
   en el video ("mira aquí", "esta parte").
4. **Remate:** la respuesta completa a la pregunta del gancho, en una frase memorable.
5. **CTA (≤ 2 s):** específico. Si el tema da para debate, pregunta para comentar; si es
   útil, guardar; si es sorprendente, "envíaselo a quien…".

Reglas de ritmo:
- Cada escena dura 2-5 s (≤ 16 palabras; el gancho y el CTA, menos).
- **Algo debe cambiar en pantalla cada ~2 s**: escena nueva, zoom, marca, cifra que sube.
- Escribe para el oído: números grandes en palabras ("quinientos millones"); el número
  visual va en los campos de la plantilla.

### 4. Montar `reels/<slug>/reel.json`
Slug en minúsculas con guiones. Usa las plantillas de abajo. **Al menos la mitad de las
escenas llevan `medio`** (video real): las escenas `clip` muestran el video limpio con
zooms y marcas; las demás plantillas lo usan de fondo oscurecido. Tema oscuro
(`noche`, `energia`, `oceano`) cuando hay videos de fondo.

`medio.busqueda`: en inglés, 2-4 palabras concretas y visuales ("octopus close up",
"octopus tentacle suckers", "airplane wing clouds"). Evita conceptos abstractos; si el
tema no se puede filmar, usa `medio.prompt` (imagen IA, máx. 3 por reel) o ninguna.
No pongas todavía `camara` ni `marcas`: se escriben en el paso 6 mirando el video.

### 5. Preparar
```bash
python herramientas/reel.py validar reels/<slug>    # corrige todo ERROR
python herramientas/reel.py preparar reels/<slug>   # voz + videos + música + cuadrículas
```
Lee la salida: avisa si la voz cayó a edge-tts/espeak o si una escena quedó sin video.

### 6. Dirigir cámara y marcas (lo que hace que se vea profesional)
Para cada escena con medio, abre con Read `reels/<slug>/cuadriculas/escena_XXa.jpg` y
`…b.jpg` (inicio y ~70 % de la escena; cuadrícula al 10 %, x de izquierda a derecha,
y de arriba a abajo). Decide:
- **¿Sirve el video?** Si no muestra lo que dice la narración, añade su id a
  `medio.excluir` (o cambia `busqueda`) y corre `python herramientas/reel.py medios
  reels/<slug> --forzar`. Si `a` y `b` muestran el objeto en sitios muy distintos, el
  video se mueve: usa marcas de tipo `etiqueta` o ninguna, no círculos.
- **`camara`**: lista de puntos `{x, y, zoom, en}`. El primero es el encuadre inicial
  (zoom 1-1.15); los siguientes acercan (zoom 1.4-2.2) al objeto **cuando la voz dice
  la palabra `en`**. Al acercarse, el objeto sube solo al centro de la zona útil.
- **`marcas`**: `{forma, x, y, texto, en}` sobre el objeto (coordenadas de la
  cuadrícula, sin zoom). `circulo` (con `radio` 0.06-0.2 del ancho) para rodear una
  parte; `flecha` para señalar algo pequeño; `punto` para un lugar; `etiqueta` solo
  rótulo. `texto` de 1-3 palabras. Máx. 2 marcas por escena.
- `en` debe ser una palabra que esté en la narración de esa escena (el validador lo
  comprueba). Sincroniza lo visual con lo que se dice: cuando la voz dice "brazos",
  la cámara llega a los brazos y aparece el círculo.

Después: `python herramientas/reel.py previas reels/<slug>`.

### 7. Revisar previas
Abre cada `reels/<slug>/previas/escena_XX.png` y comprueba: se entiende de un vistazo,
texto legible y sin cortes, nada importante bajo los subtítulos (y > 0.6) ni en los
bordes, marcas sobre el objeto correcto. Corrige reel.json y repite `previas`. Si
cambias narraciones, corre antes `voz`.

### 8. Render y entrega
`python herramientas/reel.py render reels/<slug>` → `final.mp4`. Entrega: ruta del MP4,
duración, guion, fuentes, propuesta de caption (2-3 líneas que repitan la pregunta +
3-5 hashtags) y **créditos de los videos** (`medio.credito` de cada escena; Pexels pide
mencionar al autor cuando sea posible). Avisa si hubo voz de respaldo o escenas sin video.

## Esquema de reel.json

```jsonc
{
  "titulo": "Texto interno",
  "tema": "oceano",                  // noche | energia | oceano (oscuros) | editorial (claro, sin videos)
  "musica": {"animo": "misterioso"}, // energico | tranquilo | misterioso | inspirador | divertido
  "voz": {                           // todo opcional
    "gemini": "Puck",                // voz de Gemini TTS
    "estilo": "Narra con intriga…",  // instrucción de tono para Gemini (cámbiala según el tema)
    "nombre": "es-MX-JorgeNeural"    // voz de edge-tts (respaldo)
  },
  "efectos": true,
  "fuentes": ["https://..."],
  "escenas": [ /* ... */ ]
}
```

Campos comunes a **todas** las escenas:
- `tipo`, `narracion` (lo que dice la voz; sin asteriscos).
- `medio?`: `{busqueda}` (video real) o `{prompt}` (imagen IA). Opcionales: `inicioS`
  (segundo del video desde el que empieza), `velocidad` (0.6-1; cámara lenta da tono
  cinematográfico), `excluir` (ids descartados).
- `camara?`: puntos de cámara (ver paso 6). Sirve también como fondo de otras plantillas.
- `subtitulos?: false` oculta los subtítulos de esa escena.

`reel.py` rellena `audio`, `recorteMs`, `duracionMs`, `palabras`, `_voz`,
`medio.archivo/tipo/id/credito/duracionS`: no los escribas a mano.

### Plantillas

| tipo | campos | para qué |
|---|---|---|
| `gancho` | `titulo`, `emoji?` | La pregunta. Título ≤ 8 palabras, resalta la parte intrigante. Con `medio`, sobre video. |
| `clip` | `titulo?`, `emoji`, `marcas?`, `posicionTitulo?` (`arriba`\|`abajo`) | **El video protagonista** con cámara y marcas. Título corto o ninguno. `emoji` es el respaldo sin video. |
| `dato` | `numero`, `etiqueta`, `prefijo?`, `sufijo?`, `decimales?` | Una cifra que sube. `numero` numérico. Etiqueta ≤ 8 palabras. |
| `comparacion` | `izquierda`, `derecha` (`{titulo, texto?, emoji?}`), `ganador?` | A vs B. Títulos ≤ 12 letras, textos ≤ 4 palabras. |
| `grafico` | `titulo`, `barras: [{etiqueta, valor}]` (2-5), `unidad?`, `destacar?` | Barras que crecen. Etiquetas ≤ 9 letras. |
| `lista` | `titulo`, `items: [{emoji?, texto}]` (2-4) | Solo si de verdad son pasos; no la uses para resumir lo ya dicho. |
| `frase` | `texto`, `autor?` | El remate o una cita. ≤ 12 palabras; resalta 1-2. |
| `imagen` | `imagen?`, `emoji`, `titulo?` | Formato antiguo; prefiere `clip` con `medio`. |
| `cta` | `texto`, `subtexto?`, `accion?` | guardar \| seguir \| comentar \| compartir. |

**Resaltar:** en `titulo`, `texto` y `etiqueta`, `*palabras*` entre asteriscos van en
color de acento (en `frase`, con marcador). 1-3 palabras por escena. La puntuación
pegada (`*es*,`) se maneja bien.

## Ejemplo de escena `clip` dirigida

```json
{"tipo": "clip", "emoji": "🐙",
 "medio": {"busqueda": "octopus arms close up", "velocidad": 0.8},
 "narracion": "Pero dos tercios de sus neuronas están en sus ocho brazos.",
 "camara": [{"x": 0.5, "y": 0.45, "zoom": 1.05},
            {"x": 0.38, "y": 0.62, "zoom": 1.8, "en": "brazos"}],
 "marcas": [{"forma": "circulo", "x": 0.38, "y": 0.62, "radio": 0.12, "texto": "8 brazos", "en": "brazos"}]}
```
Ejemplo de reel completo: `reels/pulpo/reel.json`.

## Problemas comunes

- **Voz plana o robótica:** falta `GEMINI_API_KEY` en `.env` o se agotó la cuota diaria
  (cae a edge-tts; espeak-ng solo es para pruebas sin conexión). Ajusta `voz.estilo`
  al tema (misterio, humor, urgencia). Rehaz con `voz --forzar`.
- **Subtítulos desfasados:** falta `faster-whisper` (`pip install faster-whisper`).
- **Sin videos:** faltan `PEXELS_API_KEY` / `PIXABAY_API_KEY` en `.env`, o la búsqueda
  es muy abstracta: simplifícala en inglés.
- **Texto encimado o cortado:** acorta el texto o cambia de plantilla; no edites
  `estudio/` para un reel puntual.
- Primer uso en un PC: `cd estudio && npm ci`, `pip install -r herramientas/requirements.txt`
  y copiar `.env.ejemplo` a `.env` con las claves.
