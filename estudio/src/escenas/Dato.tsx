import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {TextoAnimado, useTema, useTiempo, Zona} from '../componentes/base';
import {fuenteNumeros} from '../temas';
import type {Escena} from '../tipos';

type Props = Extract<Escena, {tipo: 'dato'}>;

const formatear = (n: number, decimales: number) =>
	n.toLocaleString('es-ES', {
		minimumFractionDigits: decimales,
		maximumFractionDigits: decimales,
		useGrouping: Math.abs(n) >= 10000 ? true : false,
	});

// Número grande que cuenta desde 0. Si es un porcentaje, lleva un anillo.
export const Dato: React.FC<Props> = ({numero, decimales = 0, prefijo, sufijo, etiqueta}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const tema = useTema();
	const {entrada} = useTiempo();

	const conteo = interpolate(frame, [entrada, entrada + 1.3 * fps], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
		easing: Easing.out(Easing.cubic),
	});
	const valor = numero * conteo;
	const esPorcentaje = sufijo?.trim() === '%' && numero > 0 && numero <= 100;
	// Pequeño "golpe" de escala cuando el conteo llega a su valor final.
	const finConteo = entrada + 1.3 * fps;
	const texto = `${prefijo ?? ''}${formatear(valor, decimales)}`;
	const largo = texto.length + (sufijo?.length ?? 0);
	const tamano = esPorcentaje ? 250 : largo > 8 ? 210 : largo > 5 ? 280 : 360;

	const radio = 330;
	const circunferencia = 2 * Math.PI * radio;

	return (
		<AbsoluteFill>
			<Zona gap={30}>
				<div
					style={{
						position: 'relative',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						width: esPorcentaje ? 760 : undefined,
						height: esPorcentaje ? 760 : undefined,
						scale: interpolate(frame - finConteo, [0, 4, 14], [1, 1.08, 1], {
							extrapolateLeft: 'clamp',
							extrapolateRight: 'clamp',
						}),
					}}
				>
					{esPorcentaje ? (
						<svg width="760" height="760" style={{position: 'absolute', rotate: '-90deg'}}>
							<circle cx="380" cy="380" r={radio} fill="none" stroke={tema.tarjeta} strokeWidth="34" />
							<circle
								cx="380"
								cy="380"
								r={radio}
								fill="none"
								stroke={tema.acento}
								strokeWidth="34"
								strokeLinecap="round"
								strokeDasharray={circunferencia}
								strokeDashoffset={circunferencia * (1 - (numero / 100) * conteo)}
								style={{filter: `drop-shadow(0 0 22px ${tema.acento})`}}
							/>
						</svg>
					) : null}
					<div
						style={{
							fontFamily: fuenteNumeros,
							fontSize: tamano,
							lineHeight: 1,
							color: tema.acento,
							textShadow: `0 0 50px ${tema.acento}66`,
							display: 'flex',
							alignItems: 'baseline',
						}}
					>
						{texto}
						{sufijo ? <span style={{fontSize: tamano * 0.55, marginLeft: 8}}>{sufijo}</span> : null}
					</div>
				</div>
				<div style={{maxWidth: 900}}>
					<TextoAnimado texto={etiqueta} tamano={62} peso={800} retraso={entrada + 8} escalonado={2} />
				</div>
			</Zona>
		</AbsoluteFill>
	);
};
