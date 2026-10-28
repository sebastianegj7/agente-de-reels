import {loadFont as cargarMontserrat} from '@remotion/google-fonts/Montserrat';
import {loadFont as cargarBebas} from '@remotion/google-fonts/BebasNeue';

export const {fontFamily: fuenteTexto} = cargarMontserrat('normal', {
	weights: ['600', '800', '900'],
	subsets: ['latin', 'latin-ext'],
});
export const {fontFamily: fuenteNumeros} = cargarBebas('normal', {
	weights: ['400'],
	subsets: ['latin'],
});

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
