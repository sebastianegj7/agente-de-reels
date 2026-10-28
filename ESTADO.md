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

## Para usar en el PC
    cd estudio && npm ci
    pip install -r herramientas/requirements.txt
    python herramientas/reel.py todo reels/pulpo --forzar   # rehace la voz con edge-tts

## Ideas siguientes
- Llenar `biblioteca/musica/<animo>/` con pistas de Pixabay/Mixkit.
- Copiar la skill a `~/.claude/skills/` si se quiere usar fuera de este repo
  (ajustando las rutas a la ubicación del repo).
- Más plantillas (mapa, línea de tiempo, antes/después con imagen).
