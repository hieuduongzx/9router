"use client";

import PropTypes from "prop-types";
import ProviderTopology from "../../activity/components/ProviderTopology";

export default function UsageProviderTopology(props) {
  return <ProviderTopology {...props} providers={props.providers.map((provider) => ({ ...provider, provider: provider.provider || provider.id }))} />;
}

UsageProviderTopology.propTypes = {
  providers: PropTypes.array,
  activeRequests: PropTypes.array,
  lastProvider: PropTypes.string,
  errorProvider: PropTypes.string,
};
