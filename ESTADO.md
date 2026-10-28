# Estado del proyecto (para retomar en otra sesión)

Objetivo: skill `crear-reel` (`.claude/skills/crear-reel/SKILL.md`, `model: sonnet`)
que convierte una idea en un reel MP4 9:16 con investigación, guion, animación
(Remotion), voz (edge-tts) y música. Solo herramientas gratuitas. Diseño e
investigación en `DISENO.md`.

## Hecho
- `estudio/`: Remotion 4.0.539, 8 plantillas pulidas tras revisar previas (marcador de
  `frase`, títulos largos en `comparacion`, formato de números, espacios en subtítulos),
  fuentes locales, SFX locales, Chrome local opcional.
- `herramientas/reel.py`: validar, voz (edge-tts + respaldo espeak-ng), imagenes
  (Pollinations, máx. 3), musica (biblioteca o base numpy + sfx), previas, render, todo.
- Skill `crear-reel` con esquema de reel.json, plantillas, convención `*palabra*`.
- Reel de prueba `reels/pulpo/` renderizado de punta a punta (29.9 s). Se hizo en una
  sesión en la nube sin acceso a edge-tts ni Pollinations: usó voz espeak-ng y emoji.

## Versión 2 (más visual)
- Voz Gemini TTS + alineación Whisper (respaldos edge-tts y espeak-ng).
- Videos de Pexels/Pixabay como fondo o protagonistas (`clip`), cámara y marcas
  sincronizadas con palabras, cuadrículas para elegir coordenadas.
- Skill reescrita: gancho-pregunta, bucle abierto, cambio visual cada ~2 s.
- `reels/pulpo/reel.json` reescrito con el nuevo enfoque, **sin producir todavía**:
  esta nube no llega a Gemini/Pexels/Pixabay/Hugging Face. Probado aquí con un video
  sintético y voz simulada (cámara, marcas, cortes por escena y alineación funcionan).

## Para usar en el PC
    cd estudio && npm ci
    pip install -r herramientas/requirements.txt
    copy .env.ejemplo .env      # y pega las claves de Gemini, Pexels y Pixabay
    # en Claude Code: /crear-reel rehaz el reel del pulpo con reels/pulpo/reel.json

## Ideas siguientes
- Llenar `biblioteca/musica/<animo>/` con pistas de Pixabay/Mixkit.
- Copiar la skill a `~/.claude/skills/` si se quiere usar fuera de este repo
  (ajustando las rutas a la ubicación del repo).
- Más plantillas (mapa, línea de tiempo, antes/después con imagen).

## Próximo paso (sesión en el PC de Sebastián)
1. `git fetch origin && git checkout main-q8gyml && git pull`
2. Crear `.env` desde `.env.ejemplo` con GEMINI_API_KEY, PEXELS_API_KEY, PIXABAY_API_KEY.
3. `cd estudio && npm ci` · `pip install -r herramientas/requirements.txt`
4. Producir `reels/pulpo` con la skill crear-reel (desde el paso 5, `preparar`),
   dirigir cámara/marcas mirando `cuadriculas/`, revisar previas y renderizar.
5. Verificar en la práctica: modelo de Gemini TTS que responde (MODELOS_GEMINI en
   reel.py), calidad de la alineación Whisper y relevancia de los clips.
6. Si todo va bien, fusionar `main-q8gyml` en `main`.
