/**
 * Adapted from windingwind/zotero-plugin-template, AGPL-3.0-or-later.
 * Upstream notice retained: most bootstrap patterns originate in Zotero's
 * Make It Red example or Zotero 7 developer documentation.
 * https://github.com/zotero/make-it-red
 * https://www.zotero.org/support/dev/zotero_7_for_developers
 * Local resources use rootURI; chrome registration is not needed here.
 */
var rainbowContext;
var rainbowGeneration = 0;
function install(data, reason) {}
async function startup({ rootURI }, reason) {
  const generation = ++rainbowGeneration;
  const timerApi = ChromeUtils.importESModule("resource://gre/modules/Timer.sys.mjs");
  const ctx = { Zotero, timerApi };
  ctx._globalThis = ctx;
  rainbowContext = ctx;
  try {
    Services.scriptloader.loadSubScript(rootURI + "content/scripts/rainbowbionic.js", ctx);
    Zotero.RainbowBionic = ctx.RainbowBionic;
    await ctx.RainbowBionic.startup();
    if (generation !== rainbowGeneration) ctx.RainbowBionic.shutdown();
  } catch (error) {
    ctx.RainbowBionic?.shutdown();
    if (Zotero.RainbowBionic === ctx.RainbowBionic) delete Zotero.RainbowBionic;
    if (rainbowContext === ctx) rainbowContext = undefined;
    Zotero.logError(error);
  }
}
function onMainWindowLoad({ window }, reason) { rainbowContext?.RainbowBionic?.refresh(); }
function onMainWindowUnload({ window }, reason) { rainbowContext?.RainbowBionic?.refresh(); }
function shutdown(data, reason) {
  ++rainbowGeneration;
  const addon = rainbowContext?.RainbowBionic;
  addon?.shutdown();
  if (Zotero.RainbowBionic === addon) delete Zotero.RainbowBionic;
  rainbowContext = undefined;
}
function uninstall(data, reason) {}
