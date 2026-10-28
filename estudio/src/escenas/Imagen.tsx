import React from 'react';
import {AbsoluteFill} from 'remotion';
import {EmojiGrande, Entrar, TextoAnimado, useTema, Zona} from '../componentes/base';
import {fuenteTexto} from '../temas';
import type {Escena} from '../tipos';
import {ImagenFondo} from './Gancho';

type Props = Extract<Escena, {tipo: 'imagen'}>;

// Escena visual: imagen IA a pantalla completa con un rótulo arriba.
// Si la imagen no se pudo generar, cae a emoji + título (nunca queda vacía).
export const Imagen: React.FC<Props> = ({titulo, emoji, imagen}) => {
	const tema = useTema();
	if (!imagen?.archivo) {
		return (
			<AbsoluteFill>
				<Zona gap={50}>
					<EmojiGrande emoji={emoji ?? '✨'} tamano={260} />
					{titulo ? <TextoAnimado texto={titulo} tamano={86} retraso={6} /> : null}
				</Zona>
			</AbsoluteFill>
		);
	}
	return (
		<AbsoluteFill>
			<ImagenFondo archivo={imagen.archivo} oscurecer={0.45} />
			{titulo ? (
				<Zona centrar={false} arriba={290}>
					<Entrar desde="arriba" distancia={80} retraso={4}>
						<div
							style={{
								background: tema.acento,
								color: tema.sobreAcento,
								fontFamily: fuenteTexto,
								fontWeight: 900,
								fontSize: titulo.length > 28 ? 52 : 64,
								lineHeight: 1.1,
								padding: '20px 34px',
								borderRadius: 22,
								textAlign: 'center',
								boxShadow: '0 20px 50px rgba(0,0,0,0.45)',
							}}
						>
							{titulo.replace(/\*/g, '')}
						</div>
					</Entrar>
				</Zona>
			) : null}
		</AbsoluteFill>
	);
};
