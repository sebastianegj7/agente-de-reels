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
          3. herramientas/reel.py preparar
               validar   esquema, largo, coordenadas, palabras `en` presentes
               voz       Gemini TTS (toda la narración, 1 llamada) → Whisper alinea
                         palabras → se corta por escenas. Respaldo: edge-tts, espeak-ng
               medios    Pexels/Pixabay → medios/ (+ Pollinations si hay `prompt`)
                         y cuadriculas/ (fotogramas con rejilla al 10 %)
               musica    biblioteca/musica/<animo>/ o base generada con numpy; sfx/
          4. mira las cuadrículas (visión) y escribe camara/marcas en reel.json
          5. previas → revisa y corrige → render → final.mp4
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

## Versión 2: más visual y con más gancho (oct. 2026)
La primera prueba (solo motion graphics + voz plana) "se pasaba". Cambios:
- **Voz**: Gemini TTS acepta instrucciones de tono ("con intriga", "cercano") y lee todo
  el guion de una vez, con entonación continua. Como no da tiempos por palabra, se
  alinea con faster-whisper (local, gratis) contra el guion (difflib), y las palabras
  que Whisper escribe distinto (p. ej. "500" por "quinientos") se interpolan.
- **Video real**: cualquier escena puede llevar `medio` (Pexels prioriza verticales,
  Pixabay de respaldo). Plantilla `clip` con **cámara** por puntos clave que llegan
  cuando la voz dice una palabra, y **marcas** (círculo que se dibuja, flecha curva,
  punto pulsante, etiqueta) ancladas al objeto aunque la cámara se mueva. Al hacer zoom,
  el objeto sube al centro de la zona útil para no quedar bajo los subtítulos.
- **Coordenadas**: el modelo no adivina; `reel.py medios` renderiza cada video recortado
  a 9:16 con una rejilla al 10 % (misma lógica de encuadre que el reel) y el modelo
  lee las coordenadas mirando la imagen.
- **Guion**: gancho = la pregunta que la persona se hizo; estructura de bucle abierto
  (pregunta → tensión → respuestas parciales → remate → CTA) y un cambio visual cada ~2 s.

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
| Voz | Gemini TTS (plan gratis de AI Studio) + faster-whisper | Voz expresiva dirigible con instrucciones. Una llamada por reel para cuidar la cuota gratuita. |
| Voz (respaldo) | edge-tts 7.3.1, `es-MX-JorgeNeural`, +8 % | Gratis, marcas por palabra nativas, pero entonación plana. Último recurso: espeak-ng (robótico, solo pruebas). |
| Video | Pexels API + Pixabay API (claves gratis) | Pexels: 200 req/h, pide crédito al autor. Pixabay: 100 req/min, cachear 24 h. |
| Imágenes | Pollinations (flux) | Gratis. Sin clave: ~1 imagen cada 45 s y poco fiable → máx. 3 por reel y emoji de respaldo. Con `POLLINATIONS_API_KEY` usa gen.pollinations.ai. |
| Música | Pixabay Music / Mixkit, descargada a mano en `biblioteca/musica/<animo>/` | Sin atribución obligatoria. No tienen API pública estable, por eso es manual. Si no hay pistas, se genera una base con numpy. |
| SFX | Generados con numpy (whoosh, ding) | Sin dependencias de red ni licencias. |

## Limitaciones conocidas
- edge-tts depende de un servicio de Microsoft no oficial; puede cambiar o limitar.
- Los tiempos de la voz de respaldo son estimados (por letras), no exactos.
- La base musical generada es simple; para publicar, mejor una pista de la biblioteca.
