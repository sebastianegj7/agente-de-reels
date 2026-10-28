import T from './tiempos.json';
import type {NombreTema} from './temas';

// Lo que escribe el guionista (Claude) en reel.json + lo que añaden las herramientas.

export type Palabra = {texto: string; inicioMs: number; finMs: number};
export type ImagenRef = {prompt?: string; archivo?: string | null};

type Base = {
	narracion: string;
	subtitulos?: boolean;
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
	_marcas?: Marca[];
};

export type Marca = {inicio: number; duracion: number; audioFrames: number};

// Frames de la parte hablada de una escena.
export const framesAudio = (e: Escena) =>
	Math.ceil(((e.duracionMs ?? T.duracionPorDefectoMs) / 1000) * T.fps);

// Duración de cada TransitionSeries.Sequence. Las que no son la última
// incluyen la transición, que se solapa con la siguiente escena.
export const calcularMarcas = (escenas: Escena[]): Marca[] => {
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

export const duracionTotal = (marcas: Marca[]) => {
	const ultima = marcas[marcas.length - 1];
	return ultima ? ultima.inicio + ultima.duracion : T.fps;
};
