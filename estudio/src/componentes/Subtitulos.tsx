import React, {useMemo} from 'react';
import {createTikTokStyleCaptions, type Caption} from '@remotion/captions';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Palabra} from '../tipos';
import {fuenteTexto, ZONA} from '../temas';
import {useTema, useTiempo} from './base';

// Subtítulos karaoke: grupos de 2-3 palabras, la palabra que suena en acento.
// Los tiempos vienen de edge-tts (relativos al audio ya recortado).
export const Subtitulos: React.FC<{palabras: Palabra[]}> = ({palabras}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const tema = useTema();
	const {entrada, audioFrames} = useTiempo();

	const paginas = useMemo(() => {
		const captions: Caption[] = palabras.map((p, i) => ({
			text: (i === 0 ? '' : ' ') + p.texto,
			startMs: p.inicioMs,
			endMs: p.finMs,
			timestampMs: (p.inicioMs + p.finMs) / 2,
			confidence: null,
		}));
		return createTikTokStyleCaptions({captions, combineTokensWithinMilliseconds: 650}).pages;
	}, [palabras]);

	const ms = ((frame - entrada) / fps) * 1000;
	if (ms < 0 || frame > entrada + audioFrames + 4) return null;

	let indice = paginas.findIndex((p, i) => {
		const fin = paginas[i + 1]?.startMs ?? Infinity;
		return ms >= p.startMs && ms < fin;
	});
	if (indice === -1) indice = 0;
	const pagina = paginas[indice];
	if (!pagina) return null;

	const inicioPagina = entrada + Math.round((pagina.startMs / 1000) * fps);
	const pop = spring({frame: frame - inicioPagina, fps, config: {damping: 12, stiffness: 220}});

	return (
		<div
			style={{
				position: 'absolute',
				top: ZONA.subtitulosY,
				left: 70,
				width: 940,
				display: 'flex',
				justifyContent: 'center',
				flexWrap: 'wrap',
				columnGap: 30,
				fontFamily: fuenteTexto,
				fontWeight: 900,
				fontSize: 70,
				lineHeight: 1.1,
				textTransform: 'uppercase',
				textAlign: 'center',
				scale: interpolate(pop, [0, 1], [0.82, 1]),
			}}
		>
			{pagina.tokens.map((tk, i) => {
				const activa = ms >= tk.fromMs && ms < tk.toMs + 120;
				return (
					<span
						key={i}
						style={{
							color: activa ? tema.acento : '#FFFFFF',
							WebkitTextStroke: '10px #000',
							paintOrder: 'stroke fill',
							textShadow: '0 6px 18px rgba(0,0,0,0.55)',
							scale: activa ? 1.08 : 1,
						}}
					>
						{tk.text.trim()}
					</span>
				);
			})}
		</div>
	);
};
