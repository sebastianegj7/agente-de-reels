import React from 'react';
import {Audio} from '@remotion/media';
import {linearTiming, TransitionSeries, type TransitionPresentation} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {slide} from '@remotion/transitions/slide';
import {wipe} from '@remotion/transitions/wipe';
import {AbsoluteFill, interpolate, Sequence, staticFile, useVideoConfig} from 'remotion';
import T from './tiempos.json';
import {calcularMarcas, type Escena, type Reel as ReelProps} from './tipos';
import {obtenerTema} from './temas';
import {TemaContexto, TiempoContexto} from './componentes/base';
import {BarraProgreso, Fondo} from './componentes/Fondo';
import {Subtitulos} from './componentes/Subtitulos';
import {Gancho} from './escenas/Gancho';
import {Dato} from './escenas/Dato';
import {Lista} from './escenas/Lista';
import {Imagen} from './escenas/Imagen';
import {Comparacion} from './escenas/Comparacion';
import {Frase} from './escenas/Frase';
import {Grafico} from './escenas/Grafico';
import {Cta} from './escenas/Cta';

const SFX = {
	whoosh: 'https://remotion.media/whoosh.wav',
	ding: 'https://remotion.media/ding.wav',
};

const Visual: React.FC<{escena: Escena}> = ({escena}) => {
	switch (escena.tipo) {
		case 'gancho':
			return <Gancho {...escena} />;
		case 'dato':
			return <Dato {...escena} />;
		case 'lista':
			return <Lista {...escena} />;
		case 'imagen':
			return <Imagen {...escena} />;
		case 'comparacion':
			return <Comparacion {...escena} />;
		case 'frase':
			return <Frase {...escena} />;
		case 'grafico':
			return <Grafico {...escena} />;
		case 'cta':
			return <Cta {...escena} />;
	}
};

// Variedad de transiciones sin que se sienta aleatorio: rota un ciclo fijo.
const transicion = (i: number) => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const ciclo: TransitionPresentation<any>[] = [
		slide({direction: 'from-bottom'}),
		fade(),
		wipe({direction: 'from-right'}),
		slide({direction: 'from-right'}),
		fade(),
	];
	return ciclo[i % ciclo.length];
};

const Musica: React.FC<{archivo: string; volumen: number}> = ({archivo, volumen}) => {
	const {durationInFrames} = useVideoConfig();
	return (
		<Audio
			src={staticFile(archivo)}
			loop
			volume={(f) =>
				interpolate(f, [0, 20, durationInFrames - 40, durationInFrames], [0, volumen, volumen, 0], {
					extrapolateLeft: 'clamp',
					extrapolateRight: 'clamp',
				})
			}
		/>
	);
};

export const Reel: React.FC<ReelProps> = ({tema, escenas, musica, efectos = true}) => {
	const marcas = calcularMarcas(escenas);
	return (
		<TemaContexto.Provider value={obtenerTema(tema)}>
			<AbsoluteFill style={{backgroundColor: '#000'}}>
				<Fondo />
				<TransitionSeries>
					{escenas.flatMap((escena, i) => {
						const m = marcas[i];
						const recorte = Math.floor(((escena.recorteMs ?? 0) / 1000) * T.fps);
						const nodos = [
							<TransitionSeries.Sequence
								key={`e${i}`}
								name={`${i + 1}. ${escena.tipo}`}
								durationInFrames={m.duracion}
							>
								<TiempoContexto.Provider value={{entrada: T.entrada, audioFrames: m.audioFrames}}>
									<Visual escena={escena} />
									{escena.audio ? (
										<Sequence from={T.entrada} name="Voz" layout="none">
											<Audio src={staticFile(escena.audio)} trimBefore={recorte} />
										</Sequence>
									) : null}
									{escena.palabras?.length && escena.subtitulos !== false ? (
										<Subtitulos palabras={escena.palabras} />
									) : null}
								</TiempoContexto.Provider>
							</TransitionSeries.Sequence>,
						];
						if (i < escenas.length - 1) {
							nodos.push(
								<TransitionSeries.Transition
									key={`t${i}`}
									presentation={transicion(i)}
									timing={linearTiming({durationInFrames: T.transicion})}
								/>,
							);
						}
						return nodos;
					})}
				</TransitionSeries>
				<BarraProgreso />
				{musica?.archivo ? <Musica archivo={musica.archivo} volumen={musica.volumen ?? 0.12} /> : null}
				{efectos
					? marcas.slice(1).map((m, i) => (
							<Sequence key={`w${i}`} from={Math.max(0, m.inicio - 4)} durationInFrames={30} layout="none">
								<Audio src={SFX.whoosh} volume={0.22} />
							</Sequence>
						))
					: null}
				{efectos
					? escenas.map((e, i) =>
							e.tipo === 'dato' ? (
								<Sequence
									key={`d${i}`}
									from={marcas[i].inicio + T.entrada + Math.round(1.3 * T.fps)}
									durationInFrames={45}
									layout="none"
								>
									<Audio src={SFX.ding} volume={0.18} />
								</Sequence>
							) : null,
						)
					: null}
			</AbsoluteFill>
		</TemaContexto.Provider>
	);
};
