import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {useTema} from './base';

// Fondo continuo para todo el reel: degradado + dos manchas de luz que
// derivan lentamente + grano fino. Va debajo de las escenas para que las
// transiciones no "salten" de fondo.
export const Fondo: React.FC = () => {
	const frame = useCurrentFrame();
	const tema = useTema();
	const t = frame / 30;

	const mancha = (color: string, x: number, y: number, tamano: number) => (
		<div
			style={{
				position: 'absolute',
				left: x - tamano / 2,
				top: y - tamano / 2,
				width: tamano,
				height: tamano,
				borderRadius: '50%',
				background: `radial-gradient(circle, ${color} 0%, transparent 68%)`,
			}}
		/>
	);

	return (
		<AbsoluteFill
			style={{background: `linear-gradient(165deg, ${tema.fondo1} 0%, ${tema.fondo2} 100%)`}}
		>
			{mancha(tema.brillo1, 540 + Math.sin(t * 0.35) * 320, 520 + Math.cos(t * 0.27) * 220, 1300)}
			{mancha(tema.brillo2, 540 + Math.cos(t * 0.3) * 360, 1450 + Math.sin(t * 0.22) * 260, 1200)}
			<AbsoluteFill style={{opacity: 0.07, mixBlendMode: 'overlay'}}>
				<svg width="1080" height="1920">
					<filter id="grano">
						<feTurbulence
							type="fractalNoise"
							baseFrequency="0.9"
							numOctaves="2"
							seed={Math.floor(frame / 2) % 8}
						/>
					</filter>
					<rect width="100%" height="100%" filter="url(#grano)" />
				</svg>
			</AbsoluteFill>
		</AbsoluteFill>
	);
};

// Barra de progreso fina arriba: da sensación de avance y reduce abandonos.
export const BarraProgreso: React.FC = () => {
	const frame = useCurrentFrame();
	const {durationInFrames} = useVideoConfig();
	const tema = useTema();
	return (
		<div
			style={{
				position: 'absolute',
				top: 0,
				left: 0,
				height: 8,
				width: `${interpolate(frame, [0, durationInFrames - 1], [0, 100])}%`,
				background: tema.acento,
				boxShadow: `0 0 18px ${tema.acento}`,
			}}
		/>
	);
};
