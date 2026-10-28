import {continueRender, delayRender} from 'remotion';
import montserratLatin from './fuentes/montserrat-latin.woff2';
import montserratLatinExt from './fuentes/montserrat-latin-ext.woff2';
import bebasLatin from './fuentes/bebas-latin.woff2';
import bebasLatinExt from './fuentes/bebas-latin-ext.woff2';

// Fuentes incluidas en el proyecto (Google Fonts, licencia OFL) para que el
// render no dependa de la red. Montserrat es variable: un archivo, todos los pesos.
const LATIN =
	'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const LATIN_EXT =
	'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF';

const cargar = (familia: string, peso: string, archivos: [string, string][]) => {
	if (typeof document === 'undefined') return;
	const handle = delayRender(`Cargando ${familia}`);
	Promise.all(
		archivos.map(([url, rango]) => {
			const f = new FontFace(familia, `url(${url}) format('woff2')`, {weight: peso, unicodeRange: rango});
			(document.fonts as unknown as Set<FontFace>).add(f);
			return f.load();
		}),
	).then(() => continueRender(handle), () => continueRender(handle));
};

export const fuenteTexto = 'Montserrat';
export const fuenteNumeros = 'Bebas Neue';
cargar(fuenteTexto, '100 900', [
	[montserratLatin, LATIN],
	[montserratLatinExt, LATIN_EXT],
]);
cargar(fuenteNumeros, '400', [
	[bebasLatin, LATIN],
	[bebasLatinExt, LATIN_EXT],
]);

export type Tema = {
	fondo1: string;
	fondo2: string;
	brillo1: string;
	brillo2: string;
	texto: string;
	textoSuave: string;
	acento: string;
	sobreAcento: string;
	tarjeta: string;
	borde: string;
};

export const temas = {
	// Oscuro con amarillo: el más legible y versátil. Por defecto.
	noche: {
		fondo1: '#0A0C16',
		fondo2: '#171B36',
		brillo1: 'rgba(124, 92, 255, 0.55)',
		brillo2: 'rgba(255, 210, 63, 0.22)',
		texto: '#FFFFFF',
		textoSuave: 'rgba(255,255,255,0.72)',
		acento: '#FFD23F',
		sobreAcento: '#141414',
		tarjeta: 'rgba(255,255,255,0.07)',
		borde: 'rgba(255,255,255,0.14)',
	},
	// Claro tipo revista: negocios, historia, cultura.
	editorial: {
		fondo1: '#F5F0E6',
		fondo2: '#E9E1D0',
		brillo1: 'rgba(255, 77, 46, 0.18)',
		brillo2: 'rgba(40, 40, 40, 0.08)',
		texto: '#141414',
		textoSuave: 'rgba(20,20,20,0.7)',
		acento: '#FF4D2E',
		sobreAcento: '#FFFFFF',
		tarjeta: 'rgba(255,255,255,0.65)',
		borde: 'rgba(20,20,20,0.12)',
	},
	// Morado y rosa intenso: tecnología, IA, tendencias.
	energia: {
		fondo1: '#10001D',
		fondo2: '#2B0A6B',
		brillo1: 'rgba(247, 37, 133, 0.5)',
		brillo2: 'rgba(76, 201, 240, 0.35)',
		texto: '#FFFFFF',
		textoSuave: 'rgba(255,255,255,0.75)',
		acento: '#4CC9F0',
		sobreAcento: '#0B0B1A',
		tarjeta: 'rgba(255,255,255,0.08)',
		borde: 'rgba(255,255,255,0.16)',
	},
	// Azul profundo y verde agua: ciencia, salud, naturaleza.
	oceano: {
		fondo1: '#021521',
		fondo2: '#06395A',
		brillo1: 'rgba(46, 242, 195, 0.32)',
		brillo2: 'rgba(80, 140, 255, 0.35)',
		texto: '#FFFFFF',
		textoSuave: 'rgba(255,255,255,0.74)',
		acento: '#2EF2C3',
		sobreAcento: '#022027',
		tarjeta: 'rgba(255,255,255,0.07)',
		borde: 'rgba(255,255,255,0.15)',
	},
} satisfies Record<string, Tema>;

export type NombreTema = keyof typeof temas;

export const obtenerTema = (nombre?: string): Tema =>
	temas[(nombre ?? 'noche') as NombreTema] ?? temas.noche;

// Zonas seguras de Reels (1080x1920): la UI de Instagram tapa arriba ~250px,
// abajo ~600px (descripción, audio) y a la derecha ~130px (botones).
export const ZONA = {
	arriba: 250,
	abajo: 1300,
	izquierda: 80,
	derecha: 1080 - 140,
	subtitulosY: 1170,
};
