const rewire = require("babel-plugin-rewire");

// babel-plugin-rewire 1.2 uses the Babel 7 name for the template placeholder option.
module.exports = ({ types, template }) =>
  rewire({
    types,
    template(source, options) {
      if (!options || !Object.hasOwn(options, "placeholderWhitelist")) return template(source, options);
      const { placeholderWhitelist, ...rest } = options;
      return template(source, { ...rest, placeholderAllowlist: placeholderWhitelist });
    },
  });
