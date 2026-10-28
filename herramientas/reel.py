#!/usr/bin/env python3
"""Herramientas para producir un reel a partir de su reel.json.

Uso:
    python herramientas/reel.py <comando> <carpeta-del-reel> [opciones]

Comandos:
    validar   revisa reel.json (esquema, largo del guion, imágenes) sin tocar nada
    voz       genera la narración por escena (edge-tts) y los tiempos por palabra
    imagenes  descarga las imágenes IA de Pollinations (máx. 3 por reel)
    musica    elige una pista de biblioteca/musica/<animo>/ o genera una base; crea sfx/
    previas   renderiza un PNG por escena en <carpeta>/previas/
    render    renderiza <carpeta>/final.mp4
    todo      validar + voz + imagenes + musica + previas + render

Todo lo que generan las herramientas se escribe de vuelta en reel.json, así que
cada paso se puede repetir por separado (p. ej. cambiar una narración y volver a
correr `voz`: solo se regeneran las escenas cuyo texto cambió).
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import math
import os
import random
import re
import shutil
import subprocess
import sys
import time
import urllib.parse
import urllib.request
import wave
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ESTUDIO = RAIZ / "estudio"
BIBLIOTECA_MUSICA = RAIZ / "biblioteca" / "musica"

VOZ_POR_DEFECTO = "es-MX-JorgeNeural"
VELOCIDAD_POR_DEFECTO = "+8%"
MAX_IMAGENES = 3
PAUSA_SIN_CLAVE_S = 45  # Pollinations anónimo: ~1 imagen cada 45 s
PALABRAS_POR_SEGUNDO = 2.7  # ritmo aproximado de la voz a +8 %

TIPOS = {
    "gancho": ["titulo"],
    "dato": ["numero", "etiqueta"],
    "lista": ["titulo", "items"],
    "imagen": [],
    "comparacion": ["izquierda", "derecha"],
    "frase": ["texto"],
    "grafico": ["titulo", "barras"],
    "cta": ["texto"],
}
TEMAS = {"noche", "editorial", "energia", "oceano"}
ANIMOS = ["energico", "tranquilo", "misterioso", "inspirador", "divertido"]


# ---------------------------------------------------------------- utilidades

def leer(carpeta: Path) -> dict:
    return json.loads((carpeta / "reel.json").read_text(encoding="utf-8"))


def guardar(carpeta: Path, reel: dict) -> None:
    texto = json.dumps(reel, ensure_ascii=False, indent=2)
    (carpeta / "reel.json").write_text(texto + "\n", encoding="utf-8")


def sin_marcas(texto: str) -> str:
    return texto.replace("*", "")


def contar_palabras(texto: str) -> int:
    return len(sin_marcas(texto).split())


def huella(*partes: str) -> str:
    return hashlib.sha1("|".join(partes).encode("utf-8")).hexdigest()[:12]


def temas_disponibles() -> set[str]:
    try:
        texto = (ESTUDIO / "src" / "temas.ts").read_text(encoding="utf-8")
        bloque = texto[texto.index("export const temas") :]
        return set(re.findall(r"^\t(\w+): \{", bloque, re.M)) or TEMAS
    except (OSError, ValueError):
        return TEMAS


# ------------------------------------------------------------------- validar

def validar(carpeta: Path, estricto: bool = True) -> bool:
    reel = leer(carpeta)
    errores: list[str] = []
    avisos: list[str] = []

    escenas = reel.get("escenas")
    if not isinstance(escenas, list) or not escenas:
        errores.append("reel.json necesita una lista 'escenas' no vacía")
        escenas = []
    if not reel.get("titulo"):
        errores.append("falta 'titulo'")
    temas = temas_disponibles()
    if reel.get("tema") and reel["tema"] not in temas:
        errores.append(f"tema '{reel['tema']}' no existe (usa: {', '.join(sorted(temas))})")

    total_palabras = 0
    imagenes = 0
    for i, e in enumerate(escenas, 1):
        donde = f"escena {i}"
        tipo = e.get("tipo")
        if tipo not in TIPOS:
            errores.append(f"{donde}: tipo '{tipo}' no válido (usa: {', '.join(TIPOS)})")
            continue
        donde = f"escena {i} ({tipo})"
        for campo in TIPOS[tipo]:
            if e.get(campo) in (None, "", []):
                errores.append(f"{donde}: falta '{campo}'")
        narr = e.get("narracion", "")
        if not narr.strip():
            errores.append(f"{donde}: 'narracion' vacía")
        n = contar_palabras(narr)
        total_palabras += n
        if n > 28:
            avisos.append(f"{donde}: {n} palabras de narración; mejor ≤ 25 por escena")
        for campo in ("titulo", "texto", "etiqueta", "narracion"):
            if isinstance(e.get(campo), str) and e[campo].count("*") % 2:
                errores.append(f"{donde}: asteriscos sin cerrar en '{campo}'")
        if tipo == "lista" and not 2 <= len(e.get("items", [])) <= 5:
            errores.append(f"{donde}: 'items' debe tener entre 2 y 5 elementos")
        if tipo == "grafico":
            barras = e.get("barras", [])
            if not 2 <= len(barras) <= 5:
                errores.append(f"{donde}: 'barras' debe tener entre 2 y 5 elementos")
            if any(not isinstance(b.get("valor"), (int, float)) for b in barras):
                errores.append(f"{donde}: cada barra necesita un 'valor' numérico")
        if tipo == "dato" and not isinstance(e.get("numero"), (int, float)):
            errores.append(f"{donde}: 'numero' debe ser numérico (usa prefijo/sufijo para %, $, etc.)")
        if tipo == "comparacion" and e.get("ganador") not in (None, "izquierda", "derecha"):
            errores.append(f"{donde}: 'ganador' debe ser 'izquierda' o 'derecha'")
        if tipo == "cta" and e.get("accion") not in (None, "guardar", "seguir", "comentar", "compartir"):
            errores.append(f"{donde}: 'accion' debe ser guardar, seguir, comentar o compartir")
        img = e.get("imagen")
        if img is not None:
            if tipo not in ("gancho", "imagen"):
                avisos.append(f"{donde}: 'imagen' solo se usa en gancho e imagen; se ignora")
            elif img.get("prompt") or img.get("archivo"):
                imagenes += 1
                if not e.get("emoji"):
                    avisos.append(f"{donde}: añade 'emoji' como respaldo por si la imagen falla")
        if tipo == "imagen" and not (img or e.get("emoji")):
            errores.append(f"{donde}: necesita 'imagen' o 'emoji'")

    if escenas:
        if escenas[0].get("tipo") != "gancho":
            avisos.append("la primera escena debería ser 'gancho'")
        if escenas[-1].get("tipo") != "cta":
            avisos.append("la última escena debería ser 'cta'")
        if not 4 <= len(escenas) <= 9:
            avisos.append(f"{len(escenas)} escenas; lo habitual es 5-8")
        primera = contar_palabras(escenas[0].get("narracion", ""))
        if primera > 10:
            avisos.append(f"el gancho tiene {primera} palabras; para ≤ 3 s usa ≤ 9")
    if imagenes > MAX_IMAGENES:
        errores.append(f"{imagenes} imágenes IA; el máximo es {MAX_IMAGENES}")

    segundos = total_palabras / PALABRAS_POR_SEGUNDO + 0.4 * len(escenas)
    if total_palabras and not 22 <= segundos <= 50:
        avisos.append(f"duración estimada {segundos:.0f} s; apunta a 25-45 s")

    for a in avisos:
        print(f"  aviso: {a}")
    for err in errores:
        print(f"  ERROR: {err}")
    estado = "OK" if not errores else "con errores"
    print(
        f"Validación {estado}: {len(escenas)} escenas, {total_palabras} palabras, "
        f"~{segundos:.0f} s estimados, {imagenes} imágenes IA."
    )
    if errores and estricto:
        sys.exit(1)
    return not errores


# ----------------------------------------------------------------------- voz

TICKS_POR_MS = 10_000  # edge-tts da offsets en unidades de 100 ns


async def _edge_tts(texto: str, voz: str, velocidad: str, destino: Path) -> list[dict]:
    import edge_tts

    kwargs = {}
    proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    if proxy:
        kwargs["proxy"] = proxy
    comunicar = edge_tts.Communicate(texto, voz, rate=velocidad, boundary="WordBoundary", **kwargs)
    limites = []
    with destino.open("wb") as f:
        async for trozo in comunicar.stream():
            if trozo["type"] == "audio":
                f.write(trozo["data"])
            elif trozo["type"] == "WordBoundary":
                limites.append(trozo)
    if not limites or destino.stat().st_size < 1000:
        raise RuntimeError("edge-tts no devolvió audio")
    return [
        {
            "texto": b["text"],
            "inicioMs": b["offset"] / TICKS_POR_MS,
            "finMs": (b["offset"] + b["duration"]) / TICKS_POR_MS,
        }
        for b in limites
    ]


def _voz_edge(texto: str, voz: str, velocidad: str, base: Path) -> tuple[Path, list[dict]]:
    destino = base.with_suffix(".mp3")
    ultimo_error: Exception | None = None
    for intento in range(3):
        try:
            return destino, asyncio.run(_edge_tts(texto, voz, velocidad, destino))
        except Exception as err:  # red, límite de uso, etc.
            ultimo_error = err
            time.sleep(2 * (intento + 1))
    destino.unlink(missing_ok=True)
    raise RuntimeError(f"edge-tts falló: {ultimo_error}")


def _voz_local(texto: str, velocidad: str, base: Path) -> tuple[Path, list[dict]]:
    """Respaldo sin conexión con espeak-ng. Suena robótico: solo para pruebas.

    espeak-ng no da tiempos por palabra, así que se estiman repartiendo la
    parte con voz del audio en proporción a las letras de cada palabra.
    """
    import numpy as np

    programa = shutil.which("espeak-ng") or shutil.which("espeak")
    if not programa:
        raise RuntimeError("no hay espeak-ng instalado para la voz de respaldo")
    pct = int(re.sub(r"[^\d-]", "", velocidad) or 0)
    destino = base.with_suffix(".wav")
    subprocess.run(
        [programa, "-v", "es-419", "-s", str(int(165 * (1 + pct / 100))), "-w", str(destino), texto],
        check=True,
        capture_output=True,
    )
    with wave.open(str(destino)) as w:
        sr = w.getframerate()
        datos = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32)
    activo = np.nonzero(np.abs(datos) > 600)[0]
    ini_ms = activo[0] / sr * 1000 if len(activo) else 0.0
    fin_ms = activo[-1] / sr * 1000 if len(activo) else len(datos) / sr * 1000
    palabras = texto.split()
    pesos = [len(p) + 2 for p in palabras]
    total = sum(pesos) or 1
    t = ini_ms
    limites = []
    for p, peso in zip(palabras, pesos):
        dur = (fin_ms - ini_ms) * peso / total
        limites.append({"texto": re.sub(r"[^\wáéíóúüñÁÉÍÓÚÜÑ%$€'-]", "", p) or p, "inicioMs": t, "finMs": t + dur * 0.92})
        t += dur
    return destino, limites


def voz(carpeta: Path, motor: str = "auto", forzar: bool = False) -> None:
    reel = leer(carpeta)
    cfg = reel.get("voz") or {}
    nombre = cfg.get("nombre", VOZ_POR_DEFECTO)
    velocidad = cfg.get("velocidad", VELOCIDAD_POR_DEFECTO)
    (carpeta / "audio").mkdir(exist_ok=True)
    usar_local = motor == "local"

    for i, e in enumerate(reel["escenas"], 1):
        texto = sin_marcas(e["narracion"]).strip()
        h = huella(texto, nombre, velocidad)
        audio = carpeta / e["audio"] if e.get("audio") else None
        if not forzar and e.get("_voz") == h and audio and audio.exists():
            print(f"Voz {i}: sin cambios")
            continue
        base = carpeta / "audio" / f"escena_{i:02d}"
        for viejo in base.parent.glob(base.name + ".*"):
            viejo.unlink()
        if not usar_local:
            try:
                archivo, limites = _voz_edge(texto, nombre, velocidad, base)
                origen = "edge"
            except Exception as err:
                if motor == "edge":
                    raise
                print(f"  {err}\n  → uso la voz local de respaldo (espeak-ng) para el resto")
                usar_local = True
        if usar_local:
            archivo, limites = _voz_local(texto, velocidad, base)
            origen = "local"

        recorte = max(0.0, limites[0]["inicioMs"] - 50)
        e["audio"] = archivo.relative_to(carpeta).as_posix()
        e["recorteMs"] = round(recorte)
        e["duracionMs"] = round(limites[-1]["finMs"] - limites[0]["inicioMs"] + 150)
        e["palabras"] = [
            {"texto": b["texto"], "inicioMs": round(b["inicioMs"] - recorte), "finMs": round(b["finMs"] - recorte)}
            for b in limites
        ]
        e["_voz"] = h if origen == "edge" else f"local-{h}"
        print(f"Voz {i}: {e['duracionMs'] / 1000:.1f} s, {len(limites)} palabras ({origen})")
        guardar(carpeta, reel)

    total = sum(e.get("duracionMs", 0) for e in reel["escenas"]) / 1000
    print(f"Narración total: {total:.1f} s")
    if any(str(e.get("_voz", "")).startswith("local-") for e in reel["escenas"]):
        print("  aviso: hay escenas con voz de respaldo; vuelve a correr `voz --forzar` con conexión")


# ------------------------------------------------------------------ imagenes

ESTILO_IMAGEN = ", vertical 9:16 composition, cinematic lighting, highly detailed, no text, no watermark"


def _descargar_imagen(prompt: str, destino: Path, semilla: int) -> bool:
    clave = os.environ.get("POLLINATIONS_API_KEY")
    p = urllib.parse.quote(prompt + ESTILO_IMAGEN, safe="")
    params = urllib.parse.urlencode(
        {"width": 1080, "height": 1920, "nologo": "true", "model": "flux", "seed": semilla}
    )
    if clave:
        url = f"https://gen.pollinations.ai/image/{p}?{params}"
        cabeceras = {"Authorization": f"Bearer {clave}"}
    else:
        url = f"https://image.pollinations.ai/prompt/{p}?{params}"
        cabeceras = {}
    peticion = urllib.request.Request(url, headers={"User-Agent": "agente-de-reels/1.0", **cabeceras})
    try:
        with urllib.request.urlopen(peticion, timeout=150) as r:
            tipo = r.headers.get("Content-Type", "")
            datos = r.read()
    except Exception as err:
        print(f"  falló la descarga: {err}")
        return False
    if not tipo.startswith("image/") or len(datos) < 10_000:
        print(f"  respuesta no válida ({tipo}, {len(datos)} bytes)")
        return False
    destino.write_bytes(datos)
    return True


def imagenes(carpeta: Path, forzar: bool = False) -> None:
    reel = leer(carpeta)
    (carpeta / "img").mkdir(exist_ok=True)
    pendientes = [
        (i, e)
        for i, e in enumerate(reel["escenas"], 1)
        if e.get("tipo") in ("gancho", "imagen") and (e.get("imagen") or {}).get("prompt")
    ]
    if not pendientes:
        print("Sin imágenes IA en este reel.")
        return
    sin_clave = not os.environ.get("POLLINATIONS_API_KEY")
    descargadas = 0
    for n, (i, e) in enumerate(pendientes[:MAX_IMAGENES]):
        img = e["imagen"]
        destino = carpeta / "img" / f"escena_{i:02d}.jpg"
        if not forzar and img.get("archivo") and (carpeta / img["archivo"]).exists():
            print(f"Imagen {i}: ya existe")
            continue
        if sin_clave and descargadas:
            print(f"  (sin POLLINATIONS_API_KEY: espero {PAUSA_SIN_CLAVE_S} s entre imágenes)")
            time.sleep(PAUSA_SIN_CLAVE_S)
        print(f"Imagen {i}: {img['prompt'][:70]}…")
        ok = _descargar_imagen(img["prompt"], destino, semilla=1000 + i)
        if not ok and sin_clave:
            time.sleep(PAUSA_SIN_CLAVE_S)
            ok = _descargar_imagen(img["prompt"], destino, semilla=2000 + i)
        img["archivo"] = destino.relative_to(carpeta).as_posix() if ok else None
        if ok:
            descargadas += 1
        else:
            print(f"  la escena {i} usará su emoji de respaldo")
        guardar(carpeta, reel)
    for i, e in pendientes[MAX_IMAGENES:]:
        print(f"Imagen {i}: se omite (máximo {MAX_IMAGENES} por reel)")


# -------------------------------------------------------------------- musica

SR = 44100

# Progresiones en grados (semitonos sobre la tónica) y parámetros por ánimo.
ESTILOS = {
    "energico": {"bpm": 124, "tonica": 45, "acordes": [[0, 3, 7], [-4, 0, 3], [-9, -5, 0], [-2, 2, 5]], "bombo": True, "arpegio": 4},
    "tranquilo": {"bpm": 78, "tonica": 48, "acordes": [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]], "bombo": False, "arpegio": 2},
    "misterioso": {"bpm": 92, "tonica": 43, "acordes": [[0, 3, 7], [1, 5, 8], [-2, 3, 7], [0, 3, 6]], "bombo": True, "arpegio": 2},
    "inspirador": {"bpm": 100, "tonica": 47, "acordes": [[0, 4, 7], [-5, -1, 2], [-3, 0, 4], [-7, -3, 0]], "bombo": True, "arpegio": 4},
    "divertido": {"bpm": 116, "tonica": 50, "acordes": [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [-5, -1, 2]], "bombo": True, "arpegio": 4},
}


def _hz(midi: float) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


def _generar_musica(animo: str, destino: Path, semilla: int) -> None:
    """Base instrumental sencilla y en bucle: pad + bajo + arpegio + percusión."""
    import numpy as np

    est = ESTILOS.get(animo, ESTILOS["inspirador"])
    rng = np.random.default_rng(semilla)
    pulso = 60 / est["bpm"]
    compas = 4 * pulso
    compases = 16
    total = int(SR * compas * compases)
    t_comp = np.arange(int(SR * compas)) / SR
    izq = np.zeros(total, dtype=np.float32)
    der = np.zeros(total, dtype=np.float32)

    def colocar(senal, inicio_s, pan=0.0):
        a = int(inicio_s * SR)
        b = min(total, a + len(senal))
        s = senal[: b - a]
        izq[a:b] += s * (1 - max(0, pan))
        der[a:b] += s * (1 + min(0, pan))

    for c in range(compases):
        acorde = est["acordes"][c % len(est["acordes"])]
        inicio = c * compas
        # Pad: senos con armónicos suaves y leve desafinación, ataque lento.
        env = np.minimum(1, t_comp / 0.6) * np.minimum(1, (compas - t_comp) / 0.3)
        for k, grado in enumerate(acorde):
            f = _hz(est["tonica"] + 12 + grado)
            onda = sum(
                np.sin(2 * np.pi * f * m * t_comp * (1 + d)) / (m * 1.6)
                for m in (1, 2, 3)
                for d in (-0.0025, 0.0025)
            )
            colocar(0.05 * env * onda, inicio, pan=(k - 1) * 0.4)
        # Bajo: tónica del acorde en negras con decaimiento.
        f_bajo = _hz(est["tonica"] - 12 + acorde[0])
        t_p = np.arange(int(SR * pulso)) / SR
        nota_bajo = 0.22 * np.sin(2 * np.pi * f_bajo * t_p) * np.exp(-t_p * 3.5) * np.minimum(1, t_p / 0.01)
        for p in range(4):
            colocar(nota_bajo, inicio + p * pulso)
        # Arpegio tipo pluck.
        paso = pulso * 2 / est["arpegio"]
        n_notas = int(round(compas / paso))
        t_n = np.arange(int(SR * paso * 1.5)) / SR
        notas = sorted(acorde) + [acorde[0] + 12]
        for j in range(n_notas):
            f = _hz(est["tonica"] + 24 + notas[j % len(notas)])
            pluck = (np.sin(2 * np.pi * f * t_n) + 0.3 * np.sin(4 * np.pi * f * t_n)) * np.exp(-t_n * 9)
            colocar(0.06 * pluck * np.minimum(1, t_n / 0.004), inicio + j * paso, pan=0.35 if j % 2 else -0.35)
        # Percusión: bombo en cada pulso, charles en las corcheas a contratiempo.
        if est["bombo"]:
            t_b = np.arange(int(SR * 0.35)) / SR
            f_bombo = 50 + 90 * np.exp(-t_b * 30)
            bombo = 0.5 * np.sin(2 * np.pi * np.cumsum(f_bombo) / SR) * np.exp(-t_b * 9)
            t_h = np.arange(int(SR * 0.06)) / SR
            ruido = rng.standard_normal(len(t_h))
            charles = 0.05 * np.diff(ruido, prepend=0) * np.exp(-t_h * 70)
            if c >= 2:  # la batería entra al tercer compás
                for p in range(4):
                    colocar(bombo, inicio + p * pulso)
                    colocar(charles, inicio + p * pulso + pulso / 2, pan=0.2)

    mezcla = np.stack([izq, der], axis=1)
    # Fundido corto en los extremos para que el bucle no haga clic.
    f = int(SR * 0.05)
    rampa = np.linspace(0, 1, f)[:, None]
    mezcla[:f] *= rampa
    mezcla[-f:] *= rampa[::-1]
    mezcla /= max(1e-6, np.abs(mezcla).max()) / 0.85
    _escribir_wav(destino, mezcla)


def _escribir_wav(destino: Path, datos) -> None:
    import numpy as np

    if datos.ndim == 1:
        datos = np.stack([datos, datos], axis=1)
    enteros = (np.clip(datos, -1, 1) * 32767).astype("<i2")
    with wave.open(str(destino), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(enteros.tobytes())


def _generar_sfx(carpeta: Path) -> None:
    import numpy as np

    sfx = carpeta / "sfx"
    sfx.mkdir(exist_ok=True)
    rng = np.random.default_rng(7)
    # Whoosh: ruido con un pasa-bajos cuya frecuencia sube y baja.
    n = int(SR * 0.55)
    t = np.arange(n) / SR
    ruido = rng.standard_normal(n)
    corte = 300 + 5000 * np.sin(np.pi * t / t[-1]) ** 2
    alfa = 1 - np.exp(-2 * np.pi * corte / SR)
    filtrado = np.zeros(n)
    y = 0.0
    for k in range(n):
        y += alfa[k] * (ruido[k] - y)
        filtrado[k] = y
    env = np.sin(np.pi * np.clip(t / 0.4, 0, 1)) ** 2
    whoosh = filtrado * env
    _escribir_wav(sfx / "whoosh.wav", 0.8 * whoosh / np.abs(whoosh).max())
    # Ding: dos parciales con decaimiento exponencial.
    t = np.arange(int(SR * 1.2)) / SR
    ding = (np.sin(2 * np.pi * 1318.5 * t) + 0.4 * np.sin(2 * np.pi * 2637 * t)) * np.exp(-t * 5)
    ding *= np.minimum(1, t / 0.003)
    _escribir_wav(sfx / "ding.wav", 0.6 * ding / np.abs(ding).max())


def musica(carpeta: Path, forzar: bool = False) -> None:
    reel = leer(carpeta)
    m = reel.get("musica") or {}
    animo = m.get("animo") or "inspirador"
    if animo not in ANIMOS:
        print(f"  aviso: ánimo '{animo}' desconocido; uso 'inspirador' (opciones: {', '.join(ANIMOS)})")
        animo = "inspirador"
    _generar_sfx(carpeta)
    dir_musica = carpeta / "musica"
    dir_musica.mkdir(exist_ok=True)
    if not forzar and m.get("archivo") and (carpeta / m["archivo"]).exists():
        print(f"Música: ya está ({m['archivo']})")
        return
    semilla = int(huella(reel.get("titulo", ""), animo), 16) % 10_000
    pistas = sorted(
        p for p in (BIBLIOTECA_MUSICA / animo).glob("*") if p.suffix.lower() in (".mp3", ".wav", ".m4a", ".ogg")
    ) if (BIBLIOTECA_MUSICA / animo).is_dir() else []
    if pistas:
        elegida = random.Random(semilla).choice(pistas)
        destino = dir_musica / elegida.name
        shutil.copy2(elegida, destino)
        m.setdefault("volumen", 0.12)
        print(f"Música: {elegida.name} (biblioteca/{animo})")
    else:
        destino = dir_musica / f"base_{animo}.wav"
        _generar_musica(animo, destino, semilla)
        m.setdefault("volumen", 0.10)
        print(f"Música: base generada '{animo}' (no hay pistas en biblioteca/musica/{animo}/)")
    m["animo"] = animo
    m["archivo"] = destino.relative_to(carpeta).as_posix()
    reel["musica"] = m
    guardar(carpeta, reel)


# -------------------------------------------------------------------- render

def _node(carpeta: Path, modo: str) -> None:
    if not (ESTUDIO / "node_modules").is_dir():
        print("Instalando dependencias del estudio (npm ci)…")
        subprocess.run("npm ci", cwd=ESTUDIO, shell=True, check=True)
    subprocess.run(["node", "render.mjs", str(carpeta.resolve()), modo], cwd=ESTUDIO, check=True)


def previas(carpeta: Path) -> None:
    _node(carpeta, "previas")


def render(carpeta: Path) -> None:
    _node(carpeta, "video")
    print(f"Listo: {carpeta / 'final.mp4'}")


# --------------------------------------------------------------------- main

def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="Herramientas de producción de reels")
    ap.add_argument("comando", choices=["validar", "voz", "imagenes", "musica", "previas", "render", "todo"])
    ap.add_argument("carpeta", type=Path, help="carpeta del reel (contiene reel.json)")
    ap.add_argument("--forzar", action="store_true", help="regenera aunque ya exista")
    ap.add_argument(
        "--motor-voz",
        choices=["auto", "edge", "local"],
        default="auto",
        help="auto: edge-tts y, si falla, espeak-ng; edge: solo edge-tts; local: solo espeak-ng",
    )
    ap.add_argument("--sin-video", action="store_true", help="en 'todo', para en las previas")
    a = ap.parse_args()
    carpeta = a.carpeta.resolve()
    if not (carpeta / "reel.json").exists():
        sys.exit(f"No existe {carpeta / 'reel.json'}")

    if a.comando == "validar":
        validar(carpeta)
    elif a.comando == "voz":
        voz(carpeta, a.motor_voz, a.forzar)
    elif a.comando == "imagenes":
        imagenes(carpeta, a.forzar)
    elif a.comando == "musica":
        musica(carpeta, a.forzar)
    elif a.comando == "previas":
        previas(carpeta)
    elif a.comando == "render":
        render(carpeta)
    elif a.comando == "todo":
        validar(carpeta)
        voz(carpeta, a.motor_voz, a.forzar)
        imagenes(carpeta, a.forzar)
        musica(carpeta, a.forzar)
        _node(carpeta, "previas" if a.sin_video else "ambos")
        if not a.sin_video:
            print(f"Listo: {carpeta / 'final.mp4'}")


if __name__ == "__main__":
    main()
