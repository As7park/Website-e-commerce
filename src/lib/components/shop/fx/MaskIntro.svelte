<script lang="ts">
	/* =========================================================
	   INTRO « À TRAVERS LE MASQUE » — plan-séquence au scroll.
	   On arrive derrière le verre d'un masque protégé par son
	   film (tear-off) : le scroll tire la languette, le film se
	   retire, on plonge à travers le verre, puis l'image se
	   désagrège sur les trois bandes qui l'attendent dessous.
	   Tout le rendu tient dans un fragment shader WebGL2 ; sans
	   WebGL2, la photo s'affiche simplement.
	   ========================================================= */
	import { onMount } from 'svelte';
	import { gsap, ScrollTrigger, onWindow, prefersReducedMotion } from '#lib/shop/fx';
	import { DISSOLVE, MASK_RUN } from '#lib/shop/intro';

	let {
		photo,
		photoAlt,
		caption = 'À travers le masque',
		line = 'Enjoy the win',
		hud = ['Air-Flex', 'Scroll'],
		onskip
	}: {
		/** Photo vue à travers le verre (paysage, 3:2 conseillé). */
		photo: string;
		photoAlt: string;
		caption?: string;
		/** Ligne géante qui traverse l'écran une fois dans l'image. */
		line?: string;
		hud?: [string, string];
		onskip?: () => void;
	} = $props();

	const LENS =
		'M60 44Q500-36 940 44C985 52 994 96 992 150C988 270 972 380 948 462C930 530 866 556 800 556C690 556 626 446 500 446C374 446 310 556 200 556C134 556 70 530 52 462C28 380 12 270 8 150C6 96 15 52 60 44Z';
	const IMG_W = 2400;
	const IMG_H = 1600;
	const FOCUS = [0.57 * IMG_W, 0.5 * IMG_H];
	const LENS_C = [500, 280];
	const DIVE_C = [500, 205];
	const PAD = 170;
	const RANGE = 170;
	const TEX_W = 1024;
	const TEX_H = Math.round((TEX_W * (560 + PAD * 2)) / (1000 + PAD * 2));

	let runEl: HTMLDivElement;
	let stageEl: HTMLDivElement;
	let canvasEl: HTMLCanvasElement;
	let lineEl: HTMLParagraphElement;
	let capEl: HTMLParagraphElement;
	let hudEl: HTMLDivElement;
	let wmEl: HTMLImageElement;

	const VS = `#version 300 es
	in vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;

	const FS = `#version 300 es
	precision highp float;
	uniform sampler2D uPhoto, uSdf;
	uniform vec2 uRes, uImg, uAnchor, uScreen, uFocus, uPC;
	uniform float uZ, uPS, uClear, uPull, uDive, uBlur, uFade, uDpr, uPad, uRange;
	out vec4 o;

	float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
	float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
		return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
	float fbm(vec2 p){ float a=.5,v=0.; for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.03+7.1; a*=.5; } return v; }

	float sdf(vec2 l){
		vec2 uv = (l+vec2(uPad))/vec2(1000.+2.*uPad,560.+2.*uPad);
		if(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.) return -uRange;
		return (texture(uSdf,uv).r-.5)*2.*uRange;
	}
	vec2 imgUv(vec2 px){ return (uFocus+(px-uPC)/uPS)/uImg; }
	vec3 sharp(vec2 px){ return texture(uPhoto,imgUv(px)).rgb; }

	void main(){
		vec2 px = vec2(gl_FragCoord.x, uRes.y*uDpr-gl_FragCoord.y)/uDpr;
		vec2 l = (px-uScreen)/uZ+uAnchor;
		float d = sdf(l);
		float inLens = smoothstep(-1.1/uZ,1.1/uZ,d);

		float e = 5.;
		vec2 n = vec2(sdf(l+vec2(e,0.))-sdf(l-vec2(e,0.)), sdf(l+vec2(0.,e))-sdf(l-vec2(0.,e)));
		n = n/(length(n)+1e-4);

		/* Réfraction : le verre courbe l'image sur ses bords. */
		float t = clamp(d/110.,0.,1.);
		float bend = pow(1.-t,2.6);
		vec2 off = -n*bend*62.*uZ;
		vec2 c = uRes*.5;
		vec2 rad = px-c;

		/* Plongée : flou radial et aberration, proportionnels à la vitesse. */
		vec3 col = vec3(0.);
		float ca = .55+uBlur*5.;
		for(int i=0;i<6;i++){
			float k = float(i)/5.;
			vec2 q = px+off-rad*k*uBlur*.075;
			col.r += sharp(q+off*.05+rad*.0011*ca).r;
			col.g += sharp(q).g;
			col.b += sharp(q-off*.05-rad*.0011*ca).b;
		}
		col /= 6.;

		/* Membrane : le film suit la traction, son front pivote pendant qu'il part. */
		float ang = mix(-.38,.2,uClear);
		vec2 dir = vec2(cos(ang),sin(ang)), nor = vec2(-dir.y,dir.x);
		vec2 q = l-vec2(500.,280.);
		float sp = dot(q,dir), tp = dot(q,nor);
		float R = mix(8.,21.,uClear);
		float s = sp+tp*tp*.00036-mix(-720.,780.,uClear);

		/* Verre dépoli : le dépoli appartient au film, il glisse légèrement avec lui. */
		vec2 uv = imgUv(px+off+dir*uClear*34.*uZ);
		vec3 soft = textureLod(uPhoto,uv,3.6).rgb;
		float lum = dot(soft,vec3(.3,.59,.11));
		vec3 frost = mix(soft,vec3(lum)*vec3(1.03,.98,.9),.5);
		frost = frost*.74+.09+(fbm(l*.0034+3.)-.5)*.1;

		/* Tension : fines nervures à l'approche du front et autour de la languette. */
		float rid = noise(vec2(tp*.03+sp*.004,sp*.0016-uClear*1.6));
		rid = pow(1.-abs(rid*2.-1.),7.);
		float near = exp(-max(s,0.)/230.)*step(.0005,uClear);
		vec2 tv = l-vec2(0.,150.);
		float crease = uPull*(1.-uClear)*exp(-length(tv)/240.);
		vec3 film = frost+vec3(.96,.98,1.)*rid*(.035+.15*near+.1*crease);
		film *= 1.-.26*exp(-max(s-R,0.)/24.)*step(.0005,uClear);

		/* Verre nu : un reste de buée s'évapore derrière le film, puis l'ombre du rouleau. */
		vec3 bare = mix(col,frost,.2*smoothstep(-260.,-R,s));
		bare *= 1.-.62*exp(min(s+R,0.)/30.);

		vec3 lens = mix(bare,film,smoothstep(-1.2/uZ,1.2/uZ,s));

		/* Rouleau : cylindre transparent, reflets et bord épaissi par la lumière rasante. */
		float tt = clamp(s/R,-1.,1.);
		float h = sqrt(max(1.-tt*tt,0.));
		vec3 nr = vec3(dir*tt,h);
		float roll = 1.-smoothstep(.95,1.,abs(s/R));
		vec3 through = sharp(px+off+dir*tt*R*uZ*1.5);
		vec3 rc = mix(through,vec3(.93,.95,.97),.14+.3*(1.-h));
		rc += pow(max(dot(nr,normalize(vec3(-.35,-.7,.62))),0.),46.)*.95;
		rc += pow(max(dot(nr,normalize(vec3(.6,.35,.7))),0.),14.)*.2;
		lens = mix(lens,rc,roll);

		/* Matière du verre : ombre interne, liseré de lumière, reflet très léger. */
		lens *= mix(.32,1.,smoothstep(0.,90.,d));
		float lit = max(dot(n,normalize(vec2(.42,.9))),0.);
		float rim = (1.-smoothstep(.8,4.5/min(uZ,1.6),d))*lit;
		float sheen = smoothstep(.2,.95,sin(dot(l,vec2(.0048,.0031))+1.1+uClear*1.9));
		lens += vec3(.9,.95,1.)*sheen*.045*(1.-uDive);
		lens += rim*.75*(1.-uDive);

		vec3 rgb = lens*inLens;

		/* Hors du verre : les bords du film dépassent, et la languette de traction. */
		float ribbon = roll*smoothstep(-54.,-6.,d)*(1.-inLens)*step(.001,uClear)*step(uClear,.999);
		rgb += rc*ribbon*.85;
		vec2 tb = abs(l-vec2(-4.-uPull*20.,150.))-vec2(13.,20.);
		float bx = length(max(tb,0.))+min(max(tb.x,tb.y),0.)-5.;
		float tabA = (1.-smoothstep(-1.1/uZ,1.1/uZ,bx))*(1.-inLens)*(1.-smoothstep(0.,.05,uClear));
		float tabRim = 1.-smoothstep(0.,1.8,abs(bx+1.));
		rgb = mix(rgb,vec3(.8,.82,.84)*(.24+.14*smoothstep(-28.,20.,tv.y))+vec3(.9)*tabRim*.5,tabA);

		/* Grain argentique, identique dans le verre et dans la photo plein cadre. */
		rgb += (hash(px+13.7)-.5)*.035*inLens;

		/* Désagrégation : les pixels clairs tiennent le plus longtemps. */
		float g = fbm(px*.0052)*.62+hash(floor(px/1.6))*.3+dot(rgb,vec3(.33))*.16;
		float th = uFade*1.25-.12;
		float a = smoothstep(th-.02,th+.04,g);
		float ember = smoothstep(th-.02,th,g)*(1.-smoothstep(th,th+.05,g))*step(.001,uFade);
		rgb = mix(rgb,vec3(1.),ember*.55);
		if(uFade>=.999) a=0.;
		o = vec4(rgb*a,a);
	}`;

	function shader(gl: WebGL2RenderingContext, type: number, src: string) {
		const s = gl.createShader(type)!;
		gl.shaderSource(s, src);
		gl.compileShader(s);
		if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? '');
		return s;
	}

	/* Distance signée du verre : le bord reste net à n'importe quel zoom. */
	function buildSdf(): Uint8Array {
		const c = document.createElement('canvas');
		c.width = TEX_W;
		c.height = TEX_H;
		const x = c.getContext('2d', { willReadFrequently: true })!;
		const k = TEX_W / (1000 + PAD * 2);
		x.setTransform(k, 0, 0, k, PAD * k, PAD * k);
		x.fillStyle = '#fff';
		x.fill(new Path2D(LENS));
		const src = x.getImageData(0, 0, TEX_W, TEX_H).data;
		const edt = (inside: boolean) => {
			const INF = 1e12,
				g = new Float64Array(TEX_W * TEX_H);
			for (let i = 0; i < g.length; i++) g[i] = src[i * 4] > 127 === inside ? 0 : INF;
			const n = Math.max(TEX_W, TEX_H),
				f = new Float64Array(n),
				v = new Int32Array(n),
				z = new Float64Array(n + 1),
				r = new Float64Array(n);
			const pass = (len: number) => {
				let q = 0;
				v[0] = 0;
				z[0] = -INF;
				z[1] = INF;
				for (let i = 1; i < len; i++) {
					let s: number;
					do {
						const j = v[q];
						s = (f[i] + i * i - f[j] - j * j) / (2 * i - 2 * j);
					} while (s <= z[q] && --q > -1);
					q++;
					v[q] = i;
					z[q] = s;
					z[q + 1] = INF;
				}
				q = 0;
				for (let i = 0; i < len; i++) {
					while (z[q + 1] < i) q++;
					const j = v[q];
					r[i] = (i - j) ** 2 + f[j];
				}
			};
			for (let x0 = 0; x0 < TEX_W; x0++) {
				for (let y = 0; y < TEX_H; y++) f[y] = g[y * TEX_W + x0];
				pass(TEX_H);
				for (let y = 0; y < TEX_H; y++) g[y * TEX_W + x0] = r[y];
			}
			for (let y = 0; y < TEX_H; y++) {
				for (let x0 = 0; x0 < TEX_W; x0++) f[x0] = g[y * TEX_W + x0];
				pass(TEX_W);
				for (let x0 = 0; x0 < TEX_W; x0++) g[y * TEX_W + x0] = r[x0];
			}
			return g;
		};
		const outD = edt(true),
			inD = edt(false),
			out = new Uint8Array(TEX_W * TEX_H);
		for (let i = 0; i < out.length; i++) {
			const sd = (Math.sqrt(inD[i]) - Math.sqrt(outD[i])) / k;
			out[i] = Math.max(0, Math.min(255, (sd / RANGE / 2 + 0.5) * 255));
		}
		return out;
	}

	onMount(() => {
		const reduce = prefersReducedMotion();
		// Le CSS masque déjà l'intro quand les animations sont réduites.
		if (reduce) return;
		let gl: WebGL2RenderingContext | null = null;
		try {
			gl = canvasEl.getContext('webgl2', {
				alpha: true,
				premultipliedAlpha: true,
				antialias: false,
				powerPreference: 'high-performance'
			});
		} catch {
			gl = null;
		}
		if (!gl) stageEl.classList.add('no-gl');

		const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
		const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
		const io = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

		const state = { p: 0, r: 0 };
		let vw = 1,
			vh = 1,
			dpr = 1,
			z0 = 1,
			z1 = 3,
			ready = false,
			dirty = true;
		const u: Record<string, WebGLUniformLocation | null> = {};
		let mx = 0,
			my = 0,
			tx = 0,
			ty = 0;

		function resize() {
			vw = stageEl.clientWidth;
			vh = stageEl.clientHeight;
			dpr = Math.min(window.devicePixelRatio || 1, 1.5);
			z0 = Math.min(Math.max(vw * 0.66, Math.min(vw * 0.92, 620)) / 1000, (vh * 0.62) / 560);
			z1 = Math.max(vw / 2 / 430, vh / 2 / 170) * 1.3;
			if (gl) {
				canvasEl.width = vw * dpr;
				canvasEl.height = vh * dpr;
				gl.viewport(0, 0, canvasEl.width, canvasEl.height);
			}
			dirty = true;
		}

		function draw() {
			const { p, r } = state;
			const seg = (a: number, b: number) => clamp((p - a) / (b - a));
			const pull = io(seg(0.03, 0.15));
			const ct = seg(0.13, 0.44);
			const clear = ct * ct * (1.5 - 0.5 * ct);
			const dive = io(seg(0.47, 0.8));
			const blur = Math.sin(Math.PI * seg(0.47, 0.8)) ** 2;
			const z = z0 * (z1 / z0) ** dive;
			const ax = lerp(LENS_C[0], DIVE_C[0], dive),
				ay = lerp(LENS_C[1], DIVE_C[1], dive);
			const sx = vw / 2 + mx * 26 * (1 - dive),
				sy = lerp(0.46, 0.5, dive) * vh + my * 16 * (1 - dive);

			const inside = seg(0.8, 1);
			const cover = Math.max(vw / IMG_W, vh / IMG_H) * 1.26;
			const follow =
				Math.max((920 * z) / IMG_W, (560 * z) / IMG_H) * 1.42 * lerp(1, 1.07, seg(0, 0.47));
			const ps = Math.min(follow, cover) * (1 + 0.09 * inside) * (1 + 0.08 * r);
			const pcx = vw / 2 - mx * 34 * (1 - dive * 0.6),
				pcy = lerp(sy + (LENS_C[1] - ay) * z, vh * 0.5, dive) - my * 20 - inside * vh * 0.03;

			if (gl && ready) {
				gl.uniform2f(u.uRes, vw, vh);
				gl.uniform1f(u.uDpr, dpr);
				gl.uniform2f(u.uAnchor, ax, ay);
				gl.uniform2f(u.uScreen, sx, sy);
				gl.uniform1f(u.uZ, z);
				gl.uniform2f(u.uPC, pcx, pcy);
				gl.uniform1f(u.uPS, ps);
				gl.uniform1f(u.uClear, clear);
				gl.uniform1f(u.uPull, pull);
				gl.uniform1f(u.uDive, dive);
				gl.uniform1f(u.uBlur, blur);
				gl.uniform1f(u.uFade, r);
				gl.clearColor(0, 0, 0, 0);
				gl.clear(gl.COLOR_BUFFER_BIT);
				gl.drawArrays(gl.TRIANGLES, 0, 3);
			}
			stageEl.style.setProperty('--gl-fade', String(1 - r));
			stageEl.style.visibility = r >= 1 ? 'hidden' : 'visible';

			capEl.style.opacity = String(1 - seg(0.05, 0.14));
			capEl.style.transform = `translate3d(0,${(-seg(0.05, 0.14) * 30).toFixed(1)}px,0)`;
			hudEl.style.opacity = String(1 - seg(0.42, 0.5));
			wmEl.style.opacity = String(1 - seg(0.42, 0.5));

			/* La ligne géante traverse l'écran pendant qu'on est dans l'image. */
			lineEl.style.opacity = String(seg(0.8, 0.86) * (1 - clamp(r * 3)));
			lineEl.style.transform = `translate3d(${lerp(2.5, -1, inside).toFixed(2)}%,${((1 - seg(0.8, 0.86)) * 26).toFixed(1)}px,0)`;
		}

		let photoTex: WebGLTexture | null = null;
		let sdfTex: WebGLTexture | null = null;
		let prog: WebGLProgram | null = null;
		let buf: WebGLBuffer | null = null;
		const img = new Image();
		if (gl) {
			const g = gl;
			prog = g.createProgram()!;
			g.attachShader(prog, shader(g, g.VERTEX_SHADER, VS));
			g.attachShader(prog, shader(g, g.FRAGMENT_SHADER, FS));
			g.linkProgram(prog);
			g.useProgram(prog);
			buf = g.createBuffer();
			g.bindBuffer(g.ARRAY_BUFFER, buf);
			g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
			const loc = g.getAttribLocation(prog, 'p');
			g.enableVertexAttribArray(loc);
			g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
			for (const n of [
				'uPhoto',
				'uSdf',
				'uRes',
				'uImg',
				'uAnchor',
				'uScreen',
				'uFocus',
				'uPC',
				'uZ',
				'uPS',
				'uClear',
				'uPull',
				'uDive',
				'uBlur',
				'uFade',
				'uDpr',
				'uPad',
				'uRange'
			])
				u[n] = g.getUniformLocation(prog, n);
			g.uniform2f(u.uImg, IMG_W, IMG_H);
			g.uniform2f(u.uFocus, FOCUS[0], FOCUS[1]);
			g.uniform1f(u.uPad, PAD);
			g.uniform1f(u.uRange, RANGE);

			sdfTex = g.createTexture();
			g.activeTexture(g.TEXTURE1);
			g.bindTexture(g.TEXTURE_2D, sdfTex);
			g.pixelStorei(g.UNPACK_ALIGNMENT, 1);
			g.texImage2D(g.TEXTURE_2D, 0, g.R8, TEX_W, TEX_H, 0, g.RED, g.UNSIGNED_BYTE, buildSdf());
			g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
			g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
			g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
			g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
			g.uniform1i(u.uSdf, 1);

			img.onload = () => {
				photoTex = g.createTexture();
				g.activeTexture(g.TEXTURE0);
				g.bindTexture(g.TEXTURE_2D, photoTex);
				g.texImage2D(g.TEXTURE_2D, 0, g.RGBA8, g.RGBA, g.UNSIGNED_BYTE, img);
				g.generateMipmap(g.TEXTURE_2D);
				g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR_MIPMAP_LINEAR);
				g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
				g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.MIRRORED_REPEAT);
				g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.MIRRORED_REPEAT);
				g.uniform1i(u.uPhoto, 0);
				ready = true;
				dirty = true;
			};
			img.src = photo;
		}

		resize();
		const ro = new ResizeObserver(resize);
		ro.observe(stageEl);

		const onMove = (e: MouseEvent) => {
			tx = e.clientX / innerWidth - 0.5;
			ty = e.clientY / innerHeight - 0.5;
		};
		addEventListener('mousemove', onMove);

		let raf = 0,
			visible = true;
		const vis = new IntersectionObserver((es) => {
			visible = es[0].isIntersecting;
		});
		vis.observe(stageEl);
		const loop = () => {
			raf = requestAnimationFrame(loop);
			if (!visible) return;
			const dx = tx - mx,
				dy = ty - my;
			if (Math.abs(dx) + Math.abs(dy) > 0.0005) {
				mx += dx * 0.06;
				my += dy * 0.06;
				dirty = true;
			}
			if (dirty) {
				draw();
				dirty = false;
			}
		};
		raf = requestAnimationFrame(loop);

		const mark = () => {
			dirty = true;
		};
		/* Plan-séquence, puis dissolution sur les bandes pendant DISSOLVE vh. */
		const D = () => (stageEl.clientHeight * DISSOLVE) / 100;
		const seq = () => runEl.offsetHeight - stageEl.clientHeight - D();
		const tw1 = gsap.to(state, {
			p: 1,
			ease: 'none',
			onUpdate: mark,
			scrollTrigger: onWindow({
				trigger: runEl,
				start: 'top top',
				end: () => '+=' + seq(),
				scrub: 0.6,
				invalidateOnRefresh: true
			})
		});
		const tw2 = gsap.to(state, {
			r: 1,
			ease: 'none',
			onUpdate: mark,
			scrollTrigger: onWindow({
				trigger: runEl,
				start: () => 'top+=' + seq() + ' top',
				end: () => '+=' + D(),
				scrub: 0.6,
				invalidateOnRefresh: true
			})
		});
		const refresh = () => ScrollTrigger.refresh();
		addEventListener('load', refresh);
		document.fonts?.ready.then(refresh);

		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
			vis.disconnect();
			removeEventListener('mousemove', onMove);
			removeEventListener('load', refresh);
			img.onload = null;
			tw1.scrollTrigger?.kill();
			tw2.scrollTrigger?.kill();
			tw1.kill();
			tw2.kill();
			if (gl) {
				gl.deleteTexture(photoTex);
				gl.deleteTexture(sdfTex);
				gl.deleteBuffer(buf);
				gl.deleteProgram(prog);
				gl.getExtension('WEBGL_lose_context')?.loseContext();
			}
		};
	});
</script>

<div class="shop-mask-intro" style={`height:${MASK_RUN}vh`} bind:this={runEl}>
	<div class="stage" bind:this={stageEl}>
		<img class="fallback" src={photo} alt={photoAlt} />
		<canvas bind:this={canvasEl} aria-hidden="true"></canvas>
		<img class="wm" bind:this={wmEl} src="/brand/wordmark-white.svg" alt="AS7 Park" />
		<div class="hud" bind:this={hudEl}>
			<span aria-hidden="true">{hud[0]}</span>
			{#if onskip}
				<button type="button" class="skip" onclick={onskip}>Passer l’intro</button>
			{:else}
				<span aria-hidden="true">{hud[1]}</span>
			{/if}
		</div>
		<p class="cap" bind:this={capEl}>{caption}</p>
		<p class="line" bind:this={lineEl} aria-hidden="true">{line}</p>
	</div>
</div>

<style>
	.shop-mask-intro {
		position: relative;
		z-index: 3;
		pointer-events: none;
	}
	.stage {
		position: sticky;
		top: 0;
		height: 100vh;
		overflow: hidden;
		background: transparent;
	}
	canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
	}
	.fallback {
		display: none;
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		max-width: none;
		object-fit: cover;
		opacity: var(--gl-fade, 1);
	}
	:global(.stage.no-gl) .fallback {
		display: block;
	}
	:global(.stage.no-gl) canvas {
		display: none;
	}
	.wm {
		position: absolute;
		left: clamp(16px, 3vw, 44px);
		top: clamp(18px, 3.4vh, 36px);
		width: 132px;
		height: auto;
	}
	.hud {
		position: absolute;
		right: clamp(16px, 3vw, 44px);
		top: clamp(20px, 3.6vh, 38px);
		display: flex;
		align-items: center;
		gap: 2.2rem;
		font: 400 0.95rem/1 var(--shop-font-label);
		letter-spacing: 0.18em;
		color: rgba(255, 255, 255, 0.62);
		text-transform: uppercase;
	}
	.skip {
		pointer-events: auto;
		padding: 0.55rem 0.9rem;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 999px;
		font: inherit;
		letter-spacing: inherit;
		text-transform: inherit;
		color: #fff;
		background: rgba(0, 0, 0, 0.25);
		cursor: pointer;
		transition:
			background 0.2s,
			border-color 0.2s;
	}
	.skip:hover,
	.skip:focus-visible {
		background: rgba(0, 0, 0, 0.55);
		border-color: #fff;
	}
	.cap {
		position: absolute;
		left: clamp(16px, 3vw, 44px);
		bottom: clamp(20px, 4.4vh, 44px);
		margin: 0;
		font: 400 clamp(1.5rem, 2.4vw, 2.6rem) / 1 var(--shop-font-display);
		text-transform: uppercase;
		letter-spacing: 0.01em;
		color: #fff;
	}
	.line {
		position: absolute;
		left: clamp(16px, 3vw, 44px);
		bottom: clamp(14px, 3.4vh, 34px);
		margin: 0;
		white-space: nowrap;
		font: 400 min(16.4vw, 42vh) / 0.86 var(--shop-font-display);
		text-transform: uppercase;
		color: #fff;
		opacity: 0;
		will-change: transform, opacity;
	}
	@media (max-width: 520px) {
		.hud > span {
			display: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.shop-mask-intro {
			display: none;
		}
	}
</style>
