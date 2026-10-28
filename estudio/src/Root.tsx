import React from 'react';
import {Composition, type CalculateMetadataFunction} from 'remotion';
import T from './tiempos.json';
import {Reel} from './Reel';
import {Cuadricula} from './Cuadricula';
import {calcularMarcas, duracionTotal, type Reel as ReelProps} from './tipos';

// La duración sale de los audios de cada escena; las marcas se devuelven en
// las props para que render.mjs sepa en qué frame sacar cada previa.
const calcular: CalculateMetadataFunction<ReelProps> = ({props}) => {
	const marcas = calcularMarcas(props.escenas);
	return {durationInFrames: duracionTotal(marcas), props: {...props, _marcas: marcas}};
};

// Ejemplo sin audio para ver las plantillas en Remotion Studio.
const ejemplo: ReelProps = {
	titulo: 'Demo de plantillas',
	tema: 'noche',
	efectos: false,
	escenas: [
		{tipo: 'gancho', narracion: '', emoji: '🧠', titulo: 'Tu cerebro *te engaña* cada día'},
		{tipo: 'dato', narracion: '', numero: 95, sufijo: '%', etiqueta: 'de tus decisiones son *automáticas*'},
		{
			tipo: 'lista',
			narracion: '',
			titulo: '3 sesgos que *te controlan*',
			items: [
				{emoji: '🪞', texto: 'Sesgo de confirmación'},
				{emoji: '⚓', texto: 'Efecto ancla'},
				{emoji: '🐑', texto: 'Efecto rebaño'},
			],
		},
		{
			tipo: 'comparacion',
			narracion: '',
			izquierda: {emoji: '⚡', titulo: 'Sistema 1', texto: 'Rápido e intuitivo'},
			derecha: {emoji: '🐢', titulo: 'Sistema 2', texto: 'Lento y racional'},
			ganador: 'derecha',
		},
		{tipo: 'frase', narracion: '', texto: 'No ves el mundo como *es*, lo ves como *eres*'},
		{
			tipo: 'grafico',
			narracion: '',
			titulo: 'Decisiones por día',
			barras: [
				{etiqueta: 'Niño', valor: 3000},
				{etiqueta: 'Adulto', valor: 35000},
			],
		},
		{tipo: 'imagen', narracion: '', emoji: '🌌', titulo: 'Sin imagen: respaldo'},
		{tipo: 'cta', narracion: '', texto: '*Guárdalo* para no olvidarlo', accion: 'guardar'},
	],
};

export const RemotionRoot: React.FC = () => (
	<>
		<Composition
			id="Cuadricula"
			component={Cuadricula}
			fps={T.fps}
			width={T.ancho}
			height={T.alto}
			durationInFrames={T.fps * 60}
			defaultProps={{medio: {}}}
		/>
		<Composition
			id="Reel"
			component={Reel}
			fps={T.fps}
			width={T.ancho}
			height={T.alto}
			durationInFrames={300}
			defaultProps={ejemplo}
			calculateMetadata={calcular}
		/>
	</>
);
