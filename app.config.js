// Extends app.json with settings that come from environment variables.
//
// WEB_BASE_URL (e.g. "/app"): the web export is built to live under that path
// on the dashboard site. Native builds ignore it.
//
// GOOGLE_SERVICES_JSON: the Firebase config file for Android push
// notifications, uploaded on expo.dev → Environment variables as a "File"
// variable (so it isn't kept in this repo). Without it the build still works,
// but Android phones can't receive push notifications.
module.exports = ({ config }) => {
  let out = config;
  const base = process.env.WEB_BASE_URL;
  if (base) out = { ...out, experiments: { ...(out.experiments || {}), baseUrl: base } };
  const gsf = process.env.GOOGLE_SERVICES_JSON;
  if (gsf) out = { ...out, android: { ...out.android, googleServicesFile: gsf } };
  return out;
};
