'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _kueScheduler = require('kue-scheduler');

var _kueScheduler2 = _interopRequireDefault(_kueScheduler);

var _winston = require('winston');

var _winston2 = _interopRequireDefault(_winston);

var _basicAuthConnect = require('basic-auth-connect');

var _basicAuthConnect2 = _interopRequireDefault(_basicAuthConnect);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var AnyTVKue = function () {
    function AnyTVKue(config) {
        _classCallCheck(this, AnyTVKue);

        this.baseConfig = config || {};
        this.Queue = _kueScheduler2.default;

        _lodash2.default.defaults(this, _kueScheduler2.default);
    }

    _createClass(AnyTVKue, [{
        key: 'createQueue',
        value: function createQueue() {
            var self = this;

            this.queue = _kueScheduler2.default.createQueue();

            if (this.queue.create.isCustom) {
                return this.queue;
            }

            this.queue._create = this.queue.create;

            this.queue.create = function () {
                var params = arguments[1] || {};

                if (!params.title) {
                    params.title = JSON.stringify(params);
                    arguments[1] = params;
                }

                var createResult = self.queue._create.apply(this, arguments);

                createResult._save = createResult.save;

                createResult.save = function () {
                    createResult.removeOnComplete(!!self.baseConfig.removeOnComplete);
                    createResult._save.apply(this, arguments);
                };

                return createResult;
            };

            this.queue.create.isCustom = true;

            return this.queue;
        }

        //usages:
        //  activateUI(app, username, password)(route)
        //  activateUI(app, authMiddleWare)(route)
        //  activateUI(app)(route)

    }, {
        key: 'activateUI',
        value: function activateUI(app) {
            var _arguments = arguments;

            switch (arguments.length) {
                case 1:
                    return function (route) {
                        app.use(route, _kueScheduler2.default.app);
                    };
                case 2:
                    return function (route) {
                        route = route || '/kue';

                        app.use(route, _arguments[1]);
                        app.use(route, _kueScheduler2.default.app);
                    };
                case 3:
                    return function (route) {
                        route = route || '/kue';

                        app.use(route, (0, _basicAuthConnect2.default)(_arguments[1], _arguments[2]));
                        app.use(route, _kueScheduler2.default.app);
                    };
            }
        }
    }, {
        key: 'setup',
        value: function setup(target, callbacks) {
            var _this = this;

            callbacks = callbacks || {};

            target.on('error', callbacks.error || function (err) {
                _winston2.default.log('error', 'QUEUE ERROR:', err);
            });

            target.on('job failed', callbacks.failed || function (err) {
                _winston2.default.log('error', 'FAILED JOB:', err);
            });

            process.once('SIGTERM', callbacks.sigterm || function (sig) {
                _winston2.default.log('SIGTERM', sig);
                target.shutdown(_this.baseConfig.shutdownTimer || 5000, function (err) {
                    _winston2.default.log('error', 'Kue shutdown:', err);
                    process.exit(0);
                });
            });

            var status = ['active', 'inactive'];

            //requeue all active and inactive jobs
            status.forEach(function (stat) {
                target[stat](callbacks[stat] || function (err, ids) {
                    ids.forEach(function (id) {
                        _kueScheduler2.default.Job.get(id, function (_err, job) {
                            job.inactive();
                        });
                    });
                });
            });
        }
    }, {
        key: 'cleanup',
        value: function cleanup(job_name, status) {
            _kueScheduler2.default.Job.rangeByType(job_name, status || 'complete', 0, -1, 'asc', function (err, selectedJobs) {
                if (selectedJobs && selectedJobs.length) {
                    selectedJobs.forEach(function (job) {
                        job.remove();
                    });
                }
            });
        }
    }]);

    return AnyTVKue;
}();

exports.default = AnyTVKue;