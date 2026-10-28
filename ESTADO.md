# Estado del proyecto (para retomar en otra sesión)

Objetivo: skill `crear-reel` que, a partir de una idea, investiga, escribe guion,
anima (Remotion), pone voz (edge-tts, gratis) y música, y entrega un MP4 9:16.
Pensada para ejecutarse con Sonnet. Restricción: solo herramientas gratuitas.

## Hecho
- `estudio/`: proyecto Remotion 4.0.539 con 8 plantillas de escena
  (gancho, dato, lista, imagen, comparacion, frase, grafico, cta), fondo animado,
  subtítulos karaoke, barra de progreso, transiciones y SFX. `npx tsc --noEmit` OK.
- `estudio/render.mjs <carpeta-reel> [previas|video|ambos]`: renderiza previas PNG por escena y final.mp4.
- `reels/_demo/reel.json`: demo sin audio; previas renderizadas OK.
- Skills oficiales de Remotion instaladas en `.claude/skills/` (markup, captions, render).

## Pendiente
1. Revisar visualmente las previas de `_demo` y pulir plantillas.
2. `herramientas/reel.py` con subcomandos: validar, voz (edge-tts por escena, boundary="WordBoundary",
   rellena audio/recorteMs/duracionMs/palabras), imagenes (Pollinations: con POLLINATIONS_API_KEY usa
   gen.pollinations.ai; sin clave, image.pollinations.ai con 1 img/45 s; si falla, la plantilla cae a emoji),
   musica (biblioteca/musica/<animo>/ o pista generada con numpy), previas, render, todo.
3. SKILL.md `crear-reel` con `model: sonnet`: brief → investigación (WebSearch/Perplexity) → guion
   (reel.json) → herramientas → revisar previas → render.
4. DISENO.md con la investigación y la arquitectura.
5. Reel de prueba de punta a punta.
