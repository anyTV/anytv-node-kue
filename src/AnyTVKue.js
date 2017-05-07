'use strict';

import _ from 'lodash';
import winston from 'winston';
import baseConfig from './config';
import kue from 'kue-scheduler';
import basic_auth from 'basic-auth-connect'

class AnyTVKue {

    constructor (config) {
        _.merge(baseConfig, config || {});
        _.defaults(this, kue);
    }

    createQueue (options) {
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
                createResult.removeOnComplete(options.remove_on_complete || baseConfig.remove_on_complete);
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
    activateUI (app) {
        switch(arguments.length) {
            case 1:
                return (route) => {
                    app.use(route, kue.app);
                }
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

    setup (target, callbacks) {
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
                winston.log('error', 'Kue shutdown:', err );
                process.exit(0);
            });
        }));

        const status = ['active', 'inactive'];

        //requeue all active and inactive jobs
        status.forEach(stat => {
            target[stat](callbacks[stat] || ((err, ids) => {
                ids.forEach(id => {
                    kue.Job.get(id, (_err, job) => {
                        job.inactive();
                    });
                });
            }));
        });
    }

    cleanup (job_name, status) {
        kue.Job.rangeByType(job_name, status || 'complete', 0, -1, 'asc', (err, selectedJobs) => {
            if (selectedJobs && selectedJobs.length) {
                selectedJobs.forEach(job => {
                    job.remove();
                });
            }
        });
    }

    getConfig() {
        return baseConfig;
    }
}

export default AnyTVKue;
