# Diseño del agente de reels

## Objetivo y restricciones
De una idea a un MP4 vertical (1080×1920, 30 fps, 25-45 s) listo para Instagram Reels,
con investigación verificable, guion, animación, voz, música y subtítulos. Restricciones:
solo herramientas gratuitas; estilo híbrido (motion graphics + imágenes IA puntuales);
temas variados; la skill debe correr con Sonnet (`model: sonnet`) para abaratar.

## Arquitectura

```
idea ──► skill crear-reel (Sonnet)
          1. investiga (WebSearch / Perplexity) → hechos + fuentes
          2. guion → reels/<slug>/reel.json  (solo 8 plantillas, *resaltado*)
          3. herramientas/reel.py todo
               validar   esquema, largo, máx. 3 imágenes
               voz       edge-tts por escena + tiempos por palabra (WordBoundary)
               imagenes  Pollinations → img/ (si falla: emoji de respaldo)
               musica    biblioteca/musica/<animo>/ o base generada con numpy; sfx/
               previas   estudio/render.mjs → previas/escena_XX.png
          4. revisa las previas (visión) y corrige reel.json
          5. render → final.mp4
```

Separar **decisiones creativas** (LLM, en reel.json) de **ejecución determinista**
(Python + Remotion) es lo que permite usar Sonnet: el modelo no escribe código de
animación, solo rellena un esquema pequeño y validado.

### Estudio Remotion (`estudio/`)
- `Reel.tsx`: `TransitionSeries` con una escena por entrada; transiciones rotando
  (slide, fade, wipe); voz por escena recortada (`trimBefore`); música en bucle con
  fundidos; whoosh entre escenas y "ding" en datos.
- `tipos.ts` + `tiempos.json`: la duración de cada escena sale del audio
  (`entrada + audio + cola + transición`); `calculateMetadata` fija la duración total.
- 8 plantillas en `src/escenas/`: gancho, dato, lista, imagen, comparacion, frase,
  grafico, cta. Todas animan en función de la duración de su narración.
- Subtítulos karaoke (`@remotion/captions`, páginas de 2-3 palabras) en y≈1170.
- Zona útil del contenido: y=250…1080, x=80…1000 (fuera quedan la barra superior,
  el texto del autor/caption y los botones de Instagram).
- Fuentes Montserrat y Bebas Neue incluidas como woff2 (OFL) para no depender de red.
- `render.mjs`: un solo bundle para previas (frame al 70 % de cada escena) y video.
  Usa `REMOTION_BROWSER` o el Chrome headless de Playwright si no puede descargar
  el de Remotion.

## Investigación (oct. 2026)

### Buenas prácticas de Reels
- Duración: no hay una cifra mágica; 20-45 s es buen punto de partida para contenido
  informativo, y alargar solo si el tema lo justifica (Hootsuite, Brandlix).
- Los primeros ~3 s deciden la retención: empezar con el dato, la pregunta o el
  resultado, sin saludos (Hootsuite, Quso).
- Debe entenderse sin sonido → subtítulos sincronizados siempre.
- Zonas seguras: contenido clave en el centro; margen arriba, abajo y a la derecha
  por la interfaz.
- Señales: tiempo de visualización y retención; los envíos/compartidos pesan mucho para
  llegar a no seguidores; los guardados indican valor práctico. Por eso el CTA pide
  guardar o enviar.
- Audio: voz clara, música por debajo (volumen 0.10-0.12 en la mezcla).

Fuentes: blog.hootsuite.com/instagram-reels/, blog.hootsuite.com/social-media-video-length/,
brandlix.io/en/blog/instagram-reels-best-practices-for-2026-the-complete-guide,
quso.ai/blog/instagram-reels-best-practices, reelxo.tech/blog/instagram-reels-algorithm.

### Decisiones de herramientas
| Pieza | Elegida | Por qué / descartes |
|---|---|---|
| Animación | Remotion 4.0.539 | React → plantillas reutilizables y render por código. Licencia gratuita para individuos y empresas de ≤ 3 personas. |
| Skills de Remotion | remotion-markup, remotion-captions, remotion-render (de 12 oficiales) | Cubren animación/transiciones, subtítulos y render. HyperFrames se descartó por solaparse con lo anterior. Útiles para quien amplíe las plantillas; la skill crear-reel no las necesita. |
| Voz | edge-tts 7.3.1, `es-MX-JorgeNeural`, +8 % | Gratis, voces neuronales y marcas por palabra (offsets en ticks de 100 ns) para subtítulos exactos. Respaldo offline: espeak-ng (robótico, solo para pruebas). |
| Imágenes | Pollinations (flux) | Gratis. Sin clave: ~1 imagen cada 45 s y poco fiable → máx. 3 por reel y emoji de respaldo. Con `POLLINATIONS_API_KEY` usa gen.pollinations.ai. |
| Música | Pixabay Music / Mixkit, descargada a mano en `biblioteca/musica/<animo>/` | Sin atribución obligatoria. No tienen API pública estable, por eso es manual. Si no hay pistas, se genera una base con numpy. |
| SFX | Generados con numpy (whoosh, ding) | Sin dependencias de red ni licencias. |

## Limitaciones conocidas
- edge-tts depende de un servicio de Microsoft no oficial; puede cambiar o limitar.
- Los tiempos de la voz de respaldo son estimados (por letras), no exactos.
- La base musical generada es simple; para publicar, mejor una pista de la biblioteca.
