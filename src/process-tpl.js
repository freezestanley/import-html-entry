import { getInlineCode } from './utils';
var ALL_SCRIPT_REGEX = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
var SCRIPT_TAG_REGEX = /<(script)\s+((?!type=('|')text\/ng-template\3).)*?>.*?<\/\1>/i;
var SCRIPT_SRC_REGEX = /.*\ssrc=('|")(\S+)\1.*/;
var SCRIPT_ENTRY_REGEX = /.*\sentry\s*.*/;
var LINK_TAG_REGEX = /<(link)\s+.*?>/gi;
var LINK_IGNORE_REGEX = /.*ignore\s*.*/;
var STYLE_TAG_REGEX = /<style[^>]*>[\s\S]*?<\/style>/gi;
var STYLE_TYPE_REGEX = /\s+rel=("?|'?)stylesheet\1.*/;
var STYLE_HREF_REGEX = /.*\shref=('?|"?)(\S+)\1.*/;
var STYLE_IGNORE_REGEX = /<style(\s+|\s+.+\s+)ignore(\s*|\s+.*)>/i;
var HTML_COMMENT_REGEX = /<!--([\s\S]*?)-->/g;
var SCRIPT_IGNORE_REGEX = /<script(\s+|\s+.+\s+)ignore(\s*|\s+.*)>/i;

function hasProtocol(url) {
  return url.startsWith('//') || url.startsWith('http://') || url.startsWith('https://');
}

function getBaseDomain(url) {
  return url.endsWith('/') ? url.substr(0, url.length - 1) : url;
}

export var genLinkReplaceSymbol = function genLinkReplaceSymbol(linkHref) {
  return "<!-- link ".concat(linkHref, " replaced by import-html-entry -->");
};
export var genScriptReplaceSymbol = function genScriptReplaceSymbol(scriptSrc) {
  return "<!-- script ".concat(scriptSrc, " replaced by import-html-entry -->");
};
export var inlineScriptReplaceSymbol = "<!-- inline scripts replaced by import-html-entry -->";
export var genIgnoreAssetReplaceSymbol = function genIgnoreAssetReplaceSymbol(url) {
  return "<!-- ignore asset ".concat(url || 'file', " replaced by import-html-entry -->");
};
/**
 * parse the script link from the template
 * 1. collect stylesheets
 * 2. use global eval to evaluate the inline scripts
 *    see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function#Difference_between_Function_constructor_and_function_declaration
 *    see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval#Do_not_ever_use_eval!
 * @param tpl
 * @param domain
 * @stripStyles whether to strip the css links
 * @returns {{template: void | string | *, scripts: *[], entry: *}}
 */

export default function processTpl(tpl, domain) {
  var scripts = [];
  var styles = [];
  var entry = null;
  console.log('0000000000000000000000000000000000000000000000000000000000000000000')
  var template = tpl
  /*
  remove html comment first
  */
  .replace(HTML_COMMENT_REGEX, '').replace(LINK_TAG_REGEX, function (match) {
    /*
    change the css link
    */
    var styleType = !!match.match(STYLE_TYPE_REGEX);

    if (styleType) {
      var styleHref = match.match(STYLE_HREF_REGEX);
      var styleIgnore = match.match(LINK_IGNORE_REGEX);

      if (styleHref) {
        var container = document.createElement('div')
        container.innerHTML = styleHref.input
        var href = styleHref && container.childNodes[0].href;
        var newHref = href;

        if (href && !hasProtocol(href)) {
          // 处理一下使用相对路径的场景
          newHref = getBaseDomain(domain) + (href.startsWith('/') ? href : "/".concat(href));
        }

        if (styleIgnore) {
          return genIgnoreAssetReplaceSymbol(newHref);
        }

        styles.push(newHref);
        return genLinkReplaceSymbol(newHref);
      }
    }

    return match;
  }).replace(STYLE_TAG_REGEX, function (match) {
    if (STYLE_IGNORE_REGEX.test(match)) {
      return genIgnoreAssetReplaceSymbol('style file');
    }

    return match;
  }).replace(ALL_SCRIPT_REGEX, function (match) {
    var scriptIgnore = match.match(SCRIPT_IGNORE_REGEX); // in order to keep the exec order of all javascripts
    // if it is a external script

    if (SCRIPT_TAG_REGEX.test(match)) {
      /*
      collect scripts and replace the ref
      */
      var matchedScriptEntry = match.match(SCRIPT_ENTRY_REGEX);
      var matchedScriptSrcMatch = match.match(SCRIPT_SRC_REGEX);
      var container = document.createElement('div')
      container.innerHTML = match
      var matchedScriptSrc = container.childNodes[0].src
      // var matchedScriptSrc = matchedScriptSrcMatch && matchedScriptSrcMatch[2];

      if (entry && matchedScriptEntry) {
        throw new SyntaxError('You should not set multiply entry script!');
      } else {
        // append the domain while the script not have an protocol prefix
        if (matchedScriptSrc && !hasProtocol(matchedScriptSrc)) {
          matchedScriptSrc = getBaseDomain(domain) + (matchedScriptSrc.startsWith('/') ? matchedScriptSrc : "/".concat(matchedScriptSrc));
        }

        entry = entry || matchedScriptEntry && matchedScriptSrc;
      }

      if (scriptIgnore) {
        return genIgnoreAssetReplaceSymbol(matchedScriptSrc || 'js file');
      }

      if (matchedScriptSrc) {
        scripts.push(matchedScriptSrc);
        return genScriptReplaceSymbol(matchedScriptSrc);
      }

      return match;
    } else {
      if (scriptIgnore) {
        return genIgnoreAssetReplaceSymbol('js file');
      } // if it is an inline script


      var code = getInlineCode(match); // remove script blocks when all of these lines are comments.

      var isPureCommentBlock = code.split(/[\r\n]+/).every(function (line) {
        return !line.trim() || line.trim().startsWith('//');
      });

      if (!isPureCommentBlock) {
        scripts.push(match);
      }

      return inlineScriptReplaceSymbol;
    }
  });
  scripts = scripts.filter(function (script) {
    // filter empty script
    return !!script;
  });
  const result = {
    template: template,
    scripts: scripts,
    styles: styles,
    // set the last script as entry if have not set
    entry: entry || scripts[scripts.length - 1]
  }
  return result
}