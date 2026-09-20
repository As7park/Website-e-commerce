<script lang="ts">
	/* =========================================================
	   HERO — scène Three.js en perspective, portée depuis la
	   maquette statique (poussière + volutes autour du curseur,
	   parallaxe souris/scroll). Nettoyage complet au démontage
	   pour rester compatible avec la navigation SPA de SvelteKit.
	   ========================================================= */
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';
	import { gsap } from 'gsap';

	let { children } = $props();

	let canvasEl: HTMLCanvasElement;
	let contentEl: HTMLDivElement;
	let introEl: HTMLDivElement;
	let sectionEl: HTMLElement;

	let rafId = 0;
	const cleanups: Array<() => void> = [];

	onMount(() => {
		if (introEl) {
			const targets = introEl.children;
			gsap.to(targets, {
				opacity: 1,
				y: 0,
				duration: 0.9,
				ease: 'power3.out',
				stagger: 0.12,
				delay: 0.2
			});
		}

		if (!canvasEl) return;

		const BG_NEAR = 0x18201c;
		const FOG_COLOR = 0x030302;

		const scene = new THREE.Scene();
		scene.background = new THREE.Color(FOG_COLOR);

		const camera = new THREE.PerspectiveCamera(
			45,
			canvasEl.clientWidth / canvasEl.clientHeight || 1,
			0.1,
			100
		);
		camera.position.set(0, 0.3, 10);

		const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

		function makeDustTexture() {
			const size = 24;
			const c = document.createElement('canvas');
			c.width = c.height = size;
			const ctx = c.getContext('2d')!;
			const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
			g.addColorStop(0, 'rgba(255,255,255,0.95)');
			g.addColorStop(0.5, 'rgba(255,255,255,0.25)');
			g.addColorStop(1, 'rgba(255,255,255,0)');
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, size, size);
			return new THREE.CanvasTexture(c);
		}
		const dustTexture = makeDustTexture();

		function makeGlowTexture() {
			const size = 256;
			const c = document.createElement('canvas');
			c.width = c.height = size;
			const ctx = c.getContext('2d')!;
			const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
			g.addColorStop(0, 'rgba(255,255,255,0.5)');
			g.addColorStop(0.4, 'rgba(255,255,255,0.14)');
			g.addColorStop(1, 'rgba(255,255,255,0)');
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, size, size);
			return new THREE.CanvasTexture(c);
		}
		const glowTexture = makeGlowTexture();
		const glow = new THREE.Sprite(
			new THREE.SpriteMaterial({
				map: glowTexture,
				transparent: true,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				opacity: 0.45
			})
		);
		glow.scale.set(15, 15, 1);
		glow.position.set(0.4, 1, 7);
		scene.add(glow);

		const COUNT = 1100;
		const basePositions: Array<{ x0: number; y0: number; z0: number }> = [];
		const positions = new Float32Array(COUNT * 3);
		const sizes = new Float32Array(COUNT);
		const alphas = new Float32Array(COUNT);
		const tints = new Float32Array(COUNT);

		const cycles: Array<{
			fallSpeed: number;
			spanY: number;
			freqX1: number;
			freqX2: number;
			ampX1: number;
			ampX2: number;
			freqZ: number;
			ampZ: number;
			phase: number;
			flickerFreq: number;
			flickerPhase: number;
			maxAlpha: number;
		}> = [];
		const swirlX = new Float32Array(COUNT);
		const swirlY = new Float32Array(COUNT);
		const swirlVX = new Float32Array(COUNT);
		const swirlVY = new Float32Array(COUNT);

		const Z_NEAR = 5;
		const Z_FAR = -13;

		for (let i = 0; i < COUNT; i++) {
			const z = Z_NEAR + Math.random() * (Z_FAR - Z_NEAR);
			const x0 = (Math.random() - 0.5) * 17;
			const y0 = (Math.random() - 0.5) * 10;
			basePositions.push({ x0, y0, z0: z });

			positions[i * 3 + 0] = x0;
			positions[i * 3 + 1] = y0;
			positions[i * 3 + 2] = z;

			sizes[i] = 0.5 + Math.random() * 1.0;

			const depthT = (z - Z_FAR) / (Z_NEAR - Z_FAR);
			tints[i] = Math.pow(depthT, 1.7) * 0.95 + 0.03;

			alphas[i] = 0;

			cycles.push({
				fallSpeed: 0.04 + Math.random() * 0.08,
				spanY: 8 + Math.random() * 4,
				freqX1: 0.3 + Math.random() * 0.4,
				freqX2: 0.12 + Math.random() * 0.2,
				ampX1: 0.15 + Math.random() * 0.3,
				ampX2: 0.08 + Math.random() * 0.18,
				freqZ: 0.15 + Math.random() * 0.25,
				ampZ: 0.2 + Math.random() * 0.5,
				phase: Math.random() * Math.PI * 2,
				flickerFreq: 0.3 + Math.random() * 0.4,
				flickerPhase: Math.random() * Math.PI * 2,
				maxAlpha: 0.12 + Math.random() * 0.22
			});
		}

		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
		geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
		geometry.setAttribute('aTint', new THREE.BufferAttribute(tints, 1));

		const material = new THREE.ShaderMaterial({
			uniforms: {
				uTexture: { value: dustTexture },
				uColor: { value: new THREE.Color(0xdcdcd8) },
				uFogColor: { value: new THREE.Color(FOG_COLOR) },
				uFogNear: { value: 6.0 },
				uFogFar: { value: 20.0 }
			},
			vertexShader: `
				attribute float aSize;
				attribute float aAlpha;
				attribute float aTint;
				varying float vAlpha;
				varying float vTint;
				varying float vViewZ;
				void main() {
					vAlpha = aAlpha;
					vTint = aTint;
					vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
					vViewZ = -mvPosition.z;
					gl_PointSize = aSize * (150.0 / -mvPosition.z);
					gl_Position = projectionMatrix * mvPosition;
				}
			`,
			fragmentShader: `
				precision mediump float;
				uniform sampler2D uTexture;
				uniform vec3 uColor;
				uniform vec3 uFogColor;
				uniform float uFogNear;
				uniform float uFogFar;
				varying float vAlpha;
				varying float vTint;
				varying float vViewZ;
				void main() {
					vec4 tex = texture2D(uTexture, gl_PointCoord);
					float fogFactor = clamp((vViewZ - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
					vec3 baseColor = uColor * vTint;
					vec3 finalColor = mix(baseColor, uFogColor, fogFactor);
					float finalAlpha = tex.a * vAlpha * (1.0 - fogFactor * 0.92);
					gl_FragColor = vec4(finalColor, finalAlpha);
				}
			`,
			transparent: true,
			depthWrite: false,
			depthTest: true,
			blending: THREE.NormalBlending
		});

		const particles = new THREE.Points(geometry, material);
		scene.add(particles);

		scene.add(new THREE.AmbientLight(0x10120f, 1));

		let mouseX = 0;
		let mouseY = 0;
		let camX = 0;
		let camY = 0;
		let scrollY = 0;

		function onWindowMouseMove(e: MouseEvent) {
			mouseX = e.clientX / window.innerWidth - 0.5;
			mouseY = e.clientY / window.innerHeight - 0.5;
			if (contentEl) {
				contentEl.style.transform = `translate(${-mouseX * 10}px,${-mouseY * 6}px)`;
			}
		}
		window.addEventListener('mousemove', onWindowMouseMove);
		cleanups.push(() => window.removeEventListener('mousemove', onWindowMouseMove));

		function onWindowScroll() {
			scrollY = window.scrollY;
			if (sectionEl && scrollY < window.innerHeight * 1.2) {
				canvasEl.style.transform = `translateY(${scrollY * 0.28}px)`;
				if (contentEl) contentEl.style.marginTop = `${scrollY * 0.12}px`;
			}
		}
		window.addEventListener('scroll', onWindowScroll, { passive: true });
		cleanups.push(() => window.removeEventListener('scroll', onWindowScroll));

		const mouseNDC = new THREE.Vector2(-9, -9);
		const raycaster = new THREE.Raycaster();

		function onCanvasMouseMove(e: MouseEvent) {
			const rect = canvasEl.getBoundingClientRect();
			mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
			mouseNDC.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
		}
		function onCanvasMouseLeave() {
			mouseNDC.set(-9, -9);
		}
		canvasEl.addEventListener('mousemove', onCanvasMouseMove);
		canvasEl.addEventListener('mouseleave', onCanvasMouseLeave);
		cleanups.push(() => canvasEl.removeEventListener('mousemove', onCanvasMouseMove));
		cleanups.push(() => canvasEl.removeEventListener('mouseleave', onCanvasMouseLeave));

		function resize() {
			const w = canvasEl.clientWidth;
			const h = canvasEl.clientHeight;
			if (!w || !h) return;
			renderer.setSize(w, h, false);
			camera.aspect = w / h;
			camera.updateProjectionMatrix();
		}
		window.addEventListener('resize', resize);
		cleanups.push(() => window.removeEventListener('resize', resize));
		resize();

		const SWIRL_RADIUS = 3.4;
		const SWIRL_STRENGTH = 0.05;
		const PUSH_STRENGTH = 0.014;
		const DAMPING = 0.93;
		const RELAX = 0.985;

		const clock = new THREE.Clock();

		function animate() {
			rafId = requestAnimationFrame(animate);
			const t = clock.getElapsedTime();

			raycaster.setFromCamera(mouseNDC, camera);
			const ro = raycaster.ray.origin;
			const rd = raycaster.ray.direction;
			const mouseActive = mouseNDC.x > -5;

			const pos = geometry.attributes.position.array as Float32Array;
			const alph = geometry.attributes.aAlpha.array as Float32Array;

			for (let i = 0; i < COUNT; i++) {
				const b = basePositions[i];
				const cy = cycles[i];

				const raw = (t * cy.fallSpeed + cy.phase) % cy.spanY;
				const yLocal = cy.spanY / 2 - raw;
				const baseX =
					b.x0 +
					Math.sin(t * cy.freqX1 + cy.phase) * cy.ampX1 +
					Math.sin(t * cy.freqX2 + cy.phase * 2.1) * cy.ampX2;
				const baseY = b.y0 * 0.2 + yLocal;
				const baseZ = b.z0 + Math.sin(t * cy.freqZ + cy.phase * 1.4) * cy.ampZ;

				if (mouseActive && rd.z !== 0) {
					const tRay = (baseZ - ro.z) / rd.z;
					if (tRay > 0) {
						const mx = ro.x + rd.x * tRay;
						const my = ro.y + rd.y * tRay;
						const ddx = baseX + swirlX[i] - mx;
						const ddy = baseY + swirlY[i] - my;
						const dist = Math.sqrt(ddx * ddx + ddy * ddy) + 0.0001;
						if (dist < SWIRL_RADIUS) {
							const falloff = 1 - dist / SWIRL_RADIUS;
							const tx = -ddy / dist;
							const ty = ddx / dist;
							swirlVX[i] += tx * falloff * falloff * SWIRL_STRENGTH;
							swirlVY[i] += ty * falloff * falloff * SWIRL_STRENGTH;
							swirlVX[i] += (ddx / dist) * falloff * PUSH_STRENGTH;
							swirlVY[i] += (ddy / dist) * falloff * PUSH_STRENGTH;
						}
					}
				}
				swirlVX[i] *= DAMPING;
				swirlVY[i] *= DAMPING;
				swirlX[i] = (swirlX[i] + swirlVX[i]) * RELAX;
				swirlY[i] = (swirlY[i] + swirlVY[i]) * RELAX;

				pos[i * 3 + 0] = baseX + swirlX[i];
				pos[i * 3 + 1] = baseY + swirlY[i];
				pos[i * 3 + 2] = baseZ;

				const edge = 0.2;
				const progress = raw / cy.spanY;
				let fade = 1.0;
				if (progress < edge) fade = progress / edge;
				else if (progress > 1 - edge) fade = (1 - progress) / edge;
				const flicker = 0.9 + Math.sin(t * cy.flickerFreq + cy.flickerPhase) * 0.1;

				alph[i] = Math.max(0, Math.min(1, fade)) * flicker * cy.maxAlpha;
			}
			geometry.attributes.position.needsUpdate = true;
			geometry.attributes.aAlpha.needsUpdate = true;

			camX += (mouseX * 1.3 - camX) * 0.02;
			camY += (-mouseY * 0.8 - camY) * 0.02;
			camera.position.x = camX;
			camera.position.y = 0.3 + camY;
			camera.lookAt(0, 0.3, -3);

			glow.material.opacity = 0.4 + Math.sin(t * 0.35) * 0.05;

			renderer.render(scene, camera);
		}
		animate();

		cleanups.push(() => {
			geometry.dispose();
			material.dispose();
			dustTexture.dispose();
			glowTexture.dispose();
			renderer.dispose();
		});
	});

	onDestroy(() => {
		if (rafId) cancelAnimationFrame(rafId);
		for (const fn of cleanups) fn();
		cleanups.length = 0;
	});
</script>

<section class="shop-hero-dark" bind:this={sectionEl}>
	<canvas class="shop-hero-canvas" bind:this={canvasEl}></canvas>
	<div class="shop-hero-vignette"></div>
	<div class="shop-hero-grain"></div>
	<div class="shop-container shop-hero-dark-inner">
		<div class="shop-hero-content" bind:this={contentEl}>
			<div class="shop-hero-intro" bind:this={introEl}>
				{@render children?.()}
			</div>
		</div>
	</div>
	<div class="shop-hero-scroll-cue">Scroll</div>
</section>
