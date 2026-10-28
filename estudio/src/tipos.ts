import T from './tiempos.json';
import type {NombreTema} from './temas';

// Lo que escribe el guionista (Claude) en reel.json + lo que añaden las herramientas.

export type Palabra = {texto: string; inicioMs: number; finMs: number};
export type ImagenRef = {prompt?: string; archivo?: string | null};

// Video o foto real (Pexels/Pixabay) o imagen IA. `busqueda`/`prompt` los
// escribe el guionista; el resto lo rellena `reel.py medios`.
export type Medio = {
	busqueda?: string;
	prompt?: string;
	archivo?: string | null;
	tipo?: 'video' | 'imagen';
	inicioS?: number;
	velocidad?: number;
	excluir?: string[];
	id?: string;
	credito?: string;
	duracionS?: number;
};

// Punto de cámara: x, y en 0-1 sobre el cuadro 9:16 ya recortado; zoom 1 = sin zoom.
// Llega a ese punto cuando la voz dice la palabra `en` o en la fracción `t` (0-1).
export type PuntoCamara = {x: number; y: number; zoom: number; en?: string; t?: number};

// Anotación sobre el medio, en coordenadas 0-1 del cuadro (se mueve con la cámara).
export type Marca = {
	forma: 'circulo' | 'flecha' | 'punto' | 'etiqueta';
	x: number;
	y: number;
	texto?: string;
	radio?: number; // fracción del ancho, para 'circulo'
	en?: string;
	t?: number;
};

type Base = {
	narracion: string;
	subtitulos?: boolean;
	// Fondo real detrás de cualquier plantilla (en 'clip' es el protagonista).
	medio?: Medio;
	camara?: PuntoCamara[];
	// Rellenado por `reel.py voz`
	audio?: string;
	recorteMs?: number;
	duracionMs?: number;
	palabras?: Palabra[];
};

export type Item = {emoji?: string; texto: string};
export type Lado = {titulo: string; texto?: string; emoji?: string};
export type Barra = {etiqueta: string; valor: number};

export type Escena = Base &
	(
		| {tipo: 'gancho'; titulo: string; emoji?: string; imagen?: ImagenRef}
		| {tipo: 'clip'; titulo?: string; emoji?: string; marcas?: Marca[]; posicionTitulo?: 'arriba' | 'abajo'}
		| {
				tipo: 'dato';
				numero: number;
				decimales?: number;
				prefijo?: string;
				sufijo?: string;
				etiqueta: string;
		  }
		| {tipo: 'lista'; titulo: string; items: Item[]}
		| {tipo: 'imagen'; titulo?: string; emoji?: string; imagen?: ImagenRef}
		| {
				tipo: 'comparacion';
				izquierda: Lado;
				derecha: Lado;
				ganador?: 'izquierda' | 'derecha';
		  }
		| {tipo: 'frase'; texto: string; autor?: string}
		| {
				tipo: 'grafico';
				titulo: string;
				barras: Barra[];
				unidad?: string;
				destacar?: number;
		  }
		| {
				tipo: 'cta';
				texto: string;
				subtexto?: string;
				accion?: 'guardar' | 'seguir' | 'comentar' | 'compartir';
		  }
	);

export type Reel = {
	titulo: string;
	tema?: NombreTema;
	efectos?: boolean;
	musica?: {animo?: string; archivo?: string | null; volumen?: number};
	escenas: Escena[];
	// Calculado en calculateMetadata (lo usa render.mjs para las previas)
	_marcas?: Tramo[];
};

export type Tramo = {inicio: number; duracion: number; audioFrames: number};

// Frames de la parte hablada de una escena.
export const framesAudio = (e: Escena) =>
	Math.ceil(((e.duracionMs ?? T.duracionPorDefectoMs) / 1000) * T.fps);

// Duración de cada TransitionSeries.Sequence. Las que no son la última
// incluyen la transición, que se solapa con la siguiente escena.
export const calcularMarcas = (escenas: Escena[]): Tramo[] => {
	let inicio = 0;
	return escenas.map((e, i) => {
		const audioFrames = framesAudio(e);
		const ultima = i === escenas.length - 1;
		const duracion =
			T.entrada + audioFrames + T.cola + (ultima ? T.finalExtra : T.transicion);
		const marca = {inicio, duracion, audioFrames};
		inicio += duracion - T.transicion;
		return marca;
	});
};

export const duracionTotal = (marcas: Tramo[]) => {
	const ultima = marcas[marcas.length - 1];
	return ultima ? ultima.inicio + ultima.duracion : T.fps;
};
