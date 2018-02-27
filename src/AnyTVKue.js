'use strict';

import _ from 'lodash';
import winston from 'winston';
import baseConfig from './config';
import kue from 'kue-scheduler';
import basic_auth from 'basic-auth-connect';

/**
 * AnyTVKue class injects additional helper functions on kue-scheduler
 * @example
 * const kue = require('anytv-kue')(config.app.KUE);
 * const Queue = kue.createQueue(config.app.KUE_OPTIONS);
 * kue.setup(Queue); // adds error listeners and requeue previous jobs
 */
class AnyTVKue {

    /**
     * Creates an instance of AnyTVKue class
     * @param {object} [config] Config object that setups the Queue object
     */
    constructor(config) {
        _.merge(baseConfig, config || {});
        _.defaults(this, kue);
    }

    /**
     * Creates a Queue object with specific options
     * @param {object} [options] Options to be passed to Queue object
     * @return {object} Queue instance
     */
    createQueue(options) {
        const self = this;
        options = options || {};

        this.queue = kue.createQueue(options);

        if (this.queue.create.isCustom) {
            return this.queue;
        }

        this.queue._create = this.queue.create;

        this.queue.create = function () {
            const params = arguments[1] || {};

            if (!params.title) {
                params.title = JSON.stringify(params);
                arguments[1] = params;
            }
            const createResult = self.queue._create.apply(this, arguments);

            createResult._save = createResult.save;

            createResult.save = function () {
                const remove_on_complete = 'remove_on_complete' in options
                    ? options.remove_on_complete
                    : baseConfig.remove_on_complete;
                createResult.removeOnComplete(remove_on_complete);
                createResult._save.apply(this, arguments);
            };

            return createResult;
        };

        this.queue.create.isCustom = true;

        /**
         * Patch created job's backoff function to support custom backoff types
         */
        let _createJob = this.queue.createJob;

        this.queue.createJob = function (name, payload) {

            let job = _createJob.call(this, name, payload);

            job.backoff = function (backoff_type) {

                // default implementation is a getter when no arguments passed
                // added for backwards compatibility
                if (arguments.length === 0) {
                    return job._backoff;
                }

                let backoff;
                switch (backoff_type) {

                    /**
                     * Custom callback functions
                     * Executed by eval() so cannot contain variables i.e. can't use config
                     * https://github.com/Automattic/kue#failure-backoff
                     */

                    // 2 mins, 4 mins, 8m mins...
                    case 'fixed_doubling':
                        backoff = attempts => Math.pow(2, attempts) * 1000 * 60;
                        break;

                    // custom exponential based on initial delay
                    // starts at 2 seconds when there's no initial delay
                    case 'delay_doubling':
                        backoff = `(attempts, delay) => delay ? delay * 2 : ${baseConfig.default_delay};`;
                        break;

                    default:
                        backoff = backoff_type;
                        break;
                }

                job._backoff = backoff;
                return job;
            };

            return job;
        };

        return this.queue;
    }

    /**
     * Creates a function that can be used for activating KUE UI app
     * @param {object} app Express server
     * @returns {function} function
     * @example
     * activateUI(app, username, password)(route)
     * @example
     * activateUI(app, authMiddleWare)(route)
     * @example
     * activateUI(app)(route)
     */
    activateUI(app) {

        if (!app || !_.isFunction(app.use)) {
            throw new Error('Invalid Argument');
        }

        switch (arguments.length) {
            case 1:
                return (route) => {
                    app.use(route, kue.app);
                };
            case 2:
                return (route) => {
                    route = route || '/kue';

                    app.use(route, arguments[1]);
                    app.use(route, kue.app);
                };
            case 3:
                return (route) => {
                    route = route || '/kue';

                    app.use(route, basic_auth(arguments[1], arguments[2]));
                    app.use(route, kue.app);
                };
        }
    }

    /**
     * Setups event listeners and re-queues previous jobs
     * @param {object} target Queue instance
     * @param {object} [callbacks] Object containing error, failed, sigterm handlers
     */
    setup(target, callbacks) {
        callbacks = callbacks || {};

        target.on('error', callbacks.error || (err => {
            winston.log('error', 'QUEUE ERROR:', err);
        }));

        target.on('job failed', callbacks.failed || ((err) => {
            winston.log('error', 'FAILED JOB:', err);
        }));

        process.once('SIGTERM', callbacks.sigterm || (sig => {
            winston.log('SIGTERM', sig);
            target.shutdown(baseConfig.shutdownTimer || 5000, err => {
                winston.log('error', 'Kue shutdown:', err);
                process.exit(0);
            });
        }));

        const status = ['active', 'inactive'];

        //requeue all active and inactive jobs
        status.forEach(stat => {
            target[stat](callbacks[stat] || ((err, ids) => {
                ids.forEach(id => {
                    kue.Job.get(id, (_err, job) => {
                        if (job) {
                            job.inactive();
                        }
                    });
                });
            }));
        });
    }

    /**
     * Removes all jobs with specified job_name or status
     * @param {string} job_name Job name
     * @param {string} [status='complete'] Job status
     */
    cleanup(job_name, status) {
        kue.Job.rangeByType(job_name, status || 'complete', 0, -1, 'asc', (err, selectedJobs) => {
            if (selectedJobs && selectedJobs.length) {
                selectedJobs.forEach(job => {
                    job.remove();
                });
            }
        });
    }

    /**
     * Returns config
     * @return {object} Config object
     */
    getConfig() {
        return baseConfig;
    }
}

export default AnyTVKue;
