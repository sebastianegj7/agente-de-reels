import React from 'react';
import {AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {EmojiGrande, salida, TextoAnimado, useTema, Zona} from '../componentes/base';
import type {Escena} from '../tipos';

type Props = Extract<Escena, {tipo: 'gancho'}>;

// Imagen a pantalla completa con zoom lento (Ken Burns) y oscurecida para
// que el texto se lea. La comparten Gancho e Imagen.
export const ImagenFondo: React.FC<{archivo: string; oscurecer?: number}> = ({
	archivo,
	oscurecer = 0.55,
}) => {
	const frame = useCurrentFrame();
	const {durationInFrames} = useVideoConfig();
	return (
		<AbsoluteFill style={{overflow: 'hidden'}}>
			<Img
				src={staticFile(archivo)}
				style={{
					width: '100%',
					height: '100%',
					objectFit: 'cover',
					objectPosition: 'center top',
					scale: interpolate(frame, [0, durationInFrames], [1.08, 1.22]),
					translate: `${interpolate(frame, [0, durationInFrames], [-14, 14])}px 0px`,
				}}
			/>
			<AbsoluteFill
				style={{
					background: `linear-gradient(180deg, rgba(0,0,0,${oscurecer * 0.6}) 0%, rgba(0,0,0,${oscurecer * 0.35}) 40%, rgba(0,0,0,${oscurecer}) 70%, rgba(0,0,0,${Math.min(0.9, oscurecer + 0.25)}) 100%)`,
				}}
			/>
		</AbsoluteFill>
	);
};

// Primeros 1-3 segundos: tiene que detener el scroll.
export const Gancho: React.FC<Props> = ({titulo, emoji, imagen}) => {
	const frame = useCurrentFrame();
	const tema = useTema();
	const conImagen = Boolean(imagen?.archivo);
	return (
		<AbsoluteFill>
			{conImagen ? <ImagenFondo archivo={imagen!.archivo!} oscurecer={0.6} /> : null}
			<Zona gap={50}>
				{emoji ? <EmojiGrande emoji={emoji} tamano={conImagen ? 150 : 210} /> : null}
				<TextoAnimado
					texto={titulo}
					tamano={titulo.length > 60 ? 84 : 100}
					retraso={emoji ? 5 : 0}
					escalonado={3}
					color={conImagen ? '#FFFFFF' : undefined}
				/>
				<div
					style={{
						height: 12,
						borderRadius: 6,
						background: tema.acento,
						width: interpolate(frame, [14, 30], [0, 260], {
							extrapolateLeft: 'clamp',
							extrapolateRight: 'clamp',
							easing: salida,
						}),
					}}
				/>
			</Zona>
		</AbsoluteFill>
	);
};
