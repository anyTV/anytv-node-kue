'use strict';

import _ from 'lodash';
import kue from 'kue-scheduler';
import winston from 'winston';
import basic_auth from 'basic-auth-connect'

class AnyTVKue {

    constructor (config) {
        this.baseConfig = config || {};
        this.Queue = kue;

        _.defaults(this, kue);
    }

    createQueue () {
        const self = this;

        this.queue = kue.createQueue();

        this.queue._create = this.queue.create;

        this.queue.create = function () {
            const createResult = self.queue._create.apply(this, arguments);

            createResult._save = createResult.save;

            createResult.save = function () {
                createResult.removeOnComplete(!!self.baseConfig.removeOnComplete);
                createResult._save.apply(this, arguments);
            };

            return createResult;
        };

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
            target.shutdown(this.baseConfig.shutdownTimer || 5000, err => {
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
}

export default AnyTVKue;
