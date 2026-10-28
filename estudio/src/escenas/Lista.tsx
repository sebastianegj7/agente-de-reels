import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Entrar, TextoAnimado, useTema, useTiempo, Zona} from '../componentes/base';
import {fuenteTexto} from '../temas';
import type {Escena} from '../tipos';

type Props = Extract<Escena, {tipo: 'lista'}>;

// Lista de 2-5 puntos que aparecen a lo largo de la narración.
// El punto que se está contando queda resaltado; los anteriores se atenúan.
export const Lista: React.FC<Props> = ({titulo, items}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const tema = useTema();
	const {entrada, audioFrames} = useTiempo();

	const n = Math.max(1, items.length);
	const tramo = (audioFrames * 0.85) / n;
	const apariciones = items.map((_, i) => entrada + 6 + Math.round(i * tramo));
	const actual = apariciones.filter((a) => frame >= a).length - 1;

	return (
		<AbsoluteFill>
			<Zona centrar={false} arriba={270} gap={34}>
				<TextoAnimado texto={titulo} tamano={74} escalonado={2} />
				<div style={{display: 'flex', flexDirection: 'column', gap: 24, width: '100%', marginTop: 16}}>
					{items.map((item, i) => {
						const p = spring({frame: frame - apariciones[i], fps, config: {damping: 15, stiffness: 150}});
						const enFoco = i === actual;
						return (
							<Entrar key={i} retraso={apariciones[i]} desde="derecha" distancia={160}>
								<div
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: 28,
										padding: '26px 32px',
										borderRadius: 28,
										background: enFoco ? tema.acento : tema.tarjeta,
										border: `2px solid ${enFoco ? tema.acento : tema.borde}`,
										opacity: i < actual ? 0.55 : 1,
										scale: enFoco ? interpolate(p, [0, 1], [0.94, 1.02]) : 1,
										boxShadow: enFoco ? `0 18px 50px ${tema.acento}55` : 'none',
									}}
								>
									<div style={{fontSize: 70, lineHeight: 1, minWidth: 80, textAlign: 'center'}}>
										{item.emoji ?? `${i + 1}`}
									</div>
									<div
										style={{
											fontFamily: fuenteTexto,
											fontWeight: 800,
											fontSize: item.texto.length > 40 ? 42 : 50,
											lineHeight: 1.15,
											color: enFoco ? tema.sobreAcento : tema.texto,
										}}
									>
										{item.texto}
									</div>
								</div>
							</Entrar>
						);
					})}
				</div>
			</Zona>
		</AbsoluteFill>
	);
};
