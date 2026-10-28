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
import urllib.error
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
    "clip": ["medio"],
}
TEMAS = {"noche", "editorial", "energia", "oceano"}
ANIMOS = ["energico", "tranquilo", "misterioso", "inspirador", "divertido"]


# ---------------------------------------------------------------- utilidades

def cargar_env() -> None:
    """Lee claves de <repo>/.env (GEMINI_API_KEY, PEXELS_API_KEY, ...) sin pisar el entorno."""
    ruta = RAIZ / ".env"
    if not ruta.exists():
        return
    for linea in ruta.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if linea and not linea.startswith("#") and "=" in linea:
            clave, valor = linea.split("=", 1)
            os.environ.setdefault(clave.strip(), valor.strip().strip('"').strip("'"))


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
        palabras_narr = {_normalizar(p) for p in sin_marcas(narr).split()}

        def revisar_momento(obj: dict, que: str) -> None:
            if obj.get("en") and not any(p.startswith(_normalizar(obj["en"])) for p in palabras_narr):
                errores.append(f"{donde}: {que} usa en='{obj['en']}', que no está en la narración")

        def revisar_xy(obj: dict, que: str) -> None:
            for eje in ("x", "y"):
                if not isinstance(obj.get(eje), (int, float)) or not 0 <= obj[eje] <= 1:
                    errores.append(f"{donde}: {que} necesita '{eje}' entre 0 y 1")

        medio = e.get("medio")
        if medio is not None:
            if not (medio.get("busqueda") or medio.get("prompt") or medio.get("archivo")):
                errores.append(f"{donde}: 'medio' necesita 'busqueda' (video real) o 'prompt' (imagen IA)")
            if medio.get("prompt") and not medio.get("busqueda"):
                imagenes += 1
        for k, punto in enumerate(e.get("camara") or [], 1):
            revisar_xy(punto, f"camara[{k}]")
            if not isinstance(punto.get("zoom"), (int, float)) or not 1 <= punto["zoom"] <= 3:
                errores.append(f"{donde}: camara[{k}] necesita 'zoom' entre 1 y 3")
            revisar_momento(punto, f"camara[{k}]")
        if e.get("camara") and not medio:
            avisos.append(f"{donde}: 'camara' sin 'medio' no hace nada")
        for k, marca in enumerate(e.get("marcas") or [], 1):
            revisar_xy(marca, f"marcas[{k}]")
            if marca.get("forma") not in ("circulo", "flecha", "punto", "etiqueta"):
                errores.append(f"{donde}: marcas[{k}].forma debe ser circulo, flecha, punto o etiqueta")
            revisar_momento(marca, f"marcas[{k}]")
        if tipo == "clip" and medio and not e.get("emoji"):
            avisos.append(f"{donde}: añade 'emoji' como respaldo por si no se encuentra el medio")
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


def _aplicar(e: dict, carpeta: Path, archivo: Path, limites: list[dict], firma: str, inicio_seg_ms: float = 0.0, fin_seg_ms: float | None = None) -> None:
    """Rellena audio/recorteMs/duracionMs/palabras de una escena a partir de sus límites por palabra."""
    recorte = max(0.0, limites[0]["inicioMs"] - 50)
    duracion = limites[-1]["finMs"] - limites[0]["inicioMs"] + 150
    if fin_seg_ms is not None:
        duracion = min(duracion, fin_seg_ms - inicio_seg_ms - recorte)
    e["audio"] = archivo.relative_to(carpeta).as_posix()
    e["recorteMs"] = round(recorte)
    e["duracionMs"] = round(duracion)
    e["palabras"] = [
        {"texto": b["texto"], "inicioMs": round(b["inicioMs"] - recorte), "finMs": round(b["finMs"] - recorte)}
        for b in limites
    ]
    e["_voz"] = firma


# --- Gemini TTS: toda la narración en una llamada (mejor entonación y un solo
# uso de la cuota gratuita), luego Whisper la alinea palabra por palabra y se
# corta en escenas.

MODELOS_GEMINI = ["gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts", "gemini-2.5-pro-preview-tts"]
VOZ_GEMINI = "Puck"
ESTILO_GEMINI = (
    "Narra en español latinoamericano neutro, como un creador de reels de divulgación que le cuenta "
    "a un amigo algo fascinante: cercano, con intriga y energía, ritmo ágil, énfasis natural en las "
    "cifras y en las preguntas, nada de tono de locutor de radio. Pausa breve entre párrafos. "
    "Lee exactamente este texto, sin añadir nada:"
)


def _clave_gemini() -> str | None:
    return os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")


def _gemini_tts(texto: str, voz_gemini: str, estilo: str, destino: Path) -> None:
    import base64

    clave = _clave_gemini()
    cuerpo = json.dumps(
        {
            "contents": [{"parts": [{"text": f"{estilo}\n\n{texto}"}]}],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voz_gemini}}},
            },
        }
    ).encode("utf-8")
    modelos = [os.environ["GEMINI_TTS_MODELO"]] if os.environ.get("GEMINI_TTS_MODELO") else MODELOS_GEMINI
    ultimo = ""
    for modelo in modelos:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent"
        peticion = urllib.request.Request(
            url, data=cuerpo, headers={"Content-Type": "application/json", "x-goog-api-key": clave}
        )
        try:
            with urllib.request.urlopen(peticion, timeout=300) as r:
                respuesta = json.loads(r.read())
        except urllib.error.HTTPError as err:
            detalle = err.read().decode("utf-8", "replace")[:300]
            ultimo = f"{modelo}: HTTP {err.code} {detalle}"
            if "API_KEY" in detalle or err.code in (401, 403):
                raise RuntimeError("GEMINI_API_KEY no es válida (revísala en aistudio.google.com/apikey)") from err
            if err.code in (400, 404):  # modelo inexistente o retirado: prueba el siguiente
                continue
            raise RuntimeError(f"Gemini TTS falló ({ultimo})") from err
        partes = respuesta.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        datos = next((p["inlineData"] for p in partes if "inlineData" in p), None)
        if not datos:
            raise RuntimeError(f"Gemini TTS no devolvió audio: {str(respuesta)[:300]}")
        audio = base64.b64decode(datos["data"])
        if audio[:4] == b"RIFF":
            destino.write_bytes(audio)
        else:  # PCM crudo de 16 bits, mono
            tasa = int((re.search(r"rate=(\d+)", datos.get("mimeType", "")) or [0, 24000])[1])
            with wave.open(str(destino), "wb") as w:
                w.setnchannels(1)
                w.setsampwidth(2)
                w.setframerate(tasa)
                w.writeframes(audio)
        print(f"  Gemini TTS: {modelo}, voz {voz_gemini}")
        return
    raise RuntimeError(f"ningún modelo de Gemini TTS respondió ({ultimo})")


def _normalizar(p: str) -> str:
    import unicodedata

    p = unicodedata.normalize("NFD", p.lower())
    return re.sub(r"[^a-z0-9ñ]", "", "".join(c for c in p if unicodedata.category(c) != "Mn"))


def _leer_wav(ruta: Path):
    import numpy as np

    with wave.open(str(ruta)) as w:
        tasa, canales = w.getframerate(), w.getnchannels()
        datos = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2")
    if canales > 1:
        datos = datos.reshape(-1, canales).mean(axis=1).astype("<i2")
    return datos, tasa


def _transcribir(ruta: Path, guion: str) -> list[tuple[str, float, float]] | None:
    """Palabras reconocidas con tiempos (ms) usando faster-whisper, o None si no está instalado."""
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        return None
    modelo = WhisperModel(os.environ.get("WHISPER_MODELO", "small"), device="cpu", compute_type="int8")
    segmentos, _ = modelo.transcribe(
        str(ruta), language="es", word_timestamps=True, initial_prompt=guion[:600], beam_size=5
    )
    return [(w.word, w.start * 1000, w.end * 1000) for s in segmentos for w in (s.words or [])]


def _alinear(guion: list[str], reconocidas: list[tuple[str, float, float]] | None, datos, tasa) -> tuple[list[tuple[float, float]], float]:
    """Tiempos (inicio, fin) en ms para cada palabra del guion y fracción alineada."""
    import difflib
    import numpy as np

    activo = np.nonzero(np.abs(datos) > 500)[0]
    voz_ini = activo[0] / tasa * 1000 if len(activo) else 0.0
    voz_fin = activo[-1] / tasa * 1000 if len(activo) else len(datos) / tasa * 1000
    tiempos: list[tuple[float, float] | None] = [None] * len(guion)
    proporcion = 0.0
    if reconocidas:
        a = [_normalizar(p) for p in guion]
        b = [_normalizar(w[0]) for w in reconocidas]
        emparejadas = 0
        for bloque in difflib.SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks():
            for k in range(bloque.size):
                _, ini, fin = reconocidas[bloque.b + k]
                tiempos[bloque.a + k] = (ini, fin)
                emparejadas += 1
        proporcion = emparejadas / max(1, len(guion))
    # Las palabras sin pareja (números leídos distinto, etc.) se reparten por letras
    # entre las anclas vecinas.
    i = 0
    while i < len(guion):
        if tiempos[i] is not None:
            i += 1
            continue
        j = i
        while j < len(guion) and tiempos[j] is None:
            j += 1
        desde = tiempos[i - 1][1] if i > 0 else voz_ini
        hasta = tiempos[j][0] if j < len(guion) else voz_fin
        pesos = [len(p) + 2 for p in guion[i:j]]
        total = sum(pesos)
        t = desde
        for k, peso in zip(range(i, j), pesos):
            d = (hasta - desde) * peso / total
            tiempos[k] = (t, t + d * 0.9)
            t += d
        i = j
    return tiempos, proporcion  # type: ignore[return-value]


def _estimar_por_silencios(palabras: list[list[str]], datos, tasa) -> list[tuple[float, float]]:
    """Sin Whisper: corta escenas en los silencios más largos y reparte palabras por letras."""
    import numpy as np

    paso = int(tasa * 0.02)
    n = len(datos) // paso
    energia = np.sqrt((datos[: n * paso].astype(np.float32).reshape(n, paso) ** 2).mean(axis=1))
    callado = energia < max(300.0, energia.max() * 0.03)
    silencios, k = [], 0
    while k < n:
        if callado[k]:
            j = k
            while j < n and callado[j]:
                j += 1
            if k > 0 and j < n:  # solo silencios internos
                silencios.append((j - k, (k + j) / 2 * 20.0))
            k = j
        else:
            k += 1
    cortes = sorted(c for _, c in sorted(silencios, reverse=True)[: len(palabras) - 1])
    bordes = [0.0] + cortes + [len(datos) / tasa * 1000]
    if len(bordes) != len(palabras) + 1:  # no hubo pausas suficientes
        return _alinear([p for ps in palabras for p in ps], None, datos, tasa)[0]
    tiempos = []
    for ps, ini, fin in zip(palabras, bordes, bordes[1:]):
        trozo = datos[int(ini * tasa / 1000) : int(fin * tasa / 1000)]
        tiempos += [(a + ini, b + ini) for a, b in _alinear(ps, None, trozo, tasa)[0]]
    return tiempos


def _voz_gemini(reel: dict, carpeta: Path, forzar: bool) -> None:
    import numpy as np

    cfg = reel.get("voz") or {}
    voz_gemini = cfg.get("gemini", VOZ_GEMINI)
    estilo = cfg.get("estilo", ESTILO_GEMINI)
    escenas = reel["escenas"]
    textos = [sin_marcas(e["narracion"]).strip() for e in escenas]
    firma = "gemini-" + huella("\n".join(textos), voz_gemini, estilo)
    if not forzar and all(e.get("_voz") == firma and e.get("audio") and (carpeta / e["audio"]).exists() for e in escenas):
        print("Voz: sin cambios (Gemini)")
        return
    completo = carpeta / "audio" / "narracion.wav"
    _gemini_tts("\n\n".join(textos), voz_gemini, estilo, completo)
    datos, tasa = _leer_wav(completo)
    palabras = [t.split() for t in textos]
    plano = [p for ps in palabras for p in ps]
    print("  Alineando palabras con Whisper…")
    reconocidas = _transcribir(completo, " ".join(textos))
    if reconocidas is None:
        print("  aviso: falta faster-whisper (pip install faster-whisper); tiempos estimados, subtítulos menos exactos")
    if reconocidas is None:
        tiempos, proporcion = _estimar_por_silencios(palabras, datos, tasa), 0.0
    else:
        tiempos, proporcion = _alinear(plano, reconocidas, datos, tasa)
    if reconocidas is not None and proporcion < 0.6:
        raise RuntimeError(f"la voz no coincide con el guion (solo {proporcion:.0%} de palabras alineadas)")

    # Cortes a mitad del silencio entre la última palabra de una escena y la primera de la siguiente.
    limites_escena, k = [], 0
    for ps in palabras:
        limites_escena.append((k, k + len(ps)))
        k += len(ps)
    cortes = [0.0]
    for (_, fin_a), (ini_b, _) in zip(limites_escena, limites_escena[1:]):
        cortes.append((tiempos[fin_a - 1][1] + tiempos[ini_b][0]) / 2)
    cortes.append(len(datos) / tasa * 1000)

    for i, (e, (a, b)) in enumerate(zip(escenas, limites_escena), 1):
        ini_ms, fin_ms = cortes[i - 1], cortes[i]
        archivo = carpeta / "audio" / f"escena_{i:02d}.wav"
        for viejo in archivo.parent.glob(archivo.stem + ".*"):
            viejo.unlink()
        trozo = datos[int(ini_ms * tasa / 1000) : int(fin_ms * tasa / 1000)]
        with wave.open(str(archivo), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(tasa)
            w.writeframes(np.asarray(trozo, dtype="<i2").tobytes())
        limites = [
            {"texto": re.sub(r"[¿?¡!.,;:…\"«»()]", "", p) or p, "inicioMs": t0 - ini_ms, "finMs": t1 - ini_ms}
            for p, (t0, t1) in zip(plano[a:b], tiempos[a:b])
        ]
        _aplicar(e, carpeta, archivo, limites, firma, ini_ms, fin_ms)
        print(f"Voz {i}: {e['duracionMs'] / 1000:.1f} s, {len(limites)} palabras (gemini)")
    guardar(carpeta, reel)
    if reconocidas is not None:
        print(f"  {proporcion:.0%} de las palabras alineadas con Whisper")


def voz(carpeta: Path, motor: str = "auto", forzar: bool = False) -> None:
    reel = leer(carpeta)
    cfg = reel.get("voz") or {}
    nombre = cfg.get("nombre", VOZ_POR_DEFECTO)
    velocidad = cfg.get("velocidad", VELOCIDAD_POR_DEFECTO)
    (carpeta / "audio").mkdir(exist_ok=True)

    if motor == "gemini" or (motor == "auto" and _clave_gemini()):
        try:
            _voz_gemini(reel, carpeta, forzar)
            _resumen_voz(reel)
            return
        except Exception as err:
            if motor == "gemini":
                raise
            print(f"  {err}\n  → uso edge-tts")
            reel = leer(carpeta)
            forzar = True  # la narración de Gemini pudo quedar a medias
    elif motor == "auto":
        print("  aviso: sin GEMINI_API_KEY uso edge-tts (voz más plana); ver .env.ejemplo")

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
        _aplicar(e, carpeta, archivo, limites, h if origen == "edge" else f"local-{h}")
        print(f"Voz {i}: {e['duracionMs'] / 1000:.1f} s, {len(limites)} palabras ({origen})")
        guardar(carpeta, reel)
    _resumen_voz(reel)


def _resumen_voz(reel: dict) -> None:
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


# -------------------------------------------------------------------- medios
# Videos reales de Pexels y Pixabay (gratis, con clave). Se prefieren clips
# verticales; los horizontales se recortan al centro.

def _pedir_json(url: str, cabeceras: dict | None = None) -> dict:
    peticion = urllib.request.Request(url, headers={"User-Agent": "agente-de-reels/1.0", **(cabeceras or {})})
    with urllib.request.urlopen(peticion, timeout=60) as r:
        return json.loads(r.read())


def _buscar_pexels(busqueda: str) -> list[dict]:
    clave = os.environ.get("PEXELS_API_KEY")
    if not clave:
        return []
    candidatos = []
    for orientacion in ("portrait", None):
        params = {"query": busqueda, "per_page": 15, "size": "medium"}
        if orientacion:
            params["orientation"] = orientacion
        datos = None
        for base in ("https://api.pexels.com/videos/search", "https://api.pexels.com/v1/videos/search"):
            try:
                datos = _pedir_json(f"{base}?{urllib.parse.urlencode(params)}", {"Authorization": clave})
                break
            except urllib.error.HTTPError as err:
                if err.code in (401, 403):
                    raise RuntimeError("PEXELS_API_KEY no es válida") from err
            except Exception as err:
                print(f"  Pexels: {err}")
        for v in (datos or {}).get("videos", []):
            archivos = [f for f in v.get("video_files", []) if f.get("file_type") == "video/mp4" and f.get("height")]
            if not archivos:
                continue
            # El más chico que siga siendo nítido en 1080x1920 (lado corto ≥ 1080).
            buenos = sorted((f for f in archivos if min(f["width"], f["height"]) >= 1080), key=lambda f: f["width"] * f["height"])
            elegido = buenos[0] if buenos else max(archivos, key=lambda f: f["width"] * f["height"])
            candidatos.append(
                {
                    "id": f"pexels:{v['id']}",
                    "url": elegido["link"],
                    "vertical": elegido["height"] > elegido["width"],
                    "duracionS": v.get("duration", 0),
                    "credito": f"{(v.get('user') or {}).get('name', 'Autor')} / Pexels",
                }
            )
        if len(candidatos) >= 5:
            break
    return candidatos


def _buscar_pixabay(busqueda: str) -> list[dict]:
    clave = os.environ.get("PIXABAY_API_KEY")
    if not clave:
        return []
    params = {"key": clave, "q": busqueda[:100], "per_page": 20, "safesearch": "true", "video_type": "film"}
    try:
        datos = _pedir_json(f"https://pixabay.com/api/videos/?{urllib.parse.urlencode(params)}")
    except urllib.error.HTTPError as err:
        if err.code in (400, 401, 403):
            raise RuntimeError("PIXABAY_API_KEY no es válida") from err
        print(f"  Pixabay: {err}")
        return []
    except Exception as err:
        print(f"  Pixabay: {err}")
        return []
    candidatos = []
    for h in datos.get("hits", []):
        variantes = [v for v in (h.get("videos") or {}).values() if v.get("url")]
        buenos = sorted((v for v in variantes if min(v["width"], v["height"]) >= 1080), key=lambda v: v["width"] * v["height"])
        elegido = buenos[0] if buenos else (max(variantes, key=lambda v: v["width"] * v["height"]) if variantes else None)
        if elegido:
            candidatos.append(
                {
                    "id": f"pixabay:{h['id']}",
                    "url": elegido["url"],
                    "vertical": elegido["height"] > elegido["width"],
                    "duracionS": h.get("duration", 0),
                    "credito": f"{h.get('user', 'Autor')} / Pixabay",
                }
            )
    return candidatos


def medios(carpeta: Path, forzar: bool = False, cuadriculas: bool = True) -> None:
    reel = leer(carpeta)
    (carpeta / "medios").mkdir(exist_ok=True)
    con_medio = [(i, e) for i, e in enumerate(reel["escenas"], 1) if e.get("medio")]
    if not con_medio:
        print("Sin medios en este reel.")
    if con_medio and not (os.environ.get("PEXELS_API_KEY") or os.environ.get("PIXABAY_API_KEY")):
        print("  aviso: sin PEXELS_API_KEY ni PIXABAY_API_KEY no se pueden buscar videos (ver .env.ejemplo)")
    usados = {e["medio"].get("id") for _, e in con_medio if e["medio"].get("archivo")}
    for i, e in con_medio:
        m = e["medio"]
        if not forzar and m.get("archivo") and (carpeta / m["archivo"]).exists():
            print(f"Medio {i}: ya está ({m.get('credito', m['archivo'])})")
            continue
        m["archivo"] = None
        if m.get("busqueda"):
            print(f"Medio {i}: buscando “{m['busqueda']}”…")
            excluir = set(m.get("excluir", [])) | usados
            candidatos = [c for c in _buscar_pexels(m["busqueda"]) + _buscar_pixabay(m["busqueda"]) if c["id"] not in excluir]
            # Verticales primero; luego los que duran lo suficiente.
            candidatos.sort(key=lambda c: (not c["vertical"], c["duracionS"] < 5))
            for c in candidatos[:3]:
                destino = carpeta / "medios" / f"escena_{i:02d}.mp4"
                try:
                    peticion = urllib.request.Request(c["url"], headers={"User-Agent": "agente-de-reels/1.0"})
                    with urllib.request.urlopen(peticion, timeout=180) as r, destino.open("wb") as f:
                        shutil.copyfileobj(r, f)
                except Exception as err:
                    print(f"  no se pudo descargar {c['id']}: {err}")
                    continue
                m.update(archivo=destino.relative_to(carpeta).as_posix(), tipo="video", id=c["id"], credito=c["credito"], duracionS=c["duracionS"])
                usados.add(c["id"])
                print(f"  {c['id']} ({'vertical' if c['vertical'] else 'horizontal'}, {c['duracionS']} s) — {c['credito']}")
                break
        if not m.get("archivo") and m.get("prompt"):
            destino = carpeta / "medios" / f"escena_{i:02d}.jpg"
            print(f"Medio {i}: imagen IA “{m['prompt'][:60]}”…")
            if _descargar_imagen(m["prompt"], destino, semilla=1000 + i):
                m.update(archivo=destino.relative_to(carpeta).as_posix(), tipo="imagen", id="pollinations", credito="Imagen IA (Pollinations)")
        if not m.get("archivo"):
            print(f"  sin medio para la escena {i}: se verá con el fondo animado (o el emoji en 'clip')")
        guardar(carpeta, reel)
    imagenes(carpeta, forzar)  # imágenes IA del formato anterior (campo `imagen`)
    if cuadriculas and any(e["medio"].get("archivo") for _, e in con_medio):
        _node(carpeta, "cuadriculas")
        print(f"Revisa {carpeta / 'cuadriculas'} para elegir coordenadas de cámara y marcas.")


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
    ap.add_argument(
        "comando",
        choices=["validar", "voz", "medios", "imagenes", "cuadriculas", "musica", "preparar", "previas", "render", "todo"],
    )
    ap.add_argument("carpeta", type=Path, help="carpeta del reel (contiene reel.json)")
    ap.add_argument("--forzar", action="store_true", help="regenera aunque ya exista")
    ap.add_argument(
        "--motor-voz",
        choices=["auto", "gemini", "edge", "local"],
        default="auto",
        help="auto: Gemini (si hay GEMINI_API_KEY), si no edge-tts, y espeak-ng como último recurso",
    )
    ap.add_argument("--sin-video", action="store_true", help="en 'todo', para en las previas")
    a = ap.parse_args()
    cargar_env()
    carpeta = a.carpeta.resolve()
    if not (carpeta / "reel.json").exists():
        sys.exit(f"No existe {carpeta / 'reel.json'}")

    if a.comando == "validar":
        validar(carpeta)
    elif a.comando == "voz":
        voz(carpeta, a.motor_voz, a.forzar)
    elif a.comando == "medios":
        medios(carpeta, a.forzar)
    elif a.comando == "imagenes":
        imagenes(carpeta, a.forzar)
    elif a.comando == "cuadriculas":
        _node(carpeta, "cuadriculas")
    elif a.comando == "musica":
        musica(carpeta, a.forzar)
    elif a.comando == "previas":
        previas(carpeta)
    elif a.comando == "render":
        render(carpeta)
    elif a.comando == "preparar":
        # Todo lo que no depende de mirar los medios: luego se escriben cámara y
        # marcas viendo las cuadrículas, y se sigue con `previas`.
        validar(carpeta)
        voz(carpeta, a.motor_voz, a.forzar)
        medios(carpeta, a.forzar)
        musica(carpeta, a.forzar)
    elif a.comando == "todo":
        validar(carpeta)
        voz(carpeta, a.motor_voz, a.forzar)
        medios(carpeta, a.forzar, cuadriculas=False)
        musica(carpeta, a.forzar)
        _node(carpeta, "previas" if a.sin_video else "ambos")
        if not a.sin_video:
            print(f"Listo: {carpeta / 'final.mp4'}")


if __name__ == "__main__":
    main()
