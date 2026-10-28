import React from 'react';
import {Video} from '@remotion/media';
import {AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Marca, Medio, PuntoCamara} from '../tipos';
import {fuenteTexto} from '../temas';
import {useMomento, useTema} from './base';

const ANCHO = 1080;
const ALTO = 1920;
const suave = Easing.bezier(0.65, 0, 0.35, 1);

type Camara = {x: number; y: number; zoom: number};

// Posición de cámara en el frame actual. Sin puntos: acercamiento lento al centro.
// Con puntos: viaja de uno a otro y llega a cada uno cuando suena su palabra.
export const useCamara = (puntos?: PuntoCamara[]): Camara => {
	const frame = useCurrentFrame();
	const {durationInFrames} = useVideoConfig();
	const momento = useMomento();
	if (!puntos?.length) {
		return {x: 0.5, y: 0.5, zoom: interpolate(frame, [0, durationInFrames], [1.04, 1.16])};
	}
	const llegadas = puntos.map((p, i) => momento(p, i === 0 ? 0 : i / puntos.length));
	if (frame <= llegadas[0]) {
		// Antes del primer punto ya se mueve un poco para que nunca quede quieto.
		const p = puntos[0];
		return {...p, zoom: p.zoom * interpolate(frame, [0, Math.max(1, llegadas[0])], [0.96, 1])};
	}
	for (let i = 1; i < puntos.length; i++) {
		if (frame <= llegadas[i]) {
			// El movimiento dura como mucho 18 frames y termina al decir la palabra.
			const inicio = Math.max(llegadas[i - 1], llegadas[i] - 18);
			const k = interpolate(frame, [inicio, llegadas[i]], [0, 1], {
				extrapolateLeft: 'clamp',
				extrapolateRight: 'clamp',
				easing: suave,
			});
			const a = puntos[i - 1];
			const b = puntos[i];
			return {x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, zoom: a.zoom + (b.zoom - a.zoom) * k};
		}
	}
	// Tras el último punto, deriva muy despacio (empuje sutil).
	const u = puntos[puntos.length - 1];
	const extra = interpolate(frame, [llegadas[llegadas.length - 1], durationInFrames], [1, 1.05], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});
	return {...u, zoom: u.zoom * extra};
};

// Al acercarse, el punto de interés viaja hacia el centro de la zona útil
// (encima de los subtítulos), sin dejar nunca bordes negros.
const OBJETIVO = {x: 0.5, y: 0.4};
const enPantalla = (c: Camara) => {
	const k = Math.min(1, Math.max(0, (c.zoom - 1) / 0.6));
	const limitar = (v: number, f: number) => Math.min(c.zoom * f, Math.max(1 - c.zoom * (1 - f), v));
	return {
		x: limitar(c.x + (OBJETIVO.x - c.x) * k, c.x),
		y: limitar(c.y + (OBJETIVO.y - c.y) * k, c.y),
	};
};

// Lleva un punto del cuadro (0-1) a píxeles de pantalla con la cámara aplicada.
export const aPantalla = (c: Camara, x: number, y: number) => {
	const f = enPantalla(c);
	return {left: (f.x + c.zoom * (x - c.x)) * ANCHO, top: (f.y + c.zoom * (y - c.y)) * ALTO};
};

export const MedioVisual: React.FC<{medio: Medio; camara: Camara}> = ({medio, camara}) => {
	const archivo = medio.archivo!;
	const estilo: React.CSSProperties = {width: '100%', height: '100%', objectFit: 'cover'};
	return (
		<AbsoluteFill
			style={{
				transformOrigin: '0 0',
				transform: `translate(${(enPantalla(camara).x - camara.zoom * camara.x) * ANCHO}px, ${(enPantalla(camara).y - camara.zoom * camara.y) * ALTO}px) scale(${camara.zoom})`,
			}}
		>
			{medio.tipo === 'imagen' || /\.(jpe?g|png|webp)$/i.test(archivo) ? (
				<Img src={staticFile(archivo)} style={estilo} />
			) : (
				<Video
					src={staticFile(archivo)}
					muted
					loop
					objectFit="cover"
					playbackRate={medio.velocidad ?? 1}
					trimBefore={Math.round((medio.inicioS ?? 0) * 30)}
					style={estilo}
				/>
			)}
		</AbsoluteFill>
	);
};

// Medio a pantalla completa con cámara y un degradado para que el texto se lea.
export const FondoMedio: React.FC<{medio: Medio; camara?: PuntoCamara[]; oscurecer?: number}> = ({
	medio,
	camara,
	oscurecer = 0.55,
}) => {
	const c = useCamara(camara);
	return (
		<AbsoluteFill style={{overflow: 'hidden', backgroundColor: '#000'}}>
			<MedioVisual medio={medio} camara={c} />
			<AbsoluteFill
				style={{
					background: `linear-gradient(180deg, rgba(0,0,0,${oscurecer * 0.7}) 0%, rgba(0,0,0,${oscurecer * 0.45}) 35%, rgba(0,0,0,${oscurecer * 0.6}) 60%, rgba(0,0,0,${Math.min(0.92, oscurecer + 0.3)}) 100%)`,
				}}
			/>
		</AbsoluteFill>
	);
};

const Etiqueta: React.FC<{texto: string; aparicion: number; estilo?: React.CSSProperties}> = ({
	texto,
	aparicion,
	estilo,
}) => {
	const tema = useTema();
	return (
		<div
			style={{
				position: 'absolute',
				whiteSpace: 'nowrap',
				background: tema.acento,
				color: tema.sobreAcento,
				fontFamily: fuenteTexto,
				fontWeight: 900,
				fontSize: 50,
				padding: '12px 26px',
				borderRadius: 18,
				boxShadow: '0 14px 40px rgba(0,0,0,0.5)',
				scale: interpolate(aparicion, [0, 1], [0.4, 1]),
				opacity: interpolate(aparicion, [0, 0.4], [0, 1], {extrapolateRight: 'clamp'}),
				...estilo,
			}}
		>
			{texto}
		</div>
	);
};

// Círculos, flechas, puntos y etiquetas que señalan partes del medio. Aparecen
// cuando la voz dice su palabra y siguen al punto aunque la cámara se mueva.
export const Marcas: React.FC<{marcas: Marca[]; camara?: PuntoCamara[]}> = ({marcas, camara}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const tema = useTema();
	const c = useCamara(camara);
	const momento = useMomento();

	return (
		<AbsoluteFill>
			{marcas.map((m, i) => {
				const inicio = momento(m, 0.2 + (0.6 * i) / Math.max(1, marcas.length));
				if (frame < inicio) return null;
				const p = spring({frame: frame - inicio, fps, config: {damping: 13, stiffness: 150}});
				const trazo = interpolate(frame - inicio, [0, 14], [0, 1], {
					extrapolateRight: 'clamp',
					easing: Easing.out(Easing.cubic),
				});
				const {left, top} = aPantalla(c, m.x, m.y);
				const brillo = `drop-shadow(0 0 14px ${tema.acento}) drop-shadow(0 4px 10px rgba(0,0,0,0.6))`;
				// La etiqueta se pone hacia el centro para no salirse de la pantalla.
				const haciaIzquierda = left > ANCHO / 2;
				const haciaArriba = top > ALTO * 0.35;

				if (m.forma === 'circulo') {
					const r = (m.radio ?? 0.13) * ANCHO * c.zoom;
					const perimetro = 2 * Math.PI * r;
					return (
						<React.Fragment key={i}>
							<svg
								width={r * 2 + 40}
								height={r * 2 + 40}
								style={{position: 'absolute', left: left - r - 20, top: top - r - 20, filter: brillo, overflow: 'visible'}}
							>
								<circle
									cx={r + 20}
									cy={r + 20}
									r={r}
									fill="none"
									stroke={tema.acento}
									strokeWidth={10}
									strokeLinecap="round"
									strokeDasharray={perimetro}
									strokeDashoffset={perimetro * (1 - trazo)}
									transform={`rotate(-110 ${r + 20} ${r + 20})`}
								/>
							</svg>
							{m.texto ? (
								<Etiqueta
									texto={m.texto}
									aparicion={p}
									estilo={{
										left: Math.min(820, Math.max(260, left)),
										top: haciaArriba ? top - r - 100 : top + r + 24,
										translate: '-50% 0',
									}}
								/>
							) : null}
						</React.Fragment>
					);
				}

				if (m.forma === 'flecha') {
					// Flecha curva desde la etiqueta (hacia el centro) hasta el punto.
					const dx = haciaIzquierda ? -260 : 260;
					const dy = haciaArriba ? -240 : 240;
					const x0 = left + dx;
					const y0 = top + dy;
					const cx = left + dx * 0.15;
					const cy = top + dy * 0.85;
					const largo = Math.hypot(dx, dy) * 1.15;
					const fin = 26 / Math.hypot(left - cx, top - cy);
					const ux = (left - cx) * fin;
					const uy = (top - cy) * fin;
					return (
						<React.Fragment key={i}>
							<svg width={ANCHO} height={ALTO} style={{position: 'absolute', left: 0, top: 0, filter: brillo}}>
								<path
									d={`M ${x0} ${y0} Q ${cx} ${cy} ${left - ux * 0.6} ${top - uy * 0.6}`}
									fill="none"
									stroke={tema.acento}
									strokeWidth={10}
									strokeLinecap="round"
									strokeDasharray={largo}
									strokeDashoffset={largo * (1 - trazo)}
								/>
								{trazo > 0.95 ? (
									<path
										d={`M ${left - ux - uy * 0.8} ${top - uy + ux * 0.8} L ${left} ${top} L ${left - ux + uy * 0.8} ${top - uy - ux * 0.8}`}
										fill="none"
										stroke={tema.acento}
										strokeWidth={10}
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								) : null}
							</svg>
							{m.texto ? (
								<Etiqueta
									texto={m.texto}
									aparicion={p}
									estilo={{
										left: Math.min(820, Math.max(260, x0)),
										top: y0,
										translate: `-50% ${haciaArriba ? '-110%' : '10%'}`,
									}}
								/>
							) : null}
						</React.Fragment>
					);
				}

				if (m.forma === 'punto') {
					const pulso = ((frame - inicio) % 30) / 30;
					return (
						<React.Fragment key={i}>
							<div
								style={{
									position: 'absolute',
									left: left - 60,
									top: top - 60,
									width: 120,
									height: 120,
									borderRadius: '50%',
									border: `6px solid ${tema.acento}`,
									scale: 0.3 + pulso,
									opacity: 1 - pulso,
								}}
							/>
							<div
								style={{
									position: 'absolute',
									left: left - 18,
									top: top - 18,
									width: 36,
									height: 36,
									borderRadius: '50%',
									background: tema.acento,
									border: '5px solid #fff',
									scale: p,
									filter: brillo,
								}}
							/>
							{m.texto ? (
								<Etiqueta
									texto={m.texto}
									aparicion={p}
									estilo={{
										left: haciaIzquierda ? undefined : left + 40,
										right: haciaIzquierda ? ANCHO - left + 40 : undefined,
										top: top - 40,
									}}
								/>
							) : null}
						</React.Fragment>
					);
				}

				// 'etiqueta': solo el rótulo, centrado en el punto.
				return m.texto ? (
					<Etiqueta key={i} texto={m.texto} aparicion={p} estilo={{left: Math.min(820, Math.max(260, left)), top, translate: '-50% -50%'}} />
				) : null;
			})}
		</AbsoluteFill>
	);
};
