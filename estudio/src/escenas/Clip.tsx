import React from 'react';
import {AbsoluteFill} from 'remotion';
import {EmojiGrande, Entrar, TextoAnimado, Zona} from '../componentes/base';
import {FondoMedio, Marcas} from '../componentes/Medio';
import type {Escena} from '../tipos';

type Props = Extract<Escena, {tipo: 'clip'}>;

// El medio real es el protagonista: video/foto a pantalla completa con cámara
// (zooms sincronizados con la voz) y marcas que señalan lo que se cuenta.
// Si no hay medio, cae a emoji + título.
export const Clip: React.FC<Props> = ({medio, camara, marcas, titulo, emoji, posicionTitulo = 'arriba'}) => {
	if (!medio?.archivo) {
		return (
			<AbsoluteFill>
				<Zona gap={50}>
					<EmojiGrande emoji={emoji ?? '🎬'} tamano={240} />
					{titulo ? <TextoAnimado texto={titulo} tamano={84} retraso={6} /> : null}
				</Zona>
			</AbsoluteFill>
		);
	}
	return (
		<AbsoluteFill>
			<FondoMedio medio={medio} camara={camara} oscurecer={0.3} />
			{marcas?.length ? <Marcas marcas={marcas} camara={camara} /> : null}
			{titulo ? (
				<Zona centrar={false} arriba={posicionTitulo === 'arriba' ? 270 : 880}>
					<Entrar desde={posicionTitulo === 'arriba' ? 'arriba' : 'abajo'} distancia={70} retraso={3}>
						<div style={{filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.85))'}}>
							<TextoAnimado texto={titulo} tamano={titulo.length > 34 ? 66 : 80} escalonado={2} color="#FFFFFF" />
						</div>
					</Entrar>
				</Zona>
			) : null}
		</AbsoluteFill>
	);
};
