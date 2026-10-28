import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {TextoAnimado, useTema, useTiempo, Zona} from '../componentes/base';
import {fuenteNumeros, fuenteTexto} from '../temas';
import type {Escena} from '../tipos';

type Props = Extract<Escena, {tipo: 'grafico'}>;

const ALTO_MAX = 560;

// Barras verticales (2-5) que crecen una tras otra con su valor encima.
export const Grafico: React.FC<Props> = ({titulo, barras, unidad = '', destacar}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const tema = useTema();
	const {entrada} = useTiempo();
	const max = Math.max(...barras.map((b) => b.valor), 1);
	const indiceDestacado = destacar ?? barras.findIndex((b) => b.valor === max);
	const ancho = Math.min(170, Math.floor(840 / barras.length) - 30);

	return (
		<AbsoluteFill>
			<Zona centrar={false} arriba={270} gap={50}>
				<TextoAnimado texto={titulo} tamano={70} escalonado={2} />
				<div style={{display: 'flex', alignItems: 'flex-end', gap: 30, height: ALTO_MAX + 160}}>
					{barras.map((b, i) => {
						const p = spring({
							frame: frame - entrada - 6 - i * 6,
							fps,
							config: {damping: 18, stiffness: 90},
						});
						const destacada = i === indiceDestacado;
						const valor = b.valor * Math.min(1, p);
						return (
							<div
								key={i}
								style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: ancho}}
							>
								<div
									style={{
										fontFamily: fuenteNumeros,
										fontSize: 74,
										color: destacada ? tema.acento : tema.texto,
										opacity: interpolate(p, [0, 0.3], [0, 1], {extrapolateRight: 'clamp'}),
									}}
								>
									{Number.isInteger(b.valor) ? Math.round(valor) : valor.toFixed(1)}
									{unidad}
								</div>
								<div
									style={{
										width: '100%',
										height: Math.max(6, (b.valor / max) * ALTO_MAX * p),
										borderRadius: '22px 22px 8px 8px',
										background: destacada
											? `linear-gradient(180deg, ${tema.acento}, ${tema.acento}AA)`
											: tema.tarjeta,
										border: `2px solid ${destacada ? tema.acento : tema.borde}`,
										boxShadow: destacada ? `0 0 50px ${tema.acento}55` : 'none',
									}}
								/>
								<div
									style={{
										fontFamily: fuenteTexto,
										fontWeight: 800,
										fontSize: b.etiqueta.length > 9 ? 30 : 36,
										color: tema.textoSuave,
										textAlign: 'center',
										lineHeight: 1.1,
										minHeight: 80,
									}}
								>
									{b.etiqueta}
								</div>
							</div>
						);
					})}
				</div>
			</Zona>
		</AbsoluteFill>
	);
};
