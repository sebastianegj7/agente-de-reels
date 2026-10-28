import React from 'react';
import {AbsoluteFill} from 'remotion';
import {MedioVisual} from './componentes/Medio';
import {fuenteTexto} from './temas';
import type {Medio} from './tipos';

// Fotograma del medio tal como se verá en el reel (recortado a 9:16) con una
// cuadrícula al 10 %. `reel.py medios` la renderiza para que el guionista vea
// dónde está cada cosa y escriba las coordenadas de cámara y marcas.
export const Cuadricula: React.FC<{medio: Medio}> = ({medio}) => {
	const lineas = [1, 2, 3, 4, 5, 6, 7, 8, 9];
	const rotulo: React.CSSProperties = {
		position: 'absolute',
		fontFamily: fuenteTexto,
		fontWeight: 800,
		fontSize: 30,
		color: '#FFE600',
		textShadow: '0 0 6px #000, 0 0 3px #000',
	};
	return (
		<AbsoluteFill style={{backgroundColor: '#000'}}>
			{medio.archivo ? <MedioVisual medio={medio} camara={{x: 0.5, y: 0.5, zoom: 1}} /> : null}
			{lineas.map((n) => (
				<React.Fragment key={n}>
					<div style={{position: 'absolute', left: `${n * 10}%`, top: 0, bottom: 0, width: 2, background: 'rgba(255,230,0,0.55)'}} />
					<div style={{position: 'absolute', top: `${n * 10}%`, left: 0, right: 0, height: 2, background: 'rgba(255,230,0,0.55)'}} />
					<div style={{...rotulo, left: `calc(${n * 10}% + 6px)`, top: 8}}>x{(n / 10).toFixed(1)}</div>
					<div style={{...rotulo, top: `calc(${n * 10}% + 4px)`, left: 8}}>y{(n / 10).toFixed(1)}</div>
				</React.Fragment>
			))}
		</AbsoluteFill>
	);
};
