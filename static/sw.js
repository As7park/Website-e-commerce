self.addEventListener('install', () => {
	//console.log('Service Worker installé.');
});

self.addEventListener('fetch', () => {
	//console.log('Requête interceptée :', event.request.url);
	// Vous pouvez ajouter des logiques de mise en cache ou d'autres comportements ici.
});
