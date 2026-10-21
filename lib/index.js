/**
 * Host half of dsh-deepsea-echo.
 *
 * This is a pure browser-UI plugin: the whole startup sequence lives in
 * `lib/client.js` and is discovered through package.json's `dsh.client`
 * declaration. The empty `apply` exists only so the package has a Loader entry
 * on the host side, which is what puts the plugin in the profile and lets the
 * client-module system publish its browser bundle.
 */

/** Host plugin body — no host-side behaviour for this surface plugin. */
function apply() {}

export { apply };
