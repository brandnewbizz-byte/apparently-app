// Extends app.json. When WEB_BASE_URL is set (e.g. "/app"), the web export is
// built to live under that path on the dashboard site. Native builds ignore it.
module.exports = ({ config }) => {
  const base = process.env.WEB_BASE_URL;
  if (!base) return config;
  return { ...config, experiments: { ...(config.experiments || {}), baseUrl: base } };
};
