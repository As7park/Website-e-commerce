<script lang="ts">
	/* =========================================================
	   BANDEAU + CUBE 3D — un cube Three.js au centre d'un bandeau
	   ambre. Pas encore de modèle : cube placeholder (faces
	   numérotées, halftone) à remplacer plus tard par un .glb.
	   - `pinned` (accueil) : section épinglée, cube / bandeau /
	     légendes pilotés par le scroll, HUD + progression.
	   - sinon (boutique) : version compacte, rotation au défilement.
	   Porté depuis le bloc "BANDEAU CUBE 3D" de la maquette.
	   ========================================================= */
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { gsap, getScrollDelta, onWindow, prefersReducedMotion } from '$lib/shop/fx';

	let {
		pinned = false,
		bgText,
		rowItems,
		captions = [],
		hudLabel = ''
	}: {
		pinned?: boolean;
		/** Gros texte en contour derrière le bandeau. */
		bgText: string;
		/** Textes du bandeau, répétés sur deux lignes (pleine / contour). */
		rowItems: string[];
		/** Légendes qui apparaissent tour à tour (version épinglée). */
		captions?: { title: string; text: string }[];
		hudLabel?: string;
	} = $props();

	const REPEAT = 7;
	let sequence = $derived(Array.from({ length: REPEAT }, () => rowItems).flat());

	let stageEl: HTMLElement;
	let canvasEl: HTMLCanvasElement;
	let pct = $state('000');

	// Couleurs de la charte (voir shop.css) — l'ambre AS7 remplace l'orange de la maquette.
	const AMBER = '#FFB200';
	const INK = '#14120F';
	const PANEL = '#1D1A15';
	const PAPER = '#F2EFE4';

	function faceTexture(n: number, accent: boolean) {
		const s = 512;
		const c = document.createElement('canvas');
		c.width = c.height = s;
		const x = c.getContext('2d')!;
		x.fillStyle = accent ? AMBER : PANEL;
		x.fillRect(0, 0, s, s);
		x.fillStyle = accent ? 'rgba(20,18,15,.22)' : 'rgba(242,239,228,.14)';
		for (let i = 0; i < s; i += 16) {
			for (let j = 0; j < s; j += 16) {
				x.beginPath();
				x.arc(i + 8, j + 8, 2.2, 0, Math.PI * 2);
				x.fill();
			}
		}
		x.strokeStyle = accent ? INK : PAPER;
		x.lineWidth = 10;
		x.strokeRect(22, 22, s - 44, s - 44);
		x.fillStyle = accent ? INK : PAPER;
		x.textAlign = 'center';
		x.textBaseline = 'middle';
		x.font = '260px Staatliches, Impact, sans-serif';
		x.fillText(String(n).padStart(2, '0'), s / 2, s / 2 + 10);
		x.font = '34px "Space Grotesk", Arial, sans-serif';
		x.fillText('AS7 PARK', s / 2, s - 70);
		const t = new THREE.CanvasTexture(c);
		t.colorSpace = THREE.SRGBColorSpace;
		t.anisotropy = 4;
		return t;
	}

	onMount(() => {
		const reduce = prefersReducedMotion();
		let destroyed = false;
		const disposables: Array<{ dispose(): void }> = [];

		const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
		camera.position.set(0, 0, 10);

		// Three ≥ r155 : éclairage physique, intensités ×π pour retrouver le rendu r128 de la maquette.
		scene.add(new THREE.AmbientLight(0xffffff, 0.5 * Math.PI));
		const key = new THREE.DirectionalLight(0xfff1dc, 1.35 * Math.PI);
		key.position.set(4, 5, 6);
		scene.add(key);
		const rim = new THREE.PointLight(0xffb200, 2.4 * Math.PI * 8, 30, 2);
		rim.position.set(-6, -2, 3);
		scene.add(rim);
		const fill = new THREE.PointLight(0xc9f04d, 0.9 * Math.PI * 8, 30, 2);
		fill.position.set(6, -4, -2);
		scene.add(fill);

		const group = new THREE.Group();
		scene.add(group);
		let cube: THREE.Mesh | null = null;
		let halo: THREE.LineSegments | null = null;
		const st = { rotY: 0.6, rotX: 0.35, scale: pinned && !reduce ? 0.55 : 1, lift: 0 };

		function build() {
			if (destroyed) return;
			const mats: THREE.MeshStandardMaterial[] = [];
			for (let i = 0; i < 6; i++) {
				const map = faceTexture(i + 1, i === 1 || i === 4);
				const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.62, metalness: 0.12 });
				mats.push(mat);
				disposables.push(map, mat);
			}
			const box = new THREE.BoxGeometry(2.7, 2.7, 2.7);
			cube = new THREE.Mesh(box, mats);
			group.add(cube);
			const edgesGeo = new THREE.EdgesGeometry(box);
			const edgesMat = new THREE.LineBasicMaterial({ color: 0xf2efe4 });
			const edges = new THREE.LineSegments(edgesGeo, edgesMat);
			edges.scale.setScalar(1.002);
			group.add(edges);
			const haloBox = new THREE.BoxGeometry(3.3, 3.3, 3.3);
			const haloGeo = new THREE.EdgesGeometry(haloBox);
			const haloMat = new THREE.LineBasicMaterial({
				color: 0xffb200,
				transparent: true,
				opacity: 0.7
			});
			halo = new THREE.LineSegments(haloGeo, haloMat);
			group.add(halo);
			disposables.push(box, edgesGeo, edgesMat, haloBox, haloGeo, haloMat);
		}
		// Les faces dessinent du Staatliches : on attend la police (1,5 s max).
		Promise.race([
			document.fonts?.load('200px Staatliches') ?? Promise.resolve(),
			new Promise((r) => setTimeout(r, 1500))
		]).then(build, build);

		function resize() {
			const w = canvasEl.clientWidth;
			const h = canvasEl.clientHeight;
			if (!w || !h) return;
			renderer.setSize(w, h, false);
			const a = w / h;
			camera.aspect = a;
			camera.position.z = a < 1.2 ? 10 + (1.2 - a) * 8 : 10;
			camera.updateProjectionMatrix();
		}
		const resizeObserver = new ResizeObserver(resize);
		resizeObserver.observe(stageEl);
		resize();

		let visible = true;
		const intersectionObserver = new IntersectionObserver((es) => {
			visible = es[0].isIntersecting;
		});
		intersectionObserver.observe(stageEl);

		let mx = 0;
		let my = 0;
		let tx = 0;
		let ty = 0;
		const onMove = (e: MouseEvent) => {
			tx = e.clientX / window.innerWidth - 0.5;
			ty = e.clientY / window.innerHeight - 0.5;
		};
		window.addEventListener('mousemove', onMove);

		const t0 = performance.now();
		let rafId = 0;
		const loop = (now: number) => {
			rafId = requestAnimationFrame(loop);
			if (!visible || !cube || !halo) return;
			const t = (now - t0) / 1000;
			mx += (tx - mx) * 0.06;
			my += (ty - my) * 0.06;
			group.rotation.y = st.rotY + t * 0.12 + mx * 0.6;
			group.rotation.x = st.rotX + my * 0.4 + Math.sin(t * 0.6) * 0.05;
			group.position.y = Math.sin(t * 0.9) * 0.12 + st.lift;
			group.scale.set(st.scale, st.scale, st.scale);
			halo.rotation.y = -t * 0.25 - st.rotY * 0.5;
			halo.rotation.x = t * 0.15;
			renderer.render(scene, camera);
		};
		rafId = requestAnimationFrame(loop);

		/* ---------- pilotage au scroll ---------- */
		let skewTick: (() => void) | null = null;
		const ctx = reduce
			? null
			: gsap.context(() => {
					const q = gsap.utils.selector(stageEl);
					const tl = gsap.timeline({
						scrollTrigger: onWindow(
							pinned
								? {
										trigger: stageEl,
										start: 'top top',
										end: '+=320%',
										pin: true,
										scrub: 1,
										anticipatePin: 1,
										refreshPriority: 1,
										invalidateOnRefresh: true,
										onUpdate: (self) => {
											pct = String(Math.round(self.progress * 100)).padStart(3, '0');
											const bar = q('.shop-cube-progress i')[0];
											if (bar) bar.style.transform = `scaleX(${self.progress})`;
										}
									}
								: { trigger: stageEl, start: 'top bottom', end: 'bottom top', scrub: 1 }
						)
					});
					tl.to(
						st,
						{
							rotY: Math.PI * (pinned ? 4 : 2),
							rotX: pinned ? 0.9 : 0.6,
							ease: 'none',
							duration: 1
						},
						0
					);
					tl.to(q('.shop-cube-row.is-solid'), { xPercent: -120, ease: 'none', duration: 1 }, 0);
					tl.fromTo(
						q('.shop-cube-row.is-outline'),
						{ xPercent: -120 },
						{ xPercent: 0, ease: 'none', duration: 1 },
						0
					);
					tl.to(q('.shop-cube-bgtext'), { xPercent: -30, ease: 'none', duration: 1 }, 0);
					if (pinned) {
						tl.fromTo(
							q('.shop-cube-band'),
							{ clipPath: 'inset(48% 0% 48% 0%)' },
							{ clipPath: 'inset(0% 0% 0% 0%)', ease: 'power3.out', duration: 0.12 },
							0
						);
						tl.fromTo(
							st,
							{ scale: 0.55 },
							{ scale: 1.1, ease: 'power2.out', duration: 0.35 },
							0
						).to(st, { scale: 0.92, ease: 'power1.inOut', duration: 0.65 }, 0.35);
						const slots = [
							[0.08, 0.3],
							[0.38, 0.62],
							[0.7, 0.95]
						];
						q('.shop-cube-caption').forEach((cap, i) => {
							const s = slots[i] ?? slots[2];
							tl.fromTo(
								cap,
								{ autoAlpha: 0, y: 60 },
								{ autoAlpha: 1, y: 0, duration: 0.08, ease: 'power2.out' },
								s[0]
							).to(cap, { autoAlpha: 0, y: -60, duration: 0.08, ease: 'power2.in' }, s[1]);
						});
					}

					// Inclinaison des textes selon la vitesse de scroll.
					const setSkew = gsap.quickSetter(q('.shop-cube-track'), 'skewX', 'deg');
					let skew = 0;
					skewTick = () => {
						if (!visible) return;
						skew += (gsap.utils.clamp(-14, 14, -getScrollDelta() * 0.35) - skew) * 0.12;
						setSkew(skew);
					};
					gsap.ticker.add(skewTick);
				}, stageEl);

		return () => {
			destroyed = true;
			if (skewTick) gsap.ticker.remove(skewTick);
			ctx?.revert();
			cancelAnimationFrame(rafId);
			resizeObserver.disconnect();
			intersectionObserver.disconnect();
			window.removeEventListener('mousemove', onMove);
			for (const d of disposables) d.dispose();
			renderer.dispose();
		};
	});
</script>

<section class="shop-cube-stage" class:is-compact={!pinned} bind:this={stageEl} aria-label={bgText}>
	<div class="shop-cube-grain"></div>
	<div class="shop-cube-bgtext" aria-hidden="true">{bgText}</div>
	<div class="shop-cube-band" aria-hidden="true">
		<!-- eslint-disable svelte/require-each-key -- répétitions décoratives -->
		<div class="shop-cube-row is-solid">
			<div class="shop-cube-track">
				{#each sequence as item}<span>{item}</span><i>//</i>{/each}
			</div>
		</div>
		<div class="shop-cube-row is-outline">
			<div class="shop-cube-track">
				{#each sequence as item}<span>{item}</span><i>//</i>{/each}
			</div>
		</div>
		<!-- eslint-enable svelte/require-each-key -->
	</div>
	<canvas class="shop-cube-canvas" bind:this={canvasEl}></canvas>
	{#if pinned}
		{#each captions as caption, i (caption.title)}
			<div class="shop-cube-caption is-c{i + 1}">
				<span class="shop-cube-bib">{String(i + 1).padStart(2, '0')}</span>
				<h3>{caption.title}</h3>
				<p>{caption.text}</p>
			</div>
		{/each}
		<div class="shop-cube-hud" aria-hidden="true">
			<span class="is-tl">{hudLabel}</span><span class="is-br">{pct}</span>
		</div>
		<div class="shop-cube-progress"><i></i></div>
	{/if}
</section>
