const SITE_PAGES_ENDPOINT = '/__horizons/site-pages';

const OUTGOING_SITE_PAGES_MESSAGE = 'sitePages';
const INCOMING_REQUEST_SITE_PAGES_MESSAGE = 'request-site-pages';

const ALLOWED_PARENT_ORIGINS = [
	'https://horizons.hostinger.com',
	'https://horizons.hostinger.dev',
	'https://horizons-frontend-local.hostinger.dev',
	'http://localhost:4000',
];

function postSitePages(pages) {
	let parentOrigin = window.location.ancestorOrigins?.[0];
	if (!parentOrigin && document.referrer) {
		try {
			parentOrigin = new URL(document.referrer).origin;
		} catch {}
	}
	if (parentOrigin && ALLOWED_PARENT_ORIGINS.includes(parentOrigin)) {
		window.parent.postMessage({ type: OUTGOING_SITE_PAGES_MESSAGE, payload: { pages } }, parentOrigin);
	}
}

async function sendSitePagesToParent() {
	if (window.self === window.top) {
		return;
	}

	try {
		const response = await fetch(SITE_PAGES_ENDPOINT);
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}
		postSitePages(await response.json());
	} catch (error) {
		console.error('[site-pages] Failed to send site pages to parent:', error);
	}
}

if (window.self !== window.top) {
	window.addEventListener('load', sendSitePagesToParent);
	window.addEventListener('message', (event) => {
		if (event.data?.type === INCOMING_REQUEST_SITE_PAGES_MESSAGE) {
			sendSitePagesToParent();
		}
	});
}
