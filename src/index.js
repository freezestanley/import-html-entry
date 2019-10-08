import processTpl, { genLinkReplaceSymbol } from './process-tpl';
import { getGlobalProp, getInlineCode, noteGlobalProps } from './utils';

const styleCache = {};
const scriptCache = {};
const embedHTMLCache = {};
const fetch = window.fetch.bind(window);

function getDomain(url) {
	try {
		// URL 构造函数不支持使用 // 前缀的 url
		const href = new URL(url.startsWith('//') ? `${location.protocol}${url}` : url);
		return href.origin;
	} catch (e) {
		return '';
	}
}

/**
 * convert external css link to inline style for performance optimization
 * @param template
 * @param styles
 * @return embedHTML
 */
function getEmbedHTML(template, styles) {

	let embedHTML = template;

	return getExternalStyleSheets(styles)
		.then(styleSheets => {
			embedHTML = styles.reduce((html, styleSrc, i) => {
				html = html.replace(genLinkReplaceSymbol(styleSrc), `<style>/* ${styleSrc} */${styleSheets[i]}</style>`);
				return html;
			}, embedHTML);
			return embedHTML;
		});
}

// for prefetch
function getExternalStyleSheets(styles) {
	return Promise.all(styles.map(styleLink => {
			if (styleLink.startsWith('<')) {
				// if it is inline style
				return getInlineCode(styleLink);
			} else {
				// external styles
				return styleCache[styleLink] ||
					(styleCache[styleLink] = fetch(styleLink).then(response => response.text()));
			}

		},
	));
}

// for prefetch
function getExternalScripts(scripts) {
	return Promise.all(scripts.map(script => {
			if (script.startsWith('<')) {
				// if it is inline script
				return getInlineCode(script);
			} else {
				// external script
				return scriptCache[script] ||
					(scriptCache[script] = fetch(script).then(response => response.text()));
			}
		},
	));
}

function execScripts(entry, scripts, proxy = window) {

	return getExternalScripts(scripts)
		.then(scriptsText => {

			function exec(scriptSrc, inlineScript, resolve) {

				const markName = `Evaluating script ${scriptSrc}`;
				const measureName = `Evaluating Time Consuming: ${scriptSrc}`;

				if (process.env.NODE_ENV === 'development') {
					performance.mark(markName);
				}

				const fn = new Function('window', inlineScript).bind(proxy);
				if (scriptSrc === entry) {
					noteGlobalProps();

					try {
						// bind window.proxy to change `this` reference in script
						fn(proxy)
					} catch (e) {
						console.error(`error occurs while executing the entry ${scriptSrc}`);
						throw e;
					}

					const exports = proxy[getGlobalProp()] || {};
					resolve(exports);

				} else {
					try {
						// bind window.proxy to change `this` reference in script
						fn(proxy)
					} catch (e) {
						console.error(`error occurs while executing ${scriptSrc}`);
						throw e;
					}

				}

				if (process.env.NODE_ENV === 'development') {
					performance.measure(measureName, markName);
					performance.clearMarks(markName);
					performance.clearMeasures(measureName);
				}
			}

			function schedule(i, resolvePromise) {

				if (i < scripts.length) {
					const scriptSrc = scripts[i];
					const inlineScript = scriptsText[i];

					exec(scriptSrc, inlineScript, resolvePromise);
					schedule(i + 1, resolvePromise);
				}
			}

			return new Promise(resolve => schedule(0, resolve));
		});
}

export default function importHTML(url) {

	return embedHTMLCache[url] || (embedHTMLCache[url] = fetch(url)
		.then(response => response.text())
		.then(html => {

			const { template, scripts, entry, styles } = processTpl(html, getDomain(url));

			return getEmbedHTML(template, styles).then(embedHTML => ({
				template: embedHTML,
				getExternalScripts: () => getExternalScripts(scripts),
				getExternalStyleSheets: () => getExternalStyleSheets(styles),
				execScripts: proxy => execScripts(entry, scripts, proxy),
			}));
		}));
};

export function importEntry(entry) {

	if (!entry) {
		throw new SyntaxError('entry should not be empty!');
	}

	// html entry
	if (typeof entry === 'string') {
		return importHTML(entry);
	}

	// config entry
	if (Array.isArray(entry.scripts) || Array.isArray(entry.styles)) {

		const { scripts = [], styles = [], html = '' } = entry;

		return getEmbedHTML(html, styles).then(embedHTML => ({
			template: embedHTML,
			getExternalScripts: () => getExternalScripts(scripts),
			getExternalStyleSheets: () => getExternalStyleSheets(styles),
			execScripts: proxy => execScripts(scripts[scripts.length - 1], scripts, proxy),
		}));

	} else {
		throw new SyntaxError('entry scripts or styles should be array!');
	}
}
