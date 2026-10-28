import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Entrar, useTema, useTiempo, Zona} from '../componentes/base';
import {fuenteNumeros, fuenteTexto} from '../temas';
import type {Escena, Lado} from '../tipos';

type Props = Extract<Escena, {tipo: 'comparacion'}>;

const Tarjeta: React.FC<{lado: Lado; estado: 'normal' | 'gana' | 'pierde'}> = ({lado, estado}) => {
	const tema = useTema();
	return (
		<div
			style={{
				width: 400,
				minHeight: 540,
				padding: '44px 46px',
				borderRadius: 36,
				background: estado === 'gana' ? tema.acento : tema.tarjeta,
				border: `3px solid ${estado === 'gana' ? tema.acento : tema.borde}`,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				gap: 24,
				textAlign: 'center',
				fontFamily: fuenteTexto,
				color: estado === 'gana' ? tema.sobreAcento : tema.texto,
				opacity: estado === 'pierde' ? 0.45 : 1,
				scale: estado === 'gana' ? 1.04 : estado === 'pierde' ? 0.95 : 1,
				boxShadow: estado === 'gana' ? `0 24px 70px ${tema.acento}66` : 'none',
			}}
		>
			{lado.emoji ? <div style={{fontSize: 130, lineHeight: 1}}>{lado.emoji}</div> : null}
			<div
				style={{
					fontWeight: 900,
					// Ancho útil ≈ 300 px; Montserrat Black ocupa ~0.7 em por letra.
					fontSize: Math.min(56, Math.floor(300 / (0.7 * Math.max(...lado.titulo.split(' ').map((p) => p.length))))),
					lineHeight: 1.05,
					overflowWrap: 'anywhere',
				}}
			>
				{lado.titulo}
			</div>
			{lado.texto ? (
				<div style={{fontWeight: 600, fontSize: 34, lineHeight: 1.25, opacity: 0.85}}>{lado.texto}</div>
			) : null}
		</div>
	);
};

// A vs B. Si hay ganador, se resalta a mitad de la narración.
export const Comparacion: React.FC<Props> = ({izquierda, derecha, ganador}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const tema = useTema();
	const {entrada, audioFrames} = useTiempo();
	const vs = spring({frame: frame - entrada - 10, fps, config: {damping: 8, stiffness: 160}});
	const momentoGanador = entrada + Math.round(audioFrames * 0.55);
	const hayGanador = ganador && frame >= momentoGanador;
	const estado = (l: 'izquierda' | 'derecha') =>
		!hayGanador ? 'normal' : ganador === l ? 'gana' : 'pierde';

	return (
		<AbsoluteFill>
			<Zona>
				<div style={{display: 'flex', gap: 60, alignItems: 'stretch', position: 'relative'}}>
					<Entrar desde="izquierda" distancia={500} retraso={entrada}>
						<Tarjeta lado={izquierda} estado={estado('izquierda')} />
					</Entrar>
					<Entrar desde="derecha" distancia={500} retraso={entrada + 4}>
						<Tarjeta lado={derecha} estado={estado('derecha')} />
					</Entrar>
					<div
						style={{
							position: 'absolute',
							left: '50%',
							top: '50%',
							width: 124,
							height: 124,
							marginLeft: -62,
							marginTop: -62,
							borderRadius: '50%',
							background: tema.texto,
							color: tema.fondo1,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							fontFamily: fuenteNumeros,
							fontSize: 70,
							scale: interpolate(vs, [0, 1], [0, 1]),
							rotate: `${interpolate(vs, [0, 1], [-90, 0])}deg`,
							boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
						}}
					>
						VS
					</div>
				</div>
			</Zona>
		</AbsoluteFill>
	);
};
