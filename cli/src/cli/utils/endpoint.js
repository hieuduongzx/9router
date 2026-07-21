
/**
 * Get the self-hosted endpoint URL.
 * @param {number} port - Local server port
 * @returns {Promise<{endpoint: string}>}
 */
async function getEndpoint(port) {
  return { endpoint: `http://localhost:${port}/v1` };
}

module.exports = { getEndpoint };
