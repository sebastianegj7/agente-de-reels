import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {TextoAnimado, useTema, Zona} from '../componentes/base';
import {fuenteTexto} from '../temas';
import type {Escena} from '../tipos';

type Props = Extract<Escena, {tipo: 'cta'}>;

// Iconos dibujados en SVG (trazos simples estilo Instagram).
const ICONOS: Record<NonNullable<Props['accion']>, React.ReactNode> = {
	guardar: <path d="M6 3h12v18l-6-4.5L6 21z" />,
	seguir: (
		<>
			<circle cx="10" cy="8" r="4" />
			<path d="M3 21c0-4 3-6.5 7-6.5s7 2.5 7 6.5M19 7v6M16 10h6" />
		</>
	),
	comentar: <path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-5A8.5 8.5 0 1 1 21 11.5z" />,
	compartir: <path d="M22 3 11 13M22 3l-7 18-4-8-8-4z" />,
};

export const Cta: React.FC<Props> = ({texto, subtexto, accion = 'guardar'}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const tema = useTema();
	const p = spring({frame, fps, config: {damping: 9, stiffness: 140}});
	const toque = spring({frame: frame - 26, fps, config: {damping: 10, stiffness: 260}});

	return (
		<AbsoluteFill>
			<Zona gap={56}>
				<div style={{position: 'relative', width: 300, height: 300}}>
					{[0, 1].map((k) => {
						const ciclo = ((frame + k * 22) % 44) / 44;
						return (
							<div
								key={k}
								style={{
									position: 'absolute',
									inset: 0,
									borderRadius: '50%',
									border: `6px solid ${tema.acento}`,
									scale: 1 + ciclo * 0.6,
									opacity: (1 - ciclo) * 0.6 * p,
								}}
							/>
						);
					})}
					<div
						style={{
							position: 'absolute',
							inset: 0,
							borderRadius: '50%',
							background: tema.acento,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							scale: interpolate(p, [0, 1], [0, 1]) * interpolate(toque, [0, 0.5, 1], [1, 0.88, 1]),
							boxShadow: `0 20px 60px ${tema.acento}77`,
						}}
					>
						<svg
							width="150"
							height="150"
							viewBox="0 0 24 24"
							fill={toque > 0.5 && accion !== 'compartir' ? tema.sobreAcento : 'none'}
							stroke={tema.sobreAcento}
							strokeWidth="2"
							strokeLinejoin="round"
							strokeLinecap="round"
						>
							{ICONOS[accion]}
						</svg>
					</div>
				</div>
				<TextoAnimado texto={texto} tamano={88} retraso={6} escalonado={3} />
				{subtexto ? (
					<div
						style={{
							fontFamily: fuenteTexto,
							fontWeight: 600,
							fontSize: 44,
							color: tema.textoSuave,
							textAlign: 'center',
							opacity: interpolate(frame, [20, 30], [0, 1], {
								extrapolateLeft: 'clamp',
								extrapolateRight: 'clamp',
							}),
						}}
					>
						{subtexto}
					</div>
				) : null}
			</Zona>
		</AbsoluteFill>
	);
};
