/**
 * Logs axios error details from Bunny Stream / Storage (or any axios call).
 * Safe for logs: does not print request headers (API keys).
 *
 * @param {string} label - Short context, e.g. "Stream create video"
 * @param {import('axios').AxiosError | Error} err
 */
function logBunnyApiError(label, err) {
  if (!err) return;

  const ax = err;
  const res = ax.response;
  const cfg = ax.config || res?.config;

  const payload = {
    label,
    message: ax.message,
    code: ax.code,
    status: res?.status,
    statusText: res?.statusText,
    /** Bunny often returns { Success, Message, StatusCode, ... } */
    data: res?.data,
    url: cfg?.url,
    method: cfg?.method,
  };

  console.error('[Bunny API error]', payload);
}

module.exports = { logBunnyApiError };
