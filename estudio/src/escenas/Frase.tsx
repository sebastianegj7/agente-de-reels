import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {TextoAnimado, useTema, useTiempo, Zona} from '../componentes/base';
import {fuenteTexto} from '../temas';
import type {Escena} from '../tipos';

type Props = Extract<Escena, {tipo: 'frase'}>;

// Afirmación potente o giro de la historia. Las *palabras clave* llevan
// un marcador de color que se dibuja detrás.
export const Frase: React.FC<Props> = ({texto, autor}) => {
	const frame = useCurrentFrame();
	const tema = useTema();
	const {entrada} = useTiempo();
	const palabras = texto.split(/\s+/).length;
	return (
		<AbsoluteFill>
			<Zona gap={44}>
				<div
					style={{
						fontFamily: 'Georgia, serif',
						fontSize: 220,
						lineHeight: 0.6,
						height: 90,
						color: tema.acento,
						opacity: interpolate(frame, [0, 10], [0, 0.9], {extrapolateRight: 'clamp'}),
					}}
				>
					“
				</div>
				<TextoAnimado
					texto={texto}
					tamano={palabras > 14 ? 70 : 86}
					retraso={entrada}
					escalonado={3}
					marcador
					interlineado={1.18}
				/>
				{autor ? (
					<div
						style={{
							fontFamily: fuenteTexto,
							fontWeight: 600,
							fontSize: 42,
							color: tema.textoSuave,
							opacity: interpolate(frame, [entrada + 20, entrada + 30], [0, 1], {
								extrapolateLeft: 'clamp',
								extrapolateRight: 'clamp',
							}),
						}}
					>
						— {autor}
					</div>
				) : null}
			</Zona>
		</AbsoluteFill>
	);
};
