import React, {createContext, useContext} from 'react';
import {
	AbsoluteFill,
	Easing,
	interpolate,
	spring,
	useCurrentFrame,
	useVideoConfig,
} from 'remotion';
import {fuenteTexto, temas, type Tema} from '../temas';
import type {Palabra} from '../tipos';

export const TemaContexto = createContext<Tema>(temas.noche);
export const useTema = () => useContext(TemaContexto);

// Datos de tiempo de la escena actual (frames relativos a su Sequence).
export type TiempoEscena = {entrada: number; audioFrames: number; palabras?: Palabra[]};
export const TiempoContexto = createContext<TiempoEscena>({entrada: 0, audioFrames: 90});
export const useTiempo = () => useContext(TiempoContexto);

export const salida = Easing.bezier(0.16, 1, 0.3, 1);

// Separa "texto con *palabras resaltadas*" en tokens.
export const tokenizar = (texto: string) => {
	const tokens: {palabra: string; resaltada: boolean; cola?: string}[] = [];
	let resaltada = false;
	let previo = '';
	for (const parte of texto.split(/(\*)/)) {
		if (parte === '*') {
			resaltada = !resaltada;
			continue;
		}
		const palabras = parte.split(/\s+/);
		// "*es*, lo ves": la coma va pegada a la palabra anterior, sin resaltar.
		const anterior = tokens[tokens.length - 1];
		if (palabras[0] && anterior && previo && !/\s$/.test(previo)) {
			anterior.cola = (anterior.cola ?? '') + palabras.shift();
		}
		previo = parte;
		for (const palabra of palabras.filter(Boolean)) {
			tokens.push({palabra, resaltada});
		}
	}
	return tokens;
};

export const quitarMarcas = (texto: string) => texto.replace(/\*/g, '');

// Texto que entra palabra por palabra con un pequeño rebote.
// Las palabras entre *asteriscos* van en color de acento (o con marcador).
export const TextoAnimado: React.FC<{
	texto: string;
	tamano: number;
	peso?: number;
	retraso?: number;
	escalonado?: number;
	alinear?: 'center' | 'left';
	color?: string;
	marcador?: boolean;
	interlineado?: number;
	mayusculas?: boolean;
}> = ({
	texto,
	tamano,
	peso = 900,
	retraso = 0,
	escalonado = 3,
	alinear = 'center',
	color,
	marcador = false,
	interlineado = 1.08,
	mayusculas = false,
}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const tema = useTema();
	const tokens = tokenizar(texto);

	return (
		<div
			style={{
				fontFamily: fuenteTexto,
				fontWeight: peso,
				fontSize: tamano,
				lineHeight: interlineado,
				textAlign: alinear,
				color: color ?? tema.texto,
				display: 'flex',
				flexWrap: 'wrap',
				justifyContent: alinear === 'center' ? 'center' : 'flex-start',
				columnGap: tamano * 0.26,
				rowGap: tamano * 0.08,
				textTransform: mayusculas ? 'uppercase' : 'none',
				letterSpacing: peso >= 800 ? '-0.02em' : 0,
			}}
		>
			{tokens.map((t, i) => {
				const inicio = retraso + i * escalonado;
				const p = spring({frame: frame - inicio, fps, config: {damping: 14, stiffness: 160}});
				const barrido = interpolate(frame, [inicio + 6, inicio + 16], [0, 100], {
					extrapolateLeft: 'clamp',
					extrapolateRight: 'clamp',
					easing: salida,
				});
				return (
					<span
						key={i}
						style={{
							display: 'inline-block',
							opacity: interpolate(frame - inicio, [0, 5], [0, 1], {
								extrapolateLeft: 'clamp',
								extrapolateRight: 'clamp',
							}),
							translate: `0px ${interpolate(p, [0, 1], [tamano * 0.5, 0])}px`,
							scale: interpolate(p, [0, 1], [0.7, 1]),
							color: t.resaltada && !marcador ? tema.acento : undefined,
						}}
					>
						<span
							style={{
								position: 'relative',
								display: 'inline-block',
								padding: t.resaltada && marcador ? '0 0.14em' : undefined,
							}}
						>
							{t.resaltada && marcador ? (
								<span
									style={{
										position: 'absolute',
										left: 0,
										top: '12%',
										height: '84%',
										width: `${barrido}%`,
										background: tema.acento,
										borderRadius: tamano * 0.12,
										zIndex: 0,
									}}
								/>
							) : null}
							<span
								style={{
									position: 'relative',
									zIndex: 1,
									color: t.resaltada && marcador && barrido > 40 ? tema.sobreAcento : undefined,
								}}
							>
								{t.palabra}
							</span>
						</span>
						{t.cola ? <span style={{color: color ?? tema.texto}}>{t.cola}</span> : null}
					</span>
				);
			})}
		</div>
	);
};

// Contenedor de la zona útil (respeta las zonas seguras de Instagram).
export const Zona: React.FC<{
	children: React.ReactNode;
	arriba?: number;
	abajo?: number;
	centrar?: boolean;
	gap?: number;
}> = ({children, arriba = 250, abajo = 1080, centrar = true, gap = 40}) => (
	<AbsoluteFill>
		<div
			style={{
				position: 'absolute',
				top: arriba,
				// Los botones de Instagram empiezan bajo y≈1150, así que arriba
				// de eso se puede usar un margen simétrico.
				left: 80,
				width: 920,
				height: abajo - arriba,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: centrar ? 'center' : 'flex-start',
				gap,
			}}
		>
			{children}
		</div>
	</AbsoluteFill>
);

// Emoji grande con entrada elástica y flotación suave.
export const EmojiGrande: React.FC<{emoji: string; tamano?: number; retraso?: number}> = ({
	emoji,
	tamano = 200,
	retraso = 0,
}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const p = spring({frame: frame - retraso, fps, config: {damping: 9, stiffness: 120}});
	return (
		<div
			style={{
				fontSize: tamano,
				lineHeight: 1,
				scale: interpolate(p, [0, 1], [0, 1]),
				rotate: `${interpolate(p, [0, 1], [-25, 0]) + Math.sin(frame / 14) * 4}deg`,
				translate: `0px ${Math.sin(frame / 18) * 10}px`,
				filter: 'drop-shadow(0 18px 30px rgba(0,0,0,0.35))',
			}}
		>
			{emoji}
		</div>
	);
};

// Aparición desde abajo para bloques completos.
export const Entrar: React.FC<{
	children: React.ReactNode;
	retraso?: number;
	desde?: 'abajo' | 'izquierda' | 'derecha' | 'arriba';
	distancia?: number;
	style?: React.CSSProperties;
}> = ({children, retraso = 0, desde = 'abajo', distancia = 120, style}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const p = spring({frame: frame - retraso, fps, config: {damping: 16, stiffness: 140}});
	const d = interpolate(p, [0, 1], [distancia, 0]);
	const desplazamiento = {
		abajo: `0px ${d}px`,
		arriba: `0px ${-d}px`,
		izquierda: `${-d}px 0px`,
		derecha: `${d}px 0px`,
	}[desde];
	return (
		<div
			style={{
				opacity: interpolate(frame - retraso, [0, 6], [0, 1], {
					extrapolateLeft: 'clamp',
					extrapolateRight: 'clamp',
				}),
				translate: desplazamiento,
				...style,
			}}
		>
			{children}
		</div>
	);
};

// Compara palabras sin tildes, mayúsculas ni puntuación.
export const normalizar = (p: string) =>
	p
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9ñ]/g, '');

// Frame (relativo a la escena) en que empieza a sonar `palabra`, o en la
// fracción `t` de la narración. Sirve para sincronizar zooms y marcas con la voz.
export const useMomento = () => {
	const {fps} = useVideoConfig();
	const {entrada, audioFrames, palabras} = useTiempo();
	return (momento: {en?: string; t?: number}, porDefecto = 0) => {
		if (momento.en && palabras?.length) {
			const buscada = normalizar(momento.en);
			const p = palabras.find((w) => normalizar(w.texto).startsWith(buscada));
			if (p) return entrada + Math.round((p.inicioMs / 1000) * fps);
		}
		const t = momento.t ?? porDefecto;
		return entrada + Math.round(t * audioFrames);
	};
};
