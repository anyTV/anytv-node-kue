'use strict';

module.exports = (config) => {
    return new (require('./lib/AnyTVKue').default)(config);
};
