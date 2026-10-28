// Uso: node render.mjs <carpeta-del-reel> [previas|video|ambos]
// - previas: un PNG por escena (en su momento más "lleno") en <reel>/previas/
// - video:   <reel>/final.mp4
// La carpeta del reel es la carpeta pública: audio/, img/ y musica/ se
// referencian desde reel.json con rutas relativas a ella.
import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const [, , carpetaArg, modo = 'ambos'] = process.argv;
if (!carpetaArg) {
	console.error('Falta la carpeta del reel');
	process.exit(1);
}
const carpeta = path.resolve(carpetaArg);
const reel = JSON.parse(fs.readFileSync(path.join(carpeta, 'reel.json'), 'utf8'));

console.log('Empaquetando…');
const serveUrl = await bundle({
	entryPoint: path.join(aqui, 'src', 'index.ts'),
	publicDir: carpeta,
});
const composition = await selectComposition({serveUrl, id: 'Reel', inputProps: reel});
const segundos = (composition.durationInFrames / composition.fps).toFixed(1);
console.log(`Duración: ${segundos}s (${composition.durationInFrames} frames)`);

if (modo === 'previas' || modo === 'ambos') {
	const dirPrevias = path.join(carpeta, 'previas');
	fs.mkdirSync(dirPrevias, {recursive: true});
	const marcas = composition.props._marcas;
	for (const [i, m] of marcas.entries()) {
		// ~70% de la parte hablada: ya entraron casi todos los elementos.
		const frame = Math.min(
			composition.durationInFrames - 1,
			m.inicio + 2 + Math.round(m.audioFrames * 0.7),
		);
		const salida = path.join(dirPrevias, `escena_${String(i + 1).padStart(2, '0')}.png`);
		await renderStill({composition, serveUrl, output: salida, frame, inputProps: reel});
		console.log(`Previa ${i + 1}/${marcas.length}: ${salida}`);
	}
}

if (modo === 'video' || modo === 'ambos') {
	const salida = path.join(carpeta, 'final.mp4');
	let ultimo = -1;
	await renderMedia({
		composition,
		serveUrl,
		codec: 'h264',
		crf: 18,
		audioBitrate: '192k',
		outputLocation: salida,
		inputProps: reel,
		onProgress: ({progress}) => {
			const pct = Math.floor(progress * 10) * 10;
			if (pct !== ultimo) {
				ultimo = pct;
				console.log(`Render: ${pct}%`);
			}
		},
	});
	console.log(`Video listo: ${salida}`);
}
