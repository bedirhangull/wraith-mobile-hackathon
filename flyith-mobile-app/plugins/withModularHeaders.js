const { withPodfile } = require("@expo/config-plugins");

/**
 * @react-native-google-signin/google-signin pulls in Firebase's AppCheckCore,
 * which depends on GoogleUtilities/RecaptchaInterop — Swift pods that fail to
 * link as static libraries unless `use_modular_headers!` is set. `ios/` is
 * regenerated on every `expo prebuild`, so this has to be a config plugin
 * rather than a one-off Podfile edit.
 */
function withModularHeaders(config) {
  return withPodfile(config, (config) => {
    if (!config.modResults.contents.includes("use_modular_headers!")) {
      config.modResults.contents = config.modResults.contents.replace(
        /(platform :ios,[^\n]*\n)/,
        `$1use_modular_headers!\n`
      );
    }
    return config;
  });
}

module.exports = withModularHeaders;
